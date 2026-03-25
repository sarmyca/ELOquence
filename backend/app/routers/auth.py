"""Authentication router — register, login, and current-user endpoints."""
import uuid
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import GoogleLogin, Token, UserCreate, UserLogin, UserResponse
from app.services.auth import create_access_token, get_current_user, hash_password, verify_password

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Create a new user account and return an access token."""
    # Check uniqueness
    email_check = await db.execute(select(User).where(User.email == payload.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    username_check = await db.execute(select(User).where(User.username == payload.username))
    if username_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken.",
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
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Authenticate a user and return a JWT access token."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None or not await verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.post("/google", response_model=Token)
async def google_login(
    payload: GoogleLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Authenticate via Google OAuth and return a JWT access token."""
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google credential.",
        )

    google_id = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    # Check if user exists by google_id
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        # Check if a user with this email already exists (link accounts)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is not None:
            # Link Google to existing account
            user.google_id = google_id
            if picture:
                user.avatar_url = picture
            await db.flush()
        else:
            # Create new user - use display name as username (keep spaces)
            base_username = (name or email.split("@")[0])[:30]
            username = base_username
            # Make unique
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
    else:
        # Update avatar on each login
        if picture and user.avatar_url != picture:
            user.avatar_url = picture
            await db.flush()

    token = create_access_token(user.id)
    return Token(access_token=token)


@router.get("/google/callback")
async def google_callback(
    code: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Handle Google OAuth2 authorization code callback.

    Exchanges the code for tokens, fetches user info, creates/links the user,
    and redirects to the frontend with a JWT in the URL fragment.
    """
    redirect_uri = settings.CORS_ORIGINS.split(",")[0].strip() + "/api/auth/callback/google"

    # Exchange authorization code for tokens
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
    google_access_token = tokens.get("access_token")
    if not google_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No access token from Google.",
        )

    # Fetch user info
    async with httpx.AsyncClient(timeout=10) as client:
        info_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )

    if info_resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to fetch Google user info.",
        )

    userinfo = info_resp.json()
    google_id = userinfo["sub"]
    email = userinfo.get("email", "")
    name = userinfo.get("name", "")
    picture = userinfo.get("picture", "")

    # Find or create user (same logic as /google endpoint)
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is not None:
            user.google_id = google_id
            if picture:
                user.avatar_url = picture
            await db.flush()
        else:
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
    else:
        if picture and user.avatar_url != picture:
            user.avatar_url = picture
            await db.flush()

    token = create_access_token(user.id)
    return {"access_token": token}


@router.get("/me", response_model=UserResponse)
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    """Return the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)
