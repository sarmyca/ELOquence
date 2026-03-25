"""ELO calculation and update service."""
import math
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.user import User

ELO_FLOOR = 100.0
PLACEMENT_GAMES = 5

# Time scoring: par time in seconds (60s = 1.0 score).
# Faster → higher score (capped at 1.0), slower → lower (floor 0.0).
TIME_PAR = 60.0


def _time_score(seconds: float | None) -> float:
    """Convert solve time into a 0-1 score.

    Uses a sigmoid-like curve centred on TIME_PAR:
      - 30s → ~0.85
      - 60s → 0.50 (par)
      - 120s → ~0.18
      - 300s+ → ~0.02
    """
    if seconds is None or seconds <= 0:
        return 0.5  # no data → neutral
    ratio = seconds / TIME_PAR
    # Logistic decay: 1 / (1 + ratio^2)
    return 1.0 / (1.0 + ratio * ratio)


def calculate_performance_score(
    accuracy: float,
    num_guesses: int,
    won: bool,
    time_seconds: float | None = None,
) -> float:
    """Combine accuracy, outcome, and time into a 0-1 performance score.

    Weights: accuracy 45%, outcome 35%, time 20%.

    Args:
        accuracy: Overall accuracy percentage (0-100).
        num_guesses: Number of guesses taken.
        won: Whether the game was won.
        time_seconds: Total solve time in seconds (None if unavailable).

    Returns:
        A float in [0, 1] representing the player's performance.
    """
    accuracy_component = accuracy / 100.0

    outcome_map = {1: 1.0, 2: 0.95, 3: 0.85, 4: 0.70, 5: 0.55, 6: 0.40}
    outcome_component = outcome_map.get(num_guesses, 0.0) if won else 0.0

    time_component = _time_score(time_seconds)

    score = (
        0.45 * accuracy_component
        + 0.35 * outcome_component
        + 0.20 * time_component
    )

    return score


def calculate_elo_delta(
    player_elo: float,
    word_elo: float,
    performance_score: float,
    is_placement: bool,
) -> float:
    """Compute ELO delta using expected score formula.

    Args:
        player_elo: Current player ELO.
        word_elo: Difficulty ELO of the target word.
        performance_score: Actual performance (0-1).
        is_placement: Whether this is a placement game (boosted K-factor).

    Returns:
        ELO delta (may be negative).
    """
    expected = 1.0 / (1.0 + 10.0 ** ((word_elo - player_elo) / 400.0))
    k = 128.0 if is_placement else 32.0
    return k * (performance_score - expected)


async def apply_elo_update(
    db: AsyncSession,
    user: User,
    game: Game,
    accuracy: float,
) -> None:
    """Calculate and persist ELO changes after a game completes.

    Also updates streak fields for daily games and flips ``is_placement``
    once the player has completed their first five rated games.

    Args:
        db: Active async database session.
        user: The user who played.
        game: The completed Game record.
        accuracy: Overall accuracy score (0-100).
    """
    if not game.rated:
        return

    word_elo = game.word_difficulty or 1200.0
    won = game.status == "won"
    is_placement = user.is_placement

    performance = calculate_performance_score(
        accuracy=accuracy,
        num_guesses=game.num_guesses,
        won=won,
        time_seconds=game.time_seconds if game.mode == "competitive" else None,
    )

    delta = calculate_elo_delta(
        player_elo=user.elo_rating,
        word_elo=word_elo,
        performance_score=performance,
        is_placement=is_placement,
    )

    elo_before = user.elo_rating
    elo_after = round(max(ELO_FLOOR, elo_before + delta))

    # Persist ELO change on the game record
    game.elo_before = elo_before
    game.elo_after = elo_after
    game.elo_delta = round(elo_after - elo_before)
    game.is_placement = is_placement
    game.accuracy_score = accuracy

    # Update user stats
    user.elo_rating = elo_after
    user.games_played += 1

    # Flip placement status after 5 rated games
    if user.games_played >= PLACEMENT_GAMES and user.is_placement:
        user.is_placement = False

    # Update streaks for daily games
    if game.mode == "daily":
        today = date.today()
        if user.last_played_date is None or user.last_played_date < today:
            if user.last_played_date is not None:
                delta_days = (today - user.last_played_date).days
                user.current_streak = (user.current_streak + 1) if delta_days == 1 else 1
            else:
                user.current_streak = 1
            user.max_streak = max(user.max_streak, user.current_streak)
            user.last_played_date = today

    # Write EloHistory record
    history_entry = EloHistory(
        id=uuid.uuid4(),
        user_id=user.id,
        game_id=game.id,
        elo_before=elo_before,
        elo_after=elo_after,
        delta=elo_after - elo_before,
        accuracy_score=accuracy,
    )
    db.add(history_entry)
