"""Achievement service — check conditions and unlock achievements after game completion.

Designed around metrics the app actually tracks:
  - num_guesses (1..6) + status
  - accuracy_score per game (0–100)
  - daily streak fields on the user
  - elo_rating + word_difficulty for rating-based unlocks
  - total game count + distinct modes for variety unlocks
"""
from __future__ import annotations

import uuid

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.achievement import Achievement
from app.models.game import Game
from app.models.user import User


async def check_and_unlock(db: AsyncSession, user: User, game: Game) -> list[str]:
    """Check achievement conditions after a game completes and award new unlocks."""
    unlocked: list[str] = []
    existing = await _get_existing(db, user.id)

    async def _try_unlock(atype: str) -> None:
        if atype not in existing:
            db.add(
                Achievement(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    achievement_type=atype,
                )
            )
            unlocked.append(atype)
            existing.add(atype)

    # ── Solving ────────────────────────────────────────────────────────────
    if game.status == "won":
        await _try_unlock("first_win")
        if game.num_guesses <= 3:
            await _try_unlock("quick_solve")
        if game.num_guesses == 2:
            await _try_unlock("bullseye")
        if game.num_guesses == 1:
            await _try_unlock("hole_in_one")
        if game.num_guesses == 6:
            await _try_unlock("last_chance")

    # ── Accuracy ───────────────────────────────────────────────────────────
    if game.accuracy_score is not None:
        if game.accuracy_score >= 90:
            await _try_unlock("sharpshooter")
        if game.accuracy_score >= 95:
            await _try_unlock("precision")
        if game.accuracy_score >= 100:
            await _try_unlock("perfect_game")

    # ── Streaks (daily) ────────────────────────────────────────────────────
    if user.current_streak >= 7:
        await _try_unlock("streak_7")
    if user.current_streak >= 30:
        await _try_unlock("streak_30")
    if user.current_streak >= 100:
        await _try_unlock("streak_100")

    # ── Rating (competitive ELO + upset wins) ──────────────────────────────
    if user.elo_rating >= 1200:
        await _try_unlock("reach_veteran")
    if user.elo_rating >= 1400:
        await _try_unlock("reach_master")
    if user.elo_rating >= 1600:
        await _try_unlock("reach_grandmaster")
    if (
        game.status == "won"
        and game.word_difficulty is not None
        and game.elo_before is not None
        and game.word_difficulty - game.elo_before >= 200
    ):
        await _try_unlock("upset")

    # ── Variety (volume + mode coverage) ───────────────────────────────────
    total_completed_q = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(Game.user_id == user.id, Game.status.in_(["won", "lost"]))
    )
    total_completed = total_completed_q.scalar_one() or 0
    if total_completed >= 25:
        await _try_unlock("regular")
    if total_completed >= 200:
        await _try_unlock("marathon")

    distinct_modes_q = await db.execute(
        select(func.count(distinct(Game.mode)))
        .select_from(Game)
        .where(Game.user_id == user.id, Game.status.in_(["won", "lost"]))
    )
    if (distinct_modes_q.scalar_one() or 0) >= 3:
        await _try_unlock("triathlete")

    await db.flush()
    return unlocked


async def _get_existing(db: AsyncSession, user_id: uuid.UUID) -> set[str]:
    """Return the set of achievement_type values already awarded to a user."""
    result = await db.execute(
        select(Achievement.achievement_type).where(Achievement.user_id == user_id)
    )
    return set(result.scalars().all())


async def get_user_achievements(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """Return all achievements unlocked by *user_id*, newest first."""
    result = await db.execute(
        select(Achievement)
        .where(Achievement.user_id == user_id)
        .order_by(Achievement.unlocked_at.desc())
    )
    achievements = result.scalars().all()
    return [
        {
            "type": a.achievement_type,
            "unlocked_at": a.unlocked_at.isoformat(),
        }
        for a in achievements
    ]


# All possible achievements for display (including locked ones).
# The frontend supplies its own Lucide icons + category mapping; the emoji
# in `icon` is just a fallback for clients that don't have the mapping.
ALL_ACHIEVEMENTS: list[dict] = [
    # ─── Solving ────────────────────────────────────────────────────────────
    {"type": "first_win",         "name": "First Win",      "description": "Solve your first puzzle",            "icon": "🏁"},
    {"type": "quick_solve",       "name": "Quick Solve",    "description": "Win in 3 guesses or fewer",          "icon": "⚡"},
    {"type": "bullseye",          "name": "Bullseye",       "description": "Win in exactly 2 guesses",           "icon": "🎯"},
    {"type": "hole_in_one",       "name": "Hole in One",    "description": "Win in 1 guess",                     "icon": "🏆"},
    {"type": "last_chance",       "name": "Last Chance",    "description": "Win on your 6th guess",              "icon": "🛡"},

    # ─── Accuracy ───────────────────────────────────────────────────────────
    {"type": "sharpshooter",      "name": "Sharpshooter",   "description": "Hit 90%+ accuracy in a game",        "icon": "🎯"},
    {"type": "precision",         "name": "Precision",      "description": "Hit 95%+ accuracy in a game",        "icon": "💎"},
    {"type": "perfect_game",      "name": "Perfect Game",   "description": "Hit 100% accuracy in a game",        "icon": "✨"},

    # ─── Streaks (Daily) ────────────────────────────────────────────────────
    {"type": "streak_7",          "name": "On Fire",        "description": "Reach a 7-day daily streak",         "icon": "🔥"},
    {"type": "streak_30",         "name": "Dedicated",      "description": "Reach a 30-day daily streak",        "icon": "📅"},
    {"type": "streak_100",        "name": "Unstoppable",    "description": "Reach a 100-day daily streak",       "icon": "🏆"},

    # ─── Rating (Competitive) ───────────────────────────────────────────────
    {"type": "reach_veteran",     "name": "Veteran",        "description": "Reach 1200 ELO",                      "icon": "⚔️"},
    {"type": "reach_master",      "name": "Master",         "description": "Reach 1400 ELO",                      "icon": "🏅"},
    {"type": "reach_grandmaster", "name": "Grandmaster",    "description": "Reach 1600 ELO",                      "icon": "👑"},
    {"type": "upset",             "name": "Upset",          "description": "Beat a word 200+ ELO above you",      "icon": "📈"},

    # ─── Variety ────────────────────────────────────────────────────────────
    {"type": "regular",           "name": "Regular",        "description": "Play 25 games",                       "icon": "🎮"},
    {"type": "marathon",          "name": "Marathon",       "description": "Play 200 games",                      "icon": "🏃"},
    {"type": "triathlete",        "name": "Triathlete",     "description": "Play Daily, Competitive, & Practice", "icon": "🎲"},
]
