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
from app.models.challenge import Challenge
from app.models.game import Game
from app.models.move import Move
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
    if total_completed >= 100:
        await _try_unlock("dedicated_100")
    if total_completed >= 200:
        await _try_unlock("marathon")
    if total_completed >= 500:
        await _try_unlock("legend_500")

    distinct_modes_q = await db.execute(
        select(func.count(distinct(Game.mode)))
        .select_from(Game)
        .where(Game.user_id == user.id, Game.status.in_(["won", "lost"]))
    )
    if (distinct_modes_q.scalar_one() or 0) >= 3:
        await _try_unlock("triathlete")

    # Win across every mode (daily + competitive + practice + challenge).
    modes_won_q = await db.execute(
        select(func.count(distinct(Game.mode)))
        .select_from(Game)
        .where(Game.user_id == user.id, Game.status == "won")
    )
    if (modes_won_q.scalar_one() or 0) >= 4:
        await _try_unlock("all_modes_won")

    # ── Daily-specific volume ──────────────────────────────────────────────
    daily_wins_q = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(Game.user_id == user.id, Game.status == "won", Game.mode == "daily")
    )
    daily_wins = daily_wins_q.scalar_one() or 0
    if daily_wins >= 30:
        await _try_unlock("daily_devotee")
    if daily_wins >= 100:
        await _try_unlock("daily_marathon")

    # ── 3-guess specialist ─────────────────────────────────────────────────
    if game.status == "won" and game.num_guesses == 3:
        three_q = await db.execute(
            select(func.count())
            .select_from(Game)
            .where(Game.user_id == user.id, Game.status == "won", Game.num_guesses == 3)
        )
        if (three_q.scalar_one() or 0) >= 25:
            await _try_unlock("three_master")

    # ── Placement complete ─────────────────────────────────────────────────
    placement_done_q = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.user_id == user.id,
            Game.is_placement.is_(True),
            Game.status.in_(["won", "lost"]),
        )
    )
    if (placement_done_q.scalar_one() or 0) >= 5:
        await _try_unlock("placement_complete")

    # ── Hardword hunter (beat 10 words with difficulty ≥ 1600) ─────────────
    hardword_q = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.user_id == user.id,
            Game.status == "won",
            Game.word_difficulty >= 1600,
        )
    )
    if (hardword_q.scalar_one() or 0) >= 10:
        await _try_unlock("hardword_hunter")

    # ── Hard mode (cumulative wins) ────────────────────────────────────────
    hard_wins_q = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.user_id == user.id,
            Game.status == "won",
            Game.hard_mode.is_(True),
        )
    )
    hard_wins = hard_wins_q.scalar_one() or 0
    if hard_wins >= 10:
        await _try_unlock("hardcore")
    if hard_wins >= 50:
        await _try_unlock("iron_will")

    # ── Challenge wins ─────────────────────────────────────────────────────
    challenge_wins_q = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.user_id == user.id,
            Game.status == "won",
            Game.mode == "challenge",
        )
    )
    if (challenge_wins_q.scalar_one() or 0) >= 10:
        await _try_unlock("challenge_winner")

    # ── Challenges created (sent to friends) ───────────────────────────────
    challenges_created_q = await db.execute(
        select(func.count())
        .select_from(Challenge)
        .where(Challenge.creator_id == user.id)
    )
    if (challenges_created_q.scalar_one() or 0) >= 5:
        await _try_unlock("trendsetter")

    # ── Per-game move-quality unlocks ──────────────────────────────────────
    if game.status == "won":
        # Brilliant: any move classified as brilliant
        brilliant_q = await db.execute(
            select(func.count())
            .select_from(Move)
            .where(Move.game_id == game.id, Move.classification == "brilliant")
        )
        if (brilliant_q.scalar_one() or 0) > 0:
            await _try_unlock("brilliant_play")

        # Flawless: no blunders or mistakes anywhere in the game
        bad_q = await db.execute(
            select(func.count())
            .select_from(Move)
            .where(
                Move.game_id == game.id,
                Move.classification.in_(["blunder", "mistake"]),
            )
        )
        if (bad_q.scalar_one() or 0) == 0:
            await _try_unlock("flawless")

        # Clean play: zero hard-mode constraint violations (hardness-aware).
        if (game.constraint_violations or 0) == 0:
            await _try_unlock("clean_play")

    # ── Timing ─────────────────────────────────────────────────────────────
    if game.status == "won" and game.time_seconds is not None:
        if game.time_seconds < 60:
            await _try_unlock("speedster")
        if game.time_seconds < 30:
            await _try_unlock("blitz")

    # Time-of-day windows — counted in UTC (server clock). Approximate but
    # honest: a player's "morning" varies by tz, so we just bucket on hour.
    if game.status == "won" and game.created_at is not None:
        early_q = await db.execute(
            select(func.count())
            .select_from(Game)
            .where(
                Game.user_id == user.id,
                Game.status == "won",
                func.extract("hour", Game.created_at) < 9,
            )
        )
        if (early_q.scalar_one() or 0) >= 10:
            await _try_unlock("early_bird")

        night_q = await db.execute(
            select(func.count())
            .select_from(Game)
            .where(
                Game.user_id == user.id,
                Game.status == "won",
                func.extract("hour", Game.created_at) >= 21,
            )
        )
        if (night_q.scalar_one() or 0) >= 10:
            await _try_unlock("night_owl")

    # ── Accuracy streak (5 in a row ≥ 85%) ─────────────────────────────────
    if game.accuracy_score is not None and game.accuracy_score >= 85:
        recent_q = await db.execute(
            select(Game.accuracy_score)
            .where(
                Game.user_id == user.id,
                Game.status.in_(["won", "lost"]),
                Game.accuracy_score.isnot(None),
            )
            .order_by(Game.completed_at.desc())
            .limit(5)
        )
        recents = recent_q.scalars().all()
        if len(recents) >= 5 and all(s is not None and s >= 85 for s in recents):
            await _try_unlock("accuracy_iron")

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
    {"type": "dedicated_100",     "name": "Centurion",      "description": "Play 100 games",                      "icon": "💯"},
    {"type": "marathon",          "name": "Marathon",       "description": "Play 200 games",                      "icon": "🏃"},
    {"type": "legend_500",        "name": "Legend",         "description": "Play 500 games",                      "icon": "🌟"},
    {"type": "triathlete",        "name": "Triathlete",     "description": "Play Daily, Competitive, & Practice", "icon": "🎲"},
    {"type": "all_modes_won",     "name": "Complete Set",   "description": "Win in every game mode",              "icon": "🃏"},
    {"type": "trendsetter",       "name": "Trendsetter",    "description": "Create 5 challenges",                  "icon": "📤"},
    {"type": "daily_devotee",     "name": "Daily Devotee",  "description": "Solve 30 daily puzzles",              "icon": "📆"},
    {"type": "daily_marathon",    "name": "Daily Marathon", "description": "Solve 100 daily puzzles",             "icon": "🗓️"},
    {"type": "three_master",      "name": "Three Master",   "description": "Win in exactly 3 guesses 25 times",   "icon": "3️⃣"},

    # ─── Mastery (analysis quality + hard mode) ─────────────────────────────
    {"type": "brilliant_play",    "name": "Brilliant",      "description": "Land a brilliant move in a win",      "icon": "🌠"},
    {"type": "flawless",          "name": "Flawless",       "description": "Win a game with no blunders or mistakes", "icon": "🪶"},
    {"type": "clean_play",        "name": "Clean Play",     "description": "Win a game with no constraint violations", "icon": "🧹"},
    {"type": "hardcore",          "name": "Hardcore",       "description": "Win 10 hard-mode games",              "icon": "🛡️"},
    {"type": "iron_will",         "name": "Iron Will",      "description": "Win 50 hard-mode games",              "icon": "⚒️"},
    {"type": "challenge_winner",  "name": "Challenge Master","description": "Win 10 challenges",                  "icon": "🤝"},
    {"type": "hardword_hunter",   "name": "Hardword Hunter","description": "Beat 10 words rated 1600+",            "icon": "🗡️"},
    {"type": "placement_complete","name": "Calibrated",     "description": "Finish all 5 placement games",        "icon": "🎓"},
    {"type": "accuracy_iron",     "name": "Iron Accuracy",  "description": "Score 85%+ in 5 games in a row",      "icon": "📐"},

    # ─── Timing ─────────────────────────────────────────────────────────────
    {"type": "speedster",         "name": "Speedster",      "description": "Win a game in under 60 seconds",      "icon": "⚡"},
    {"type": "blitz",             "name": "Blitz",          "description": "Win a game in under 30 seconds",      "icon": "💨"},
    {"type": "early_bird",        "name": "Early Bird",     "description": "Win 10 games before 9 AM",            "icon": "🌅"},
    {"type": "night_owl",         "name": "Night Owl",      "description": "Win 10 games after 9 PM",             "icon": "🌙"},
]
