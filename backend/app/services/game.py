"""Game service — create games, process guesses, fetch game history."""
from __future__ import annotations

import logging
import random
import uuid
from datetime import date, datetime, timezone

import httpx

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.daily_word import DailyWord
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.models.word_stats import WordStats
from app.services.word_difficulty import word_to_elo


async def _get_word_pool(mode: str, pool_name: str) -> list[str]:
    """Return the answer word pool based on mode and pool name.

    Competitive mode uses the expanded pool (standard answers + extra
    competitive words).  All other modes use the standard 2,309 answers.
    """
    from app.analysis.engine import ANSWERS, COMPETITIVE_ANSWERS

    if not ANSWERS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Word lists not loaded.",
        )
    if mode == "competitive" and COMPETITIVE_ANSWERS:
        return COMPETITIVE_ANSWERS
    return ANSWERS


async def _get_streak_shift(db: AsyncSession, user_id, user_elo: float) -> float:
    """Compute a difficulty shift based on the player's recent ELO momentum.

    Looks at the last 5 rated competitive games.  Each consecutive positive-
    delta game shifts the target difficulty up by +40 ELO; each consecutive
    negative-delta game shifts it down by -40 ELO.  The shift is capped at
    ±200 so the total range stays within ±400 of the player's ELO at most.
    """
    result = await db.execute(
        select(Game.elo_delta)
        .where(
            Game.user_id == user_id,
            Game.mode == "competitive",
            Game.rated == True,  # noqa: E712
            Game.status.in_(["won", "lost"]),
            Game.elo_delta.isnot(None),
        )
        .order_by(Game.completed_at.desc())
        .limit(5)
    )
    deltas = [row[0] for row in result.all()]

    # Count the current streak direction from most recent game
    streak = 0
    for d in deltas:
        if d > 0:
            if streak >= 0:
                streak += 1
            else:
                break
        elif d < 0:
            if streak <= 0:
                streak -= 1
            else:
                break
        # d == 0 → neutral, breaks streak
        else:
            break

    # +40 ELO shift per streak game, capped at ±200
    return max(-200.0, min(200.0, streak * 40.0))


async def _pick_competitive_word(
    db: AsyncSession, user_id, user_elo: float, pool: list[str]
) -> tuple[str, float]:
    """Pick a word whose difficulty matches the player's ELO ± streak shift.

    The base range is ±200 ELO around the player's rating, shifted by up to
    ±200 based on winning/losing streak (positive streak → harder words,
    negative streak → easier words).

    Falls back to heuristic difficulty when no calibrated DB entry exists.

    Returns:
        (word, difficulty_elo) tuple.
    """
    shift = await _get_streak_shift(db, user_id, user_elo)
    center = user_elo + shift
    lo = center - 200
    hi = center + 200

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

    # Fallback: pick from pool using heuristic difficulty
    candidates = [(w, word_to_elo(w)) for w in pool if lo <= word_to_elo(w) <= hi]
    if not candidates:
        # Extreme ELO — pick from the closest 20 words by difficulty
        all_scored = [(w, word_to_elo(w)) for w in pool]
        all_scored.sort(key=lambda x: abs(x[1] - center))
        candidates = all_scored[:20]
    word, diff = random.choice(candidates)
    return word.upper(), diff


_NYT_WORDLE_URL = "https://www.nytimes.com/svc/wordle/v2/{date}.json"
_log = logging.getLogger(__name__)


async def _fetch_nyt_wordle(today: date) -> str | None:
    """Fetch today's official Wordle answer from the NYT API."""
    url = _NYT_WORDLE_URL.format(date=today.isoformat())
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()["solution"].upper()
    except Exception as exc:
        _log.warning("Failed to fetch NYT Wordle word: %s", exc)
        return None


async def _get_or_create_daily_word(db: AsyncSession) -> tuple[str, float]:
    """Return today's daily word, creating it if not yet assigned.

    Fetches the official NYT Wordle answer first; falls back to random
    if the API is unavailable.

    Returns:
        (word, difficulty_elo) tuple.
    """
    from app.analysis.engine import ANSWERS

    today = date.today()
    result = await db.execute(select(DailyWord).where(DailyWord.date == today))
    row = result.scalar_one_or_none()
    if row:
        return row.word.upper(), row.difficulty or word_to_elo(row.word)

    # Try to get the real NYT Wordle word; fall back to random
    word = await _fetch_nyt_wordle(today)
    if not word:
        _log.info("NYT API unavailable, falling back to random word")
        word = random.choice(ANSWERS).upper()

    difficulty = word_to_elo(word)
    daily = DailyWord(
        word=word.lower(),
        date=today,
        difficulty=difficulty,
    )
    db.add(daily)
    try:
        await db.flush()
    except IntegrityError:
        # Another request already inserted today's word — use it
        await db.rollback()
        result = await db.execute(select(DailyWord).where(DailyWord.date == today))
        row = result.scalar_one_or_none()
        if row:
            return row.word.upper(), row.difficulty or word_to_elo(row.word)
    return word, difficulty


