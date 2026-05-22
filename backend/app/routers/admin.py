"""Admin router — user management, daily words, analytics, and announcements.

All endpoints require the authenticated user to have is_admin=True.
The public GET /api/announcements/active endpoint is defined here as well
but does not require authentication.
"""
from __future__ import annotations

import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import Date, cast, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.database import get_db
from app.models.admin_audit_log import AdminAuditLog
from app.models.announcement import Announcement
from app.models.daily_word import DailyWord
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.services.audit import record_admin_action
from app.services.auth import get_current_user
from app.services.word_difficulty import word_to_elo

# Module-level startup time for /health uptime computation
_START_TIME = time.monotonic()

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


class AdminUserResponse(BaseModel):
    """Extended user representation for admin endpoints."""

    id: uuid.UUID
    email: str
    username: str
    avatar_url: str | None = None
    elo_rating: float
    games_played: int
    is_placement: bool
    current_streak: int
    max_streak: int
    created_at: datetime
    is_admin: bool
    total_wins: int
    total_losses: int
    provider: str | None = None
    last_played_date: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_user(cls, u: User) -> "AdminUserResponse":
        return cls(
            id=u.id,
            email=u.email,
            username=u.username,
            avatar_url=u.avatar_url,
            elo_rating=u.elo_rating,
            games_played=u.games_played,
            is_placement=u.is_placement,
            current_streak=u.current_streak,
            max_streak=u.max_streak,
            created_at=u.created_at,
            is_admin=u.is_admin,
            total_wins=u.total_wins,
            total_losses=u.total_losses,
            provider=u.provider,
            last_played_date=u.last_played_date.isoformat() if u.last_played_date else None,
        )


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
    role: Literal["all", "admin", "user"] = Query(default="all"),
    order_by: Literal["created_at", "elo_rating", "games_played", "last_played"] = Query(default="created_at"),
    order: Literal["asc", "desc"] = Query(default="desc"),
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

    if role == "admin":
        query = query.where(User.is_admin.is_(True))
        count_query = count_query.where(User.is_admin.is_(True))
    elif role == "user":
        query = query.where(User.is_admin.is_(False))
        count_query = count_query.where(User.is_admin.is_(False))

    # Build ORDER BY
    _order_col_map = {
        "created_at": User.created_at,
        "elo_rating": User.elo_rating,
        "games_played": User.games_played,
        "last_played": User.last_played_date,
    }
    order_col = _order_col_map[order_by]
    if order == "desc":
        query = query.order_by(order_col.desc())
    else:
        query = query.order_by(order_col.asc())

    query = query.offset((page - 1) * per_page).limit(per_page)

    users_result = await db.execute(query)
    count_result = await db.execute(count_query)

    users = list(users_result.scalars().all())
    total = count_result.scalar_one()

    return {
        "users": [AdminUserResponse.from_user(u) for u in users],
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
    """Return full user detail including stats profile, ELO history, and game breakdowns."""
    from app.models.player_profile import PlayerProfile

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    profile_result = await db.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user_id)
    )
    profile = profile_result.scalar_one_or_none()

    # Last 30 EloHistory entries
    elo_hist_result = await db.execute(
        select(EloHistory)
        .where(EloHistory.user_id == user_id)
        .order_by(EloHistory.recorded_at.desc())
        .limit(30)
    )
    elo_history_rows = elo_hist_result.scalars().all()

    # Recent games counts (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_counts_result = await db.execute(
        select(Game.status, func.count().label("cnt"))
        .where(
            Game.user_id == user_id,
            Game.created_at >= thirty_days_ago,
            Game.status.in_(["won", "lost", "abandoned"]),
        )
        .group_by(Game.status)
    )
    recent_counts: dict[str, int] = {"won": 0, "lost": 0, "abandoned": 0}
    for row in recent_counts_result.all():
        recent_counts[row.status] = row.cnt

    # Games by mode (lifetime)
    games_by_mode_result = await db.execute(
        select(Game.mode, func.count().label("cnt"))
        .where(Game.user_id == user_id)
        .group_by(Game.mode)
    )
    games_by_mode: dict[str, int] = {"daily": 0, "competitive": 0, "practice": 0, "challenge": 0}
    for row in games_by_mode_result.all():
        if row.mode in games_by_mode:
            games_by_mode[row.mode] = row.cnt

    return {
        "user": AdminUserResponse.from_user(user),
        "profile": {
            "total_games": profile.total_games if profile else 0,
            "total_wins": profile.total_wins if profile else 0,
            "avg_accuracy": profile.avg_accuracy if profile else None,
            "favorite_openers": profile.favorite_openers if profile else None,
            "constraint_violation_rate": profile.constraint_violation_rate if profile else None,
            "trap_detection_rate": profile.trap_detection_rate if profile else None,
            "accuracy_trend_30d": profile.accuracy_trend_30d if profile else None,
            "elo_trend_30d": profile.elo_trend_30d if profile else None,
            "last_updated": profile.last_updated.isoformat() if profile else None,
        } if profile else None,
        "elo_history": [
            {
                "elo_before": h.elo_before,
                "elo_after": h.elo_after,
                "delta": h.delta,
                "accuracy_score": h.accuracy_score,
                "recorded_at": h.recorded_at.isoformat(),
            }
            for h in elo_history_rows
        ],
        "recent_games_count": recent_counts,
        "games_by_mode": games_by_mode,
    }


