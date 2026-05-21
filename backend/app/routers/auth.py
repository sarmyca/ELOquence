"""Authentication router — register, login, and current-user endpoints."""
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import GoogleLogin, Token, UserCreate, UserLogin, UserResponse
from app.services.auth import create_access_token, get_current_user, hash_password, verify_password
from app.services.rate_limit import check_rate_limit, reset_bucket

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _client_ip(request: Request) -> str:
    """Best-effort client IP. Behind a reverse proxy this should use the
    X-Forwarded-For header, but only after the proxy is configured to set
    it — naively trusting that header lets clients spoof IPs and bypass
    rate limits."""
    return request.client.host if request.client else "unknown"


def _verify_google_idinfo(google_id_token: str) -> dict:
    """Verify a Google id_token JWT and return its claims.

    Wraps ``id_token.verify_oauth2_token`` with our enforced policy:
    the audience MUST match our configured GOOGLE_CLIENT_ID and the
    ``email_verified`` claim MUST be true. Without the latter check, an
    attacker who registers a Google account claiming a victim's email
    address (Workspace and some free flows allow this until verification)
    can sign in here and be silently linked to the victim's existing
    account by email match — full account takeover.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            google_id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential.",
        )
    if not idinfo.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified.",
        )
    if not idinfo.get("email"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential did not include an email address.",
        )
    return idinfo


async def _resolve_google_user(db: AsyncSession, idinfo: dict) -> User:
    """Find-or-create-or-link the User row for a verified Google identity.

    Lookup order: by ``google_id`` (link is already established), then by
    ``email`` (silent account link — only safe because we have already
    enforced ``email_verified`` upstream), then create new.
    """
    google_id = idinfo["sub"]
    email = idinfo["email"]
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    if user is not None:
        if picture and user.avatar_url != picture:
            user.avatar_url = picture
            await db.flush()
        return user

    # No google_id match — try the email match (account-linking path).
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is not None:
        user.google_id = google_id
        if picture:
            user.avatar_url = picture
        await db.flush()
        return user

    # Brand-new user.
    base_username = (name or email.split("@")[0])[:30]
    username = base_username
    suffix = 0
    while True:
        check = await db.execute(select(User).where(User.username == username))
        if check.scalar_one_or_none() is None:
            break
        suffix += 1
        username = f"{base_username} {suffix}"

    user = User(
        id=uuid.uuid4(),
        email=email,
        username=username,
        password_hash=None,
        google_id=google_id,
        avatar_url=picture or None,
    )
    db.add(user)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Create a new user account and return an access token."""
    # Single uniqueness check that does NOT reveal whether the email or the
    # username was the colliding field. The previous code returned two
    # distinct error strings, letting an attacker enumerate registered
    # emails and usernames before launching a brute-force on /login.
    existing = await db.execute(
        select(User.id).where(
            (User.email == payload.email) | (User.username == payload.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed. Please choose different credentials.",
        )

    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        username=payload.username,
        password_hash=await hash_password(payload.password),
    )
    db.add(user)
    await db.flush()

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.post("/login", response_model=Token)
async def login(
    payload: UserLogin,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Authenticate a user and return a JWT access token.

    Throttled by both target email AND client IP. The email key blocks
    targeted brute-force on a known account; the IP key blocks credential
    stuffing across many emails from the same origin. A successful login
    clears both buckets so legitimate users never pay for their own past
    typos, while an attacker who never succeeds remains locked out for
    the full window.
    """
    email_key = f"login:email:{payload.email.lower()}"
    ip_key = f"login:ip:{_client_ip(request)}"

    # 10 attempts per 5 minutes per email; 30 per 5 minutes per IP.
    blocked_by = check_rate_limit(email_key, max_attempts=10, window_seconds=300.0)
    if blocked_by is None:
        blocked_by = check_rate_limit(ip_key, max_attempts=30, window_seconds=300.0)
    if blocked_by is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
            headers={"Retry-After": str(int(blocked_by) + 1)},
        )

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None or not await verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Successful auth — release the buckets.
    reset_bucket(email_key)
    reset_bucket(ip_key)

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.post("/google", response_model=Token)
async def google_login(
    payload: GoogleLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Authenticate via Google OAuth (id_token from Google Sign-In)."""
    idinfo = _verify_google_idinfo(payload.credential)
    user = await _resolve_google_user(db, idinfo)
    token = create_access_token(user.id)
    return Token(access_token=token)


@router.get("/google/callback")
async def google_callback(
    code: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Handle Google OAuth2 authorization-code callback.

    Exchanges the code for tokens, verifies the returned ``id_token``
    (NOT the access_token — previously this path called the userinfo
    endpoint with the access token, which means a leaked access_token
    would forge a session here), and creates/links the user.
    """
    redirect_uri = settings.CORS_ORIGINS.split(",")[0].strip() + "/api/auth/callback/google"

    async with httpx.AsyncClient(timeout=10) as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to exchange Google authorization code.",
        )

    tokens = token_resp.json()
    google_id_token = tokens.get("id_token")
    if not google_id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing id_token in Google token response.",
        )

    idinfo = _verify_google_idinfo(google_id_token)
    user = await _resolve_google_user(db, idinfo)
    token = create_access_token(user.id)
    return {"access_token": token}


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Return the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)
