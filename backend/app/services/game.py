"""Game service — create games, process guesses, fetch game history."""
from __future__ import annotations

import random
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.daily_word import DailyWord
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.models.word_stats import WordStats
from app.services.word_difficulty import word_to_elo


async def _get_word_pool(mode: str, pool_name: str) -> list[str]:
    """Return the answer word pool based on mode and pool name."""
    from app.analysis.engine import ANSWERS

    if not ANSWERS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Word lists not loaded.",
        )
    return ANSWERS


async def _pick_competitive_word(
    db: AsyncSession, user_elo: float, pool: list[str]
) -> tuple[str, float]:
    """Pick a word whose difficulty ELO is within ±200 of the player's ELO.

    Falls back to a random word if no calibrated entry exists in the DB.

    Returns:
        (word, difficulty_elo) tuple.
    """
    lo = user_elo - 200
    hi = user_elo + 200

    result = await db.execute(
        select(WordStats)
        .where(
            WordStats.calibrated_difficulty >= lo,
            WordStats.calibrated_difficulty <= hi,
        )
        .order_by(func.random())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row and row.word.upper() in {w.upper() for w in pool}:
        return row.word.upper(), row.calibrated_difficulty  # type: ignore[return-value]

    # Fallback: pick random + compute on-the-fly difficulty
    word = random.choice(pool).upper()
    return word, word_to_elo(word)


async def _get_or_create_daily_word(db: AsyncSession) -> tuple[str, float]:
    """Return today's daily word, creating it if not yet assigned.

    Returns:
        (word, difficulty_elo) tuple.
    """
    from app.analysis.engine import ANSWERS

    today = date.today()
    result = await db.execute(select(DailyWord).where(DailyWord.date == today))
    row = result.scalar_one_or_none()
    if row:
        return row.word.upper(), row.difficulty or word_to_elo(row.word)

    # Auto-assign a word for today
    word = random.choice(ANSWERS).upper()
    difficulty = word_to_elo(word)
    daily = DailyWord(
        id=uuid.uuid4(),
        word=word.lower(),
        date=today,
        difficulty=difficulty,
    )
    db.add(daily)
    await db.flush()
    return word, difficulty


async def create_game(
    db: AsyncSession,
    user: User,
    mode: str,
    word_pool: str = "standard",
) -> Game:
    """Instantiate a new game and persist it.

    Args:
        db: Active async session.
        user: Authenticated player.
        mode: One of daily / competitive / practice.
        word_pool: 'standard' or 'competitive' (used for practice).

    Returns:
        Newly created Game ORM object.
    """
    from app.analysis.engine import ANSWERS

    pool = await _get_word_pool(mode, word_pool)

    if mode == "daily":
        target_word, difficulty = await _get_or_create_daily_word(db)
        # Only one daily game per user per day
        existing = await db.execute(
            select(Game).where(
                Game.user_id == user.id,
                Game.mode == "daily",
                func.date(Game.created_at) == date.today(),
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already played today's daily word.",
            )
    elif mode == "competitive":
        target_word, difficulty = await _pick_competitive_word(db, user.elo_rating, pool)
    else:
        # practice — random
        target_word = random.choice(pool).upper()
        difficulty = word_to_elo(target_word)

    rated = mode in ("competitive",)

    game = Game(
        id=uuid.uuid4(),
        user_id=user.id,
        mode=mode,
        target_word=target_word,
        word_difficulty=difficulty,
        status="in_progress",
        num_guesses=0,
        rated=rated,
        is_placement=user.is_placement,
        elo_before=user.elo_rating if rated else None,
        constraint_violations=0,
        traps_encountered=0,
    )
    db.add(game)
    await db.flush()
    # Ensure moves is loaded (empty for new games) so sync access
    # in _build_game_response doesn't trigger a lazy load.
    await db.refresh(game, ["moves"])
    return game


async def submit_guess(
    db: AsyncSession,
    game_id: uuid.UUID,
    guess: str,
    user: User,
) -> tuple[Game, Move]:
    """Validate a guess, compute its pattern, persist the move.

    Triggers ELO update on game completion for rated games.

    Args:
        db: Active async session.
        game_id: UUID of the target game.
        guess: 5-letter guess word (already uppercased by schema).
        user: Authenticated player.

    Returns:
        (updated Game, new Move) tuple.
    """
    from app.analysis.engine import ALL_WORDS, compute_pattern, is_valid_word
    from app.services.elo import apply_elo_update

    # Load game with moves
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if game.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Game is already {game.status}.",
        )

    if not is_valid_word(guess):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{guess}' is not a valid word.",
        )

    pattern = compute_pattern(guess, game.target_word)
    move_number = game.num_guesses + 1

    move = Move(
        id=uuid.uuid4(),
        game_id=game.id,
        move_number=move_number,
        guess_word=guess,
        pattern=pattern,
    )
    db.add(move)

    game.num_guesses = move_number
    won = pattern == 242  # all greens: 2+2*3+2*9+2*27+2*81 = 242

    if won:
        game.status = "won"
        game.completed_at = datetime.now(timezone.utc)
    elif move_number >= 6:
        game.status = "lost"
        game.completed_at = datetime.now(timezone.utc)

    await db.flush()

    # Trigger ELO update on completion for rated games
    if game.status in ("won", "lost") and game.rated:
        # Run quick analysis for accuracy calculation
        all_moves_data = [
            {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
            for m in sorted(game.moves, key=lambda m: m.move_number)
        ]
        # Include the new move we just created
        all_moves_data.append(
            {"guess_word": move.guess_word, "pattern": move.pattern, "move_number": move.move_number}
        )

        try:
            from app.analysis import analyze_game

            analysis = analyze_game(all_moves_data, game.target_word)
            accuracy = analysis["accuracy_score"]
            phase_accuracies = analysis["phase_accuracies"]
            game.accuracy_score = accuracy
            game.luck_factor = analysis["luck_factor"]
            game.constraint_violations = analysis["constraint_violations"]
            game.traps_encountered = analysis["traps_encountered"]

            # Persist per-move analysis
            move_results_by_num = {r["move_number"]: r for r in analysis["moves"]}
            all_db_moves = list(game.moves) + [move]
            for db_move in all_db_moves:
                r = move_results_by_num.get(db_move.move_number)
                if r:
                    db_move.remaining_words = r["remaining_words"]
                    db_move.entropy_before = r["entropy_before"]
                    db_move.entropy_after = r["entropy_after"]
                    db_move.info_gained = r["info_gained"]
                    db_move.optimal_info = r["optimal_info"]
                    db_move.optimal_word = r["optimal_word"]
                    db_move.expected_remaining = r["expected_remaining"]
                    db_move.optimal_expected_remaining = r["optimal_expected_remaining"]
                    db_move.efficiency_ratio = r["efficiency_ratio"]
                    db_move.bits_lost = r["bits_lost"]
                    db_move.classification = r["classification"]
                    db_move.game_phase = r["game_phase"]
                    db_move.constraint_violation = r["constraint_violation"]
                    db_move.trap_detected = r["trap_detected"]
                    db_move.is_book_move = r["is_book_move"]
        except Exception:
            # Analysis failure must not block game completion
            accuracy = 50.0
            phase_accuracies = {"opening": 50.0, "midgame": 50.0, "endgame": 50.0}

        await apply_elo_update(
            db=db,
            user=user,
            game=game,
            accuracy=accuracy,
            phase_accuracies=phase_accuracies,
        )

        # Recalculate player profile — must not block game completion
        try:
            from app.services.profile import recalculate_profile

            await recalculate_profile(db, user.id)
        except Exception:
            pass

        # Update community word statistics — must not block game completion
        try:
            from app.services.word_stats import update_word_stats

            await update_word_stats(db, game.target_word, game.num_guesses, won, accuracy)
        except Exception:
            pass

        # Check and unlock achievements — must not block game completion
        try:
            from app.services.achievements import check_and_unlock

            newly_unlocked = await check_and_unlock(db, user, game)
        except Exception:
            newly_unlocked = []

        # Attach as a transient attribute so the router can read it
        game._newly_unlocked = newly_unlocked  # type: ignore[attr-defined]

    await db.flush()
    await db.refresh(game, ["moves"])
    return game, move


async def get_game(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: User,
) -> Game:
    """Fetch a game with its moves.  Raises 404 if not found or not owned."""
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    return game


async def list_games(
    db: AsyncSession,
    user: User,
    page: int = 1,
    per_page: int = 20,
    mode: str | None = None,
) -> tuple[list[Game], int]:
    """Return a page of the user's games and the total count.

    Args:
        db: Active async session.
        user: Authenticated player.
        page: 1-based page number.
        per_page: Page size.
        mode: Optional filter by game mode.

    Returns:
        (games_list, total_count) tuple.
    """
    query = select(Game).options(selectinload(Game.moves)).where(Game.user_id == user.id)
    count_query = select(func.count()).select_from(Game).where(Game.user_id == user.id)

    if mode:
        query = query.where(Game.mode == mode)
        count_query = count_query.where(Game.mode == mode)

    query = query.order_by(Game.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)

    games_result = await db.execute(query)
    count_result = await db.execute(count_query)

    games = list(games_result.scalars().all())
    total = count_result.scalar_one()
    return games, total


async def abandon_game(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: User,
) -> Game:
    """Mark a game as abandoned without affecting ELO.

    Args:
        db: Active async session.
        game_id: UUID of the game to abandon.
        user: Authenticated player (must own the game).

    Returns:
        Updated Game record.
    """
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    if game.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot abandon a game with status '{game.status}'.",
        )
    game.status = "abandoned"
    game.completed_at = datetime.now(timezone.utc)
    game.rated = False  # no ELO impact
    await db.flush()
    return game