@router.post("/users/{user_id}/reset-elo", response_model=ResetEloResponse)
async def reset_user_elo(
    user_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ResetEloResponse:
    """Reset a user's ELO rating to 800 and mark them as in placement."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.elo_rating = 800.0
    user.is_placement = True
    user.games_played = 0
    user.total_wins = 0
    user.total_losses = 0
    await db.flush()

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="reset_elo",
        target_type="user",
        target_id=str(user_id),
        target_label=user.username,
        request=request,
    )
    await db.flush()

    return ResetEloResponse(user_id=user_id, new_elo=800.0)


@router.post("/users/{user_id}/toggle-admin")
async def toggle_admin(
    user_id: uuid.UUID,
    request: Request,
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

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="toggle_admin",
        target_type="user",
        target_id=str(user_id),
        target_label=user.username,
        payload={"new_is_admin": user.is_admin},
        request=request,
    )
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
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Assign a specific word to a calendar date, replacing any existing entry."""
    if len(payload.word) != 5 or not payload.word.isalpha():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Word must be exactly 5 alphabetic characters.",
        )

    word = payload.word.lower()
    difficulty = payload.difficulty if payload.difficulty is not None else word_to_elo(word.upper())

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

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="set_daily_word",
        target_type="daily_word",
        target_id=payload.date.isoformat(),
        target_label=payload.word,
        payload={"difficulty": difficulty},
        request=request,
    )
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
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
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

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="delete_daily_word",
        target_type="daily_word",
        target_id=target_date.isoformat(),
        request=request,
    )
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

    # Games started today (use created_at for consistency with the timeseries chart)
    games_today_result = await db.execute(
        select(func.count()).select_from(Game).where(
            Game.created_at >= today_start
        )
    )
    games_today: int = games_today_result.scalar_one()

    # Games started in the last 7 days
    games_this_week_result = await db.execute(
        select(func.count()).select_from(Game).where(
            Game.created_at >= week_start
        )
    )
    games_this_week: int = games_this_week_result.scalar_one()

    # New users today
    new_users_today_result = await db.execute(
        select(func.count()).select_from(User).where(
            User.created_at >= today_start
        )
    )
    new_users_today: int = new_users_today_result.scalar_one()

    # New users this week
    new_users_week_result = await db.execute(
        select(func.count()).select_from(User).where(
            User.created_at >= week_start
        )
    )
    new_users_week: int = new_users_week_result.scalar_one()

    # Active (in-progress) games
    active_games_result = await db.execute(
        select(func.count()).select_from(Game).where(Game.status == "in_progress")
    )
    active_games: int = active_games_result.scalar_one()

    # Average accuracy (completed games that have a score)
    avg_accuracy_result = await db.execute(
        select(func.avg(Game.accuracy_score)).where(
            Game.accuracy_score.isnot(None)
        )
    )
    avg_accuracy: float = avg_accuracy_result.scalar_one() or 0.0

    # Average guesses (won games). func.avg over an INTEGER column returns
    # Decimal in postgres; cast to float so the JSON encoder emits a number.
    avg_guesses_result = await db.execute(
        select(func.avg(Game.num_guesses)).where(Game.status == "won")
    )
    avg_guesses: float = float(avg_guesses_result.scalar_one() or 0)

    # Win rate = won / (won + lost). Counts actual game outcomes rather than
    # ELO-positive rated games — keeps the label honest.
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

    # Daily active users (distinct users with any game activity today)
    dau_result = await db.execute(
        select(func.count(func.distinct(Game.user_id))).where(
            Game.created_at >= today_start
        )
    )
    dau: int = dau_result.scalar_one()

    # Weekly active users (distinct users with any game activity in last 7 days)
    wau_result = await db.execute(
        select(func.count(func.distinct(Game.user_id))).where(
            Game.created_at >= week_start
        )
    )
    wau: int = wau_result.scalar_one()

    return {
        "total_users": total_users,
        "total_games": total_games,
        "games_today": games_today,
        "games_this_week": games_this_week,
        "new_users_today": new_users_today,
        "new_users_week": new_users_week,
        "active_games": active_games,
        "avg_accuracy": round(avg_accuracy, 1),
        "avg_guesses": round(avg_guesses, 2),
        "win_rate": win_rate,
        "dau": dau,
        "wau": wau,
    }


