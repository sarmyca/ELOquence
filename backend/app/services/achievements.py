"""Achievement service — check conditions and unlock achievements after game completion."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.achievement import Achievement
from app.models.game import Game
from app.models.move import Move
from app.models.user import User


async def check_and_unlock(db: AsyncSession, user: User, game: Game) -> list[str]:
    """Check all achievement conditions after a game completes.

    Evaluates each achievement condition against the completed game and the
    user's current stats. Any achievement that is newly satisfied and not yet
    awarded is inserted into the database.

    Args:
        db: Active async session (must be open; caller commits).
        user: The authenticated player.
        game: The game that just completed.

    Returns:
        List of newly unlocked achievement_type strings.
    """
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

    # --- Accuracy milestones ---
    if game.accuracy_score is not None:
        if game.accuracy_score >= 90:
            await _try_unlock("first_90_accuracy")
        if game.accuracy_score >= 95:
            await _try_unlock("first_95_accuracy")
        if game.accuracy_score >= 100:
            await _try_unlock("first_100_accuracy")

    # --- Won-game achievements ---
    if game.status == "won":
        moves_result = await db.execute(
            select(Move).where(Move.game_id == game.id)
        )
        moves = list(moves_result.scalars().all())

        # Perfectionist: every classified move must be best, brilliant, or forced
        if moves and all(
            m.classification in ("best", "brilliant", "forced")
            for m in moves
            if m.classification
        ):
            await _try_unlock("perfectionist")

        # Brilliant move milestones
        brilliants_in_game = [m for m in moves if m.classification == "brilliant"]
        if brilliants_in_game:
            await _try_unlock("first_brilliant")

        # Count total brilliants across all of the user's games
        total_brilliant_result = await db.execute(
            select(func.count())
            .select_from(Move)
            .join(Game, Move.game_id == Game.id)
            .where(Game.user_id == user.id, Move.classification == "brilliant")
        )
        if total_brilliant_result.scalar_one() >= 10:
            await _try_unlock("ten_brilliants")

        # Underdog: beat a word 300+ ELO above the player's pre-game rating
        if game.word_difficulty is not None and game.elo_before is not None:
            if game.word_difficulty - game.elo_before >= 300:
                await _try_unlock("underdog")

    # --- Streak milestones ---
    if user.current_streak >= 7:
        await _try_unlock("streak_7")
    if user.current_streak >= 30:
        await _try_unlock("streak_30")
    if user.current_streak >= 100:
        await _try_unlock("streak_100")

    # --- Rating milestones ---
    if user.elo_rating >= 1200:
        await _try_unlock("reach_veteran")
    if user.elo_rating >= 1400:
        await _try_unlock("reach_master")
    if user.elo_rating >= 1600:
        await _try_unlock("reach_grandmaster")

    # --- Climber: gained 200 ELO from the default starting rating of 1000 ---
    if user.elo_rating >= 1200:
        await _try_unlock("climber")

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


# All possible achievements for display (including locked ones)
ALL_ACHIEVEMENTS: list[dict] = [
    {
        "type": "first_90_accuracy",
        "name": "Sharpshooter",
        "description": "Achieve 90%+ accuracy in a game",
        "icon": "🎯",
    },
    {
        "type": "first_95_accuracy",
        "name": "Precision",
        "description": "Achieve 95%+ accuracy in a game",
        "icon": "💎",
    },
    {
        "type": "first_100_accuracy",
        "name": "Perfect",
        "description": "Achieve 100% accuracy in a game",
        "icon": "👑",
    },
    {
        "type": "first_brilliant",
        "name": "Eureka",
        "description": "Find your first Brilliant move",
        "icon": "💡",
    },
    {
        "type": "ten_brilliants",
        "name": "Mastermind",
        "description": "Find 10 Brilliant moves",
        "icon": "🧠",
    },
    {
        "type": "perfectionist",
        "name": "Perfectionist",
        "description": "Complete a game with all Best/Brilliant moves",
        "icon": "⭐",
    },
    {
        "type": "streak_7",
        "name": "On Fire",
        "description": "Maintain a 7-day streak",
        "icon": "🔥",
    },
    {
        "type": "streak_30",
        "name": "Dedicated",
        "description": "Maintain a 30-day streak",
        "icon": "📅",
    },
    {
        "type": "streak_100",
        "name": "Unstoppable",
        "description": "Maintain a 100-day streak",
        "icon": "🏆",
    },
    {
        "type": "reach_veteran",
        "name": "Veteran",
        "description": "Reach 1200 ELO",
        "icon": "⚔️",
    },
    {
        "type": "reach_master",
        "name": "Master",
        "description": "Reach 1400 ELO",
        "icon": "🏅",
    },
    {
        "type": "reach_grandmaster",
        "name": "Grandmaster",
        "description": "Reach 1600 ELO",
        "icon": "👊",
    },
    {
        "type": "underdog",
        "name": "Underdog",
        "description": "Beat a word 300+ ELO above your rating",
        "icon": "💪",
    },
    {
        "type": "climber",
        "name": "Climber",
        "description": "Gain 200 ELO from starting rating",
        "icon": "📈",
    },
]
