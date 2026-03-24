"""Player profile service — aggregate per-player statistics after each game.

The main entry point is :func:`recalculate_profile`, which is called from
``services.game.submit_guess`` after a game completes.  It runs inside a
try/except so that profile update failures never block the game response.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def recalculate_profile(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Recompute aggregated player statistics and persist them.

    This function is idempotent — it upserts the single ``PlayerProfile`` row
    that belongs to the given user.

    Stats computed:
    - ``total_games`` / ``total_wins`` from all finished games.
    - ``avg_accuracy`` across all games that have an accuracy score.
    - ``avg_accuracy_opening/midgame/endgame`` from per-move game-phase data.
    - ``favorite_openers`` — top-5 most-used first words (last 100 games).
    - ``constraint_violation_rate`` — violations / total guesses.
    - ``accuracy_trend_30d`` — linear regression slope over the last 30
      accuracy readings (positive = improving).
    - ``elo_trend_30d`` — slope over the last 30 ELO-after readings.

    Args:
        db: Active async SQLAlchemy session.  The caller is responsible for
            committing.
        user_id: UUID of the player whose profile should be refreshed.
    """
    from app.models.game import Game
    from app.models.move import Move
    from app.models.player_profile import PlayerProfile

    # ------------------------------------------------------------------
    # Get or create profile row
    # ------------------------------------------------------------------
    result = await db.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = PlayerProfile(id=uuid.uuid4(), user_id=user_id)
        db.add(profile)

    # ------------------------------------------------------------------
    # Fetch all completed games ordered newest-first
    # ------------------------------------------------------------------
    games_result = await db.execute(
        select(Game)
        .where(
            Game.user_id == user_id,
            Game.status.in_(["won", "lost"]),
        )
        .order_by(Game.created_at.desc())
    )
    all_games = list(games_result.scalars().all())

    profile.total_games = len(all_games)
    # A "win" = gained ELO (positive elo_delta), not just status == "won"
    profile.total_wins = sum(
        1 for g in all_games if g.elo_delta is not None and g.elo_delta > 0
    )

    # ------------------------------------------------------------------
    # Average accuracy (overall)
    # ------------------------------------------------------------------
    accuracies = [g.accuracy_score for g in all_games if g.accuracy_score is not None]
    profile.avg_accuracy = sum(accuracies) / len(accuracies) if accuracies else None

    # ------------------------------------------------------------------
    # Per-phase accuracy averages
    # ------------------------------------------------------------------
    opening_accs: list[float] = []
    midgame_accs: list[float] = []
    endgame_accs: list[float] = []

    for game in all_games[:50]:  # Limit to last 50 for performance
        moves_result = await db.execute(
            select(Move).where(Move.game_id == game.id)
        )
        game_moves = list(moves_result.scalars().all())
        for m in game_moves:
            if m.efficiency_ratio is None or m.classification == "forced":
                continue
            eff = m.efficiency_ratio * 100
            if m.game_phase == "opening":
                opening_accs.append(eff)
            elif m.game_phase == "midgame":
                midgame_accs.append(eff)
            elif m.game_phase == "endgame":
                endgame_accs.append(eff)

    profile.avg_accuracy_opening = (
        sum(opening_accs) / len(opening_accs) if opening_accs else None
    )
    profile.avg_accuracy_midgame = (
        sum(midgame_accs) / len(midgame_accs) if midgame_accs else None
    )
    profile.avg_accuracy_endgame = (
        sum(endgame_accs) / len(endgame_accs) if endgame_accs else None
    )

    # ------------------------------------------------------------------
    # Favorite openers — top-5 first words from last 100 games
    # ------------------------------------------------------------------
    opener_counts: dict[str, int] = {}
    for game in all_games[:100]:
        opener_result = await db.execute(
            select(Move).where(Move.game_id == game.id, Move.move_number == 1)
        )
        first_move = opener_result.scalar_one_or_none()
        if first_move:
            word = first_move.guess_word.upper()
            opener_counts[word] = opener_counts.get(word, 0) + 1

    profile.favorite_openers = dict(
        sorted(opener_counts.items(), key=lambda x: -x[1])[:5]
    )

    # ------------------------------------------------------------------
    # Constraint violation rate
    # ------------------------------------------------------------------
    total_violations = sum(g.constraint_violations for g in all_games)
    total_guesses = sum(g.num_guesses for g in all_games)
    profile.constraint_violation_rate = (
        total_violations / total_guesses if total_guesses > 0 else 0.0
    )

    # ------------------------------------------------------------------
    # Accuracy trend (linear slope over last 30 games)
    # ------------------------------------------------------------------
    recent_acc = accuracies[:30]
    if len(recent_acc) >= 5:
        profile.accuracy_trend_30d = _linear_slope(recent_acc)
    else:
        profile.accuracy_trend_30d = None

    # ------------------------------------------------------------------
    # ELO trend (slope over last 30 elo_after readings)
    # ------------------------------------------------------------------
    elo_series = [g.elo_after for g in all_games[:30] if g.elo_after is not None]
    if len(elo_series) >= 5:
        # Reverse so index 0 is oldest
        profile.elo_trend_30d = _linear_slope(list(reversed(elo_series)))
    else:
        profile.elo_trend_30d = None

    profile.last_updated = datetime.now(timezone.utc)
    await db.flush()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _linear_slope(values: list[float]) -> float:
    """Compute the ordinary-least-squares slope for an evenly-spaced series.

    Args:
        values: Sequence of numeric values (index acts as the x-axis).

    Returns:
        OLS slope.  Returns 0.0 if the denominator is zero.
    """
    n = len(values)
    x = list(range(n))
    mean_x = sum(x) / n
    mean_y = sum(values) / n
    numerator = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, values))
    denominator = sum((xi - mean_x) ** 2 for xi in x)
    return numerator / denominator if denominator != 0 else 0.0