@router.get("/analytics/timeseries")
async def analytics_timeseries(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=30, ge=1, le=180),
) -> dict:
    """Return per-day timeseries for the last `days` days."""
    now = datetime.now(timezone.utc)
    # Build the ordered list of dates (oldest first)
    dates: list[date] = [
        (now - timedelta(days=days - 1 - i)).date() for i in range(days)
    ]

    # -- Signups per day --
    signups_result = await db.execute(
        select(
            cast(User.created_at, Date).label("day"),
            func.count().label("cnt"),
        )
        .where(User.created_at >= (now - timedelta(days=days)))
        .group_by(cast(User.created_at, Date))
    )
    signups_map: dict[date, int] = {row.day: row.cnt for row in signups_result.all()}

    # -- Games total and by mode per day --
    games_per_day_result = await db.execute(
        select(
            cast(Game.created_at, Date).label("day"),
            Game.mode,
            func.count().label("cnt"),
        )
        .where(Game.created_at >= (now - timedelta(days=days)))
        .group_by(cast(Game.created_at, Date), Game.mode)
    )
    games_total_map: dict[date, int] = {}
    games_mode_map: dict[tuple[date, str], int] = {}
    for row in games_per_day_result.all():
        games_total_map[row.day] = games_total_map.get(row.day, 0) + row.cnt
        games_mode_map[(row.day, row.mode)] = row.cnt

    # -- Active users per day (distinct user_id) --
    active_users_result = await db.execute(
        select(
            cast(Game.created_at, Date).label("day"),
            func.count(func.distinct(Game.user_id)).label("cnt"),
        )
        .where(Game.created_at >= (now - timedelta(days=days)))
        .group_by(cast(Game.created_at, Date))
    )
    active_users_map: dict[date, int] = {row.day: row.cnt for row in active_users_result.all()}

    # -- Average accuracy per day (completed games with a score) --
    avg_accuracy_result = await db.execute(
        select(
            cast(Game.created_at, Date).label("day"),
            func.avg(Game.accuracy_score).label("avg_acc"),
        )
        .where(
            Game.created_at >= (now - timedelta(days=days)),
            Game.accuracy_score.isnot(None),
        )
        .group_by(cast(Game.created_at, Date))
    )
    avg_accuracy_map: dict[date, float] = {
        row.day: round(float(row.avg_acc), 1) for row in avg_accuracy_result.all()
    }

    # -- Wins and losses per day --
    outcomes_result = await db.execute(
        select(
            cast(Game.created_at, Date).label("day"),
            Game.status,
            func.count().label("cnt"),
        )
        .where(
            Game.created_at >= (now - timedelta(days=days)),
            Game.status.in_(["won", "lost"]),
        )
        .group_by(cast(Game.created_at, Date), Game.status)
    )
    wins_map: dict[date, int] = {}
    losses_map: dict[date, int] = {}
    for row in outcomes_result.all():
        if row.status == "won":
            wins_map[row.day] = row.cnt
        else:
            losses_map[row.day] = row.cnt

    # -- Merge into series --
    series = []
    for d in dates:
        series.append({
            "date": d.isoformat(),
            "signups": signups_map.get(d, 0),
            "games_total": games_total_map.get(d, 0),
            "games_daily": games_mode_map.get((d, "daily"), 0),
            "games_competitive": games_mode_map.get((d, "competitive"), 0),
            "games_practice": games_mode_map.get((d, "practice"), 0),
            "games_challenge": games_mode_map.get((d, "challenge"), 0),
            "active_users": active_users_map.get(d, 0),
            "avg_accuracy": avg_accuracy_map.get(d, None),
            "wins": wins_map.get(d, 0),
            "losses": losses_map.get(d, 0),
        })

    return {"days": days, "series": series}


