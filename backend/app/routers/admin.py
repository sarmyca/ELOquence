"""Admin router — user management, daily words, analytics, and announcements.

All endpoints require the authenticated user to have is_admin=True.
The public GET /api/announcements/active endpoint is defined here as well
but does not require authentication.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.announcement import Announcement
from app.models.daily_word import DailyWord
from app.models.game import Game
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.auth import get_current_user
from app.services.word_difficulty import word_to_elo

router = APIRouter(prefix="/admin", tags=["admin"])

# ---------------------------------------------------------------------------
# Admin guard dependency
# ---------------------------------------------------------------------------


async def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """FastAPI dependency — allow access only to admin users."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# ---------------------------------------------------------------------------
# Request / response schemas (inline — admin-only surface, no need to share)
# ---------------------------------------------------------------------------


class ResetEloResponse(BaseModel):
    user_id: uuid.UUID
    new_elo: float


class DailyWordCreate(BaseModel):
    word: str
    date: date
    difficulty: float | None = None


class AnnouncementCreate(BaseModel):
    text: str


class AnnouncementPatch(BaseModel):
    text: str | None = None
    active: bool | None = None


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.get("/users")
async def list_users(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    search: str | None = Query(default=None),
) -> dict:
    """Return a paginated, optionally-filtered list of all users."""
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            User.username.ilike(pattern) | User.email.ilike(pattern)
        )
        count_query = count_query.where(
            User.username.ilike(pattern) | User.email.ilike(pattern)
        )

    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    users_result = await db.execute(query)
    count_result = await db.execute(count_query)

    users = list(users_result.scalars().all())
    total = count_result.scalar_one()

    return {
        "users": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return full user detail including stats profile."""
    from app.models.player_profile import PlayerProfile

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    profile_result = await db.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    return {
        "user": UserResponse.model_validate(user),
        "profile": {
            "total_games": profile.total_games if profile else 0,
            "total_wins": profile.total_wins if profile else 0,
            "avg_accuracy": profile.avg_accuracy if profile else None,
            "avg_accuracy_opening": profile.avg_accuracy_opening if profile else None,
            "avg_accuracy_midgame": profile.avg_accuracy_midgame if profile else None,
            "avg_accuracy_endgame": profile.avg_accuracy_endgame if profile else None,
            "favorite_openers": profile.favorite_openers if profile else None,
            "constraint_violation_rate": profile.constraint_violation_rate if profile else None,
            "trap_detection_rate": profile.trap_detection_rate if profile else None,
            "accuracy_trend_30d": profile.accuracy_trend_30d if profile else None,
            "elo_trend_30d": profile.elo_trend_30d if profile else None,
            "last_updated": profile.last_updated.isoformat() if profile else None,
        } if profile else None,
    }


@router.post("/users/{user_id}/reset-elo", response_model=ResetEloResponse)
async def reset_user_elo(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResetEloResponse:
    """Reset a user's ELO rating to 1000 and mark them as in placement."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.elo_rating = 1000.0
    user.is_placement = True
    user.games_played = 0
    await db.flush()

    return ResetEloResponse(user_id=user_id, new_elo=1000.0)


@router.post("/users/{user_id}/toggle-admin")
async def toggle_admin(
    user_id: uuid.UUID,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Flip the is_admin flag for a user. An admin cannot demote themselves."""
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own admin status.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.is_admin = not user.is_admin
    await db.flush()

    return {"user_id": str(user_id), "is_admin": user.is_admin}


# ---------------------------------------------------------------------------
# Daily Words
# ---------------------------------------------------------------------------


@router.get("/daily-words")
async def list_daily_words(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=14, ge=1, le=90),
) -> list[dict]:
    """Return recent and upcoming daily word assignments (±days window)."""
    today = date.today()
    window_start = today - timedelta(days=days)
    window_end = today + timedelta(days=days)

    result = await db.execute(
        select(DailyWord)
        .where(DailyWord.date >= window_start, DailyWord.date <= window_end)
        .order_by(DailyWord.date.desc())
    )
    rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "word": r.word,
            "date": r.date.isoformat(),
            "difficulty": r.difficulty,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/daily-words", status_code=status.HTTP_201_CREATED)
async def set_daily_word(
    payload: DailyWordCreate,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Assign a specific word to a calendar date, replacing any existing entry."""
    # Validate word length
    if len(payload.word) != 5 or not payload.word.isalpha():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Word must be exactly 5 alphabetic characters.",
        )

    word = payload.word.lower()
    difficulty = payload.difficulty if payload.difficulty is not None else word_to_elo(word.upper())

    # Upsert: remove existing entry for the date, then insert
    existing_result = await db.execute(
        select(DailyWord).where(DailyWord.date == payload.date)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.flush()

    daily = DailyWord(
        id=uuid.uuid4(),
        word=word,
        date=payload.date,
        difficulty=difficulty,
    )
    db.add(daily)
    await db.flush()

    return {
        "id": str(daily.id),
        "word": daily.word,
        "date": daily.date.isoformat(),
        "difficulty": daily.difficulty,
    }


@router.delete("/daily-words/{target_date}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_daily_word(
    target_date: date,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove the assigned daily word for a given date."""
    result = await db.execute(
        select(DailyWord).where(DailyWord.date == target_date)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No daily word assigned for {target_date}.",
        )
    await db.delete(row)
    await db.flush()


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


@router.get("/analytics")
async def analytics(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return aggregated platform analytics."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)

    # Total users
    total_users_result = await db.execute(
        select(func.count()).select_from(User)
    )
    total_users: int = total_users_result.scalar_one()

    # Total games (all statuses)
    total_games_result = await db.execute(
        select(func.count()).select_from(Game)
    )
    total_games: int = total_games_result.scalar_one()

    # Games completed today
    total_games_today_result = await db.execute(
        select(func.count()).select_from(Game).where(
            Game.completed_at >= today_start
        )
    )
    total_games_today: int = total_games_today_result.scalar_one()

    # Games completed in the last 7 days
    total_games_week_result = await db.execute(
        select(func.count()).select_from(Game).where(
            Game.completed_at >= week_start
        )
    )
    total_games_week: int = total_games_week_result.scalar_one()

    # Average accuracy (completed games that have a score)
    avg_accuracy_result = await db.execute(
        select(func.avg(Game.accuracy_score)).where(
            Game.accuracy_score.isnot(None)
        )
    )
    avg_accuracy: float = avg_accuracy_result.scalar_one() or 0.0

    # Average guesses (won games)
    avg_guesses_result = await db.execute(
        select(func.avg(Game.num_guesses)).where(Game.status == "won")
    )
    avg_guesses: float = avg_guesses_result.scalar_one() or 0.0

    # Win rate across rated games that are completed
    completed_result = await db.execute(
        select(func.count()).select_from(Game).where(
            Game.status.in_(["won", "lost"])
        )
    )
    completed: int = completed_result.scalar_one()

    won_result = await db.execute(
        select(func.count()).select_from(Game).where(Game.status == "won")
    )
    won: int = won_result.scalar_one()
    win_rate = round(won / completed * 100, 1) if completed > 0 else 0.0

    # Daily active users (distinct users with a completed game today)
    dau_result = await db.execute(
        select(func.count(func.distinct(Game.user_id))).where(
            Game.completed_at >= today_start
        )
    )
    daily_active: int = dau_result.scalar_one()

    # Weekly active users (distinct users with a completed game in last 7 days)
    wau_result = await db.execute(
        select(func.count(func.distinct(Game.user_id))).where(
            Game.completed_at >= week_start
        )
    )
    weekly_active: int = wau_result.scalar_one()

    return {
        "total_users": total_users,
        "total_games": total_games,
        "total_games_today": total_games_today,
        "total_games_week": total_games_week,
        "avg_accuracy": round(avg_accuracy, 1),
        "avg_guesses": round(avg_guesses, 2),
        "win_rate": win_rate,
        "daily_active": daily_active,
        "weekly_active": weekly_active,
    }


# ---------------------------------------------------------------------------
# Announcements (admin CRUD)
# ---------------------------------------------------------------------------


@router.get("/announcements")
async def list_announcements(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Return all announcements (active and inactive), newest first."""
    result = await db.execute(
        select(Announcement).order_by(Announcement.created_at.desc())
    )
    rows = result.scalars().all()
    return [_announcement_dict(a) for a in rows]


@router.post("/announcements", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementCreate,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a new active announcement."""
    ann = Announcement(
        id=uuid.uuid4(),
        text=payload.text,
        active=True,
    )
    db.add(ann)
    await db.flush()
    return _announcement_dict(ann)


@router.patch("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: uuid.UUID,
    payload: AnnouncementPatch,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Update the text and/or active status of an announcement."""
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    ann = result.scalar_one_or_none()
    if ann is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found."
        )

    if payload.text is not None:
        ann.text = payload.text
    if payload.active is not None:
        ann.active = payload.active

    ann.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return _announcement_dict(ann)


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_announcement(
    announcement_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Permanently delete an announcement."""
    result = await db.execute(
        select(Announcement).where(Announcement.id == announcement_id)
    )
    ann = result.scalar_one_or_none()
    if ann is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found."
        )
    await db.delete(ann)
    await db.flush()


# ---------------------------------------------------------------------------
# Public announcements endpoint (no auth required)
# ---------------------------------------------------------------------------

public_router = APIRouter(prefix="/announcements", tags=["announcements"])


@public_router.get("/active")
async def active_announcements(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Return all active announcements for display in the frontend."""
    result = await db.execute(
        select(Announcement)
        .where(Announcement.active.is_(True))
        .order_by(Announcement.created_at.desc())
    )
    rows = result.scalars().all()
    return [_announcement_dict(a) for a in rows]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _announcement_dict(ann: Announcement) -> dict:
    return {
        "id": str(ann.id),
        "text": ann.text,
        "active": ann.active,
        "created_at": ann.created_at.isoformat(),
        "updated_at": ann.updated_at.isoformat() if ann.updated_at else None,
    }