async def create_game(
    db: AsyncSession,
    user: User,
    mode: str,
    word_pool: str = "standard",
    hard_mode: bool = False,
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

    # Abandon any in-progress games of the same mode for this user
    await db.execute(
        update(Game)
        .where(
            Game.user_id == user.id,
            Game.mode == mode,
            Game.status == "in_progress",
        )
        .values(status="abandoned")
    )

    if mode == "daily":
        target_word, difficulty = await _get_or_create_daily_word(db)
        # Only one non-abandoned daily game per user per puzzle. Match on
        # target_word so archive-replay games (which have created_at=today but
        # represent a past puzzle) don't block creation of today's real daily.
        existing = await db.execute(
            select(Game).where(
                Game.user_id == user.id,
                Game.mode == "daily",
                Game.target_word == target_word,
                func.date(Game.created_at) == date.today(),
                Game.status != "abandoned",
            )
        )
        if existing.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already played today's daily word.",
            )
    elif mode == "competitive":
        target_word, difficulty = await _pick_competitive_word(db, user.id, user.elo_rating, pool)
    else:
        # practice — random
        target_word = random.choice(pool).upper()
        difficulty = word_to_elo(target_word)

    rated = mode == "competitive"

    game = Game(
        id=uuid.uuid4(),
        user_id=user.id,
        mode=mode,
        target_word=target_word,
        word_difficulty=difficulty,
        status="in_progress",
        num_guesses=0,
        rated=rated,
        hard_mode=hard_mode,
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
    from app.services.elo import apply_elo_update, update_daily_streak

    # Validate word before touching the DB to avoid poisoning the session
    if not is_valid_word(guess):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{guess}' is not a valid word.",
        )

    # Load game with moves — allow guest games (user_id is None)
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(
            Game.id == game_id,
            (Game.user_id == user.id) | (Game.user_id.is_(None)),
        )
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if game.status != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Game is already {game.status}.",
        )

    # Hard mode: validate revealed hints are reused in subsequent guesses
    if game.hard_mode and game.moves:
        sorted_moves = sorted(game.moves, key=lambda m: m.move_number)
        for prev_move in sorted_moves:
            prev_guess = prev_move.guess_word
            p = prev_move.pattern
            # Decode ternary pattern: digit i = (p // 3**i) % 3
            # 2 = correct (green), 1 = present (yellow), 0 = absent
            for pos in range(5):
                val = (p // (3 ** pos)) % 3
                letter = prev_guess[pos]
                if val == 2 and guess[pos] != letter:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Hard mode: must reuse {letter}",
                    )
                if val == 1 and letter not in guess:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Hard mode: must reuse {letter}",
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

    # Run completion side-effects for every finished game (won|lost).
    # Only the ELO update inside this block is gated on `game.rated` —
    # analysis, streaks, word stats, achievements and profile refresh
    # run for every completion (so unrated daily games still update streaks).
    if game.status in ("won", "lost"):
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

            analysis = analyze_game(all_moves_data, game.target_word, competitive=game.mode == "competitive")
            accuracy = analysis["accuracy_score"]
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
                    db_move.constraint_violation = r["constraint_violation"]
                    db_move.trap_detected = r["trap_detected"]
                    db_move.is_book_move = r["is_book_move"]
        except Exception:
            # Analysis failure must not block game completion
            accuracy = 50.0

        # Update daily streak BEFORE ELO update — streak applies to every
        # completed daily game (won extends, lost resets), regardless of rated.
        if game.mode == "daily":
            update_daily_streak(user, won=won)

        if game.rated:
            await apply_elo_update(
                db=db,
                user=user,
                game=game,
                accuracy=accuracy,
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
    """Mark a game as abandoned.

    For rated games (competitive), this counts as a loss and applies an ELO
    penalty equivalent to an X/6 loss.  Unrated games are simply closed.

    Args:
        db: Active async session.
        game_id: UUID of the game to abandon.
        user: Authenticated player (must own the game).

    Returns:
        Updated Game record.
    """
    from app.services.elo import apply_elo_update

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

    # Rated games: count as a loss with 0 accuracy (X/6 equivalent)
    if game.rated:
        await apply_elo_update(
            db, user, game,
            accuracy=0.0,
        )
    else:
        game.rated = False

    await db.flush()
    return game