@router.get("/analytics/distributions")
async def analytics_distributions(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return ELO bucket, mode, outcome, and guesses-to-win distributions."""
    # -- ELO buckets (users with games_played > 0, bucket size 100) --
    # Buckets: 0-99, 100-199, ..., 2300-2399, 2400+
    bucket_size = 100
    max_bucket_start = 2400
    elo_labels = list(range(0, max_bucket_start, bucket_size))

    elo_bucket_result = await db.execute(
        select(
            (func.floor(User.elo_rating / bucket_size) * bucket_size).label("bucket_min"),
            func.count().label("cnt"),
        )
        .where(User.games_played > 0)
        .group_by(text("bucket_min"))
        .order_by(text("bucket_min"))
    )
    raw_buckets: dict[int, int] = {}
    for row in elo_bucket_result.all():
        bmin = int(row.bucket_min)
        raw_buckets[bmin] = row.cnt

    # Build fixed bucket list; last bucket is open-ended (2400+)
    elo_buckets = []
    for bmin in elo_labels:
        elo_buckets.append({
            "min": bmin,
            "max": bmin + bucket_size - 1,
            "count": raw_buckets.get(bmin, 0),
        })
    # Accumulate anything >= 2400 into the last bucket
    overflow = sum(v for k, v in raw_buckets.items() if k >= max_bucket_start)
    if elo_buckets:
        elo_buckets[-1]["count"] += overflow
        elo_buckets[-1]["max"] = None  # open-ended

    # -- Mode distribution --
    mode_dist_result = await db.execute(
        select(Game.mode, func.count().label("cnt")).group_by(Game.mode)
    )
    mode_distribution: dict[str, int] = {"daily": 0, "competitive": 0, "practice": 0, "challenge": 0}
    for row in mode_dist_result.all():
        if row.mode in mode_distribution:
            mode_distribution[row.mode] = row.cnt

    # -- Outcome distribution --
    outcome_dist_result = await db.execute(
        select(Game.status, func.count().label("cnt")).group_by(Game.status)
    )
    outcome_distribution: dict[str, int] = {"won": 0, "lost": 0, "abandoned": 0, "in_progress": 0}
    for row in outcome_dist_result.all():
        if row.status in outcome_distribution:
            outcome_distribution[row.status] = row.cnt

    # -- Guesses to win (won games only, num_guesses 1-6) --
    guesses_result = await db.execute(
        select(Game.num_guesses, func.count().label("cnt"))
        .where(Game.status == "won", Game.num_guesses >= 1, Game.num_guesses <= 6)
        .group_by(Game.num_guesses)
    )
    guesses_to_win: dict[str, int] = {str(i): 0 for i in range(1, 7)}
    for row in guesses_result.all():
        guesses_to_win[str(row.num_guesses)] = row.cnt

    return {
        "elo_buckets": elo_buckets,
        "mode_distribution": mode_distribution,
        "outcome_distribution": outcome_distribution,
        "guesses_to_win": guesses_to_win,
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
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
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

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="create_announcement",
        target_type="announcement",
        target_id=str(ann.id),
        target_label=payload.text[:80],
        request=request,
    )
    await db.flush()

    return _announcement_dict(ann)


@router.patch("/announcements/{announcement_id}")
async def update_announcement(
    announcement_id: uuid.UUID,
    payload: AnnouncementPatch,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
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

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="update_announcement",
        target_type="announcement",
        target_id=str(announcement_id),
        payload={"text": payload.text, "active": payload.active},
        request=request,
    )
    await db.flush()

    return _announcement_dict(ann)


@router.delete("/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_announcement(
    announcement_id: uuid.UUID,
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
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

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="delete_announcement",
        target_type="announcement",
        target_id=str(announcement_id),
        request=request,
    )
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
# Notification job triggers (demo / on-demand)
# ---------------------------------------------------------------------------


@router.post("/notifications/trigger")
async def trigger_notification_job(
    request: Request,
    admin: Annotated[User, Depends(require_admin)],
    type: Annotated[str, Query(description="daily_reminder or streak_warning")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Fire one of the scheduled notification jobs immediately.

    Useful for demos and integration tests — the real jobs run at 09:00
    and 19:00 local time, which is impractical to wait for in a review.
    """
    from app.services.notifications_cron import (
        run_daily_reminder_job,
        run_streak_warning_job,
    )

    if type == "daily_reminder":
        stats = await run_daily_reminder_job()
    elif type == "streak_warning":
        stats = await run_streak_warning_job()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="type must be 'daily_reminder' or 'streak_warning'",
        )

    await record_admin_action(
        db,
        admin_user_id=admin.id,
        action="trigger_notification",
        target_label=type,
        payload={"stats": stats},
        request=request,
    )
    await db.flush()

    return {"type": type, **stats}


# ---------------------------------------------------------------------------
# Games browser
# ---------------------------------------------------------------------------


@router.get("/users/{user_id}/games")
async def list_user_games(
    user_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    mode: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
) -> dict:
    """Return paginated games for a specific user."""
    # 404 if the user doesn't exist so callers don't get an empty list for
    # garbage UUIDs (which would silently mask broken links).
    user_exists = await db.execute(
        select(User.id).where(User.id == user_id)
    )
    if user_exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    query = select(Game).where(Game.user_id == user_id)
    count_query = select(func.count()).select_from(Game).where(Game.user_id == user_id)

    if mode:
        query = query.where(Game.mode == mode)
        count_query = count_query.where(Game.mode == mode)
    if status_filter:
        query = query.where(Game.status == status_filter)
        count_query = count_query.where(Game.status == status_filter)

    query = query.order_by(Game.created_at.desc()).offset((page - 1) * per_page).limit(per_page)

    games_result = await db.execute(query)
    count_result = await db.execute(count_query)

    games = list(games_result.scalars().all())
    total = count_result.scalar_one()

    return {
        "games": [_game_dict(g) for g in games],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/games")
async def list_all_games(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    mode: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    user_id: uuid.UUID | None = Query(default=None),
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
) -> dict:
    """Return a paginated browser of ALL games with optional filters."""
    base_where = []
    if mode:
        base_where.append(Game.mode == mode)
    if status_filter:
        base_where.append(Game.status == status_filter)
    if user_id is not None:
        base_where.append(Game.user_id == user_id)
    if from_date is not None:
        from_dt = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        base_where.append(Game.created_at >= from_dt)
    if to_date is not None:
        # Inclusive: end of day
        to_dt = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        base_where.append(Game.created_at <= to_dt)

    # Join to User for username (LEFT JOIN to handle NULL user_id / guest games)
    UserAlias = aliased(User)

    query = (
        select(Game, UserAlias.username)
        .outerjoin(UserAlias, Game.user_id == UserAlias.id)
        .where(*base_where)
        .order_by(Game.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    count_query = select(func.count()).select_from(Game).where(*base_where)

    games_result = await db.execute(query)
    count_result = await db.execute(count_query)

    total = count_result.scalar_one()

    rows = games_result.all()
    games_list = []
    for game, username in rows:
        d = _game_dict(game)
        d["username"] = username
        d["user_id"] = str(game.user_id) if game.user_id else None
        games_list.append(d)

    return {
        "games": games_list,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/games/{game_id}")
async def get_game_admin(
    game_id: uuid.UUID,
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return full game detail including moves. No ownership check."""
    UserAlias = aliased(User)

    result = await db.execute(
        select(Game, UserAlias.username)
        .outerjoin(UserAlias, Game.user_id == UserAlias.id)
        .where(Game.id == game_id)
        .options(selectinload(Game.moves))
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    game, username = row

    d = _game_dict(game)
    d["username"] = username
    d["user_id"] = str(game.user_id) if game.user_id else None
    d["moves"] = [_move_dict(m) for m in game.moves]

    return d


# ---------------------------------------------------------------------------
# Audit Log
# ---------------------------------------------------------------------------


@router.get("/audit-log")
async def list_audit_log(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=200),
    action: str | None = Query(default=None),
    admin_id: uuid.UUID | None = Query(default=None),
) -> dict:
    """Return paginated admin audit log entries, newest first."""
    AdminUser = aliased(User)

    base_where = []
    if action:
        base_where.append(AdminAuditLog.action == action)
    if admin_id is not None:
        base_where.append(AdminAuditLog.admin_user_id == admin_id)

    query = (
        select(AdminAuditLog, AdminUser.username.label("admin_username"))
        .outerjoin(AdminUser, AdminAuditLog.admin_user_id == AdminUser.id)
        .where(*base_where)
        .order_by(AdminAuditLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    count_query = (
        select(func.count())
        .select_from(AdminAuditLog)
        .where(*base_where)
    )

    entries_result = await db.execute(query)
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    entries = []
    for log_entry, admin_username in entries_result.all():
        ip = None
        if log_entry.ip_address is not None:
            ip = str(log_entry.ip_address)
        entries.append({
            "id": str(log_entry.id),
            "admin_user_id": str(log_entry.admin_user_id),
            "admin_username": admin_username,
            "action": log_entry.action,
            "target_type": log_entry.target_type,
            "target_id": log_entry.target_id,
            "target_label": log_entry.target_label,
            "payload": log_entry.payload,
            "ip_address": ip,
            "created_at": log_entry.created_at.isoformat(),
        })

    return {
        "entries": entries,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get("/health")
async def admin_health(
    _admin: Annotated[User, Depends(require_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return DB connectivity, uptime, and basic table row counts."""
    db_ok = False
    latency_ms: float | None = None

    try:
        t0 = time.monotonic()
        await db.execute(text("SELECT 1"))
        latency_ms = round((time.monotonic() - t0) * 1000, 2)
        db_ok = True
    except Exception:
        pass

    uptime_seconds = round(time.monotonic() - _START_TIME, 2)

    # Table counts
    games_count_result = await db.execute(select(func.count()).select_from(Game))
    games_count: int = games_count_result.scalar_one()

    users_count_result = await db.execute(select(func.count()).select_from(User))
    users_count: int = users_count_result.scalar_one()

    audit_count_result = await db.execute(select(func.count()).select_from(AdminAuditLog))
    audit_count: int = audit_count_result.scalar_one()

    return {
        "db": {"ok": db_ok, "latency_ms": latency_ms},
        "uptime_seconds": uptime_seconds,
        "version": "1.0.0",
        "checks": {
            "games_table": games_count,
            "users_table": users_count,
            "audit_log_size": audit_count,
        },
    }


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


def _game_dict(g: Game) -> dict:
    return {
        "id": str(g.id),
        "mode": g.mode,
        "status": g.status,
        "target_word": g.target_word,
        "word_difficulty": g.word_difficulty,
        "num_guesses": g.num_guesses,
        "time_seconds": g.time_seconds,
        "elo_before": g.elo_before,
        "elo_after": g.elo_after,
        "elo_delta": g.elo_delta,
        "accuracy_score": g.accuracy_score,
        "luck_factor": g.luck_factor,
        "rated": g.rated,
        "is_placement": g.is_placement,
        "hard_mode": g.hard_mode,
        "created_at": g.created_at.isoformat(),
        "completed_at": g.completed_at.isoformat() if g.completed_at else None,
    }


def _move_dict(m: Move) -> dict:
    return {
        "id": str(m.id),
        "move_number": m.move_number,
        "guess_word": m.guess_word,
        "pattern": m.pattern,
        "classification": m.classification,
        "remaining_words": m.remaining_words,
        "entropy_before": m.entropy_before,
        "entropy_after": m.entropy_after,
        "info_gained": m.info_gained,
        "optimal_info": m.optimal_info,
        "optimal_word": m.optimal_word,
        "efficiency_ratio": m.efficiency_ratio,
        "bits_lost": m.bits_lost,
        "constraint_violation": m.constraint_violation,
        "trap_detected": m.trap_detected,
        "is_book_move": m.is_book_move,
        "created_at": m.created_at.isoformat(),
    }
