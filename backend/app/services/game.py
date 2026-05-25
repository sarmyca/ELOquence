"""Game service — create games, process guesses, fetch game history."""
from __future__ import annotations

import asyncio
import hashlib
import logging
import random
import uuid
from datetime import date, datetime, timedelta, timezone

import httpx

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


def _create_game_lock_key(user_id: uuid.UUID, mode: str) -> int:
    """Stable 63-bit int derived from (user_id, mode) for advisory locks.

    Used to serialise concurrent `create_game` calls for the same player
    in the same mode: without it, N racing `POST /api/daily/play` requests
    each saw "no existing daily" and each created a fresh row, giving the
    player N parallel official daily attempts. Python's built-in ``hash``
    is per-process randomised, so we sha256 the inputs and truncate to
    the bigint signed-positive range PostgreSQL's `pg_advisory_xact_lock`
    expects.
    """
    digest = hashlib.sha256(f"{user_id}:{mode}".encode()).digest()
    return int.from_bytes(digest[:8], "big", signed=False) & 0x7FFFFFFFFFFFFFFF

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
    """Pick a word whose difficulty stays near the player's ELO.

    The word is drawn from a difficulty envelope around the player's rating
    (≈ ``elo-90`` … ``elo+125``), calibrated so the ELO delta distribution
    stays sensible: a loss costs rating and a 1-3 guess win gains it. A
    win/lose streak nudges difficulty *within* that envelope (winning →
    harder), but can no longer push words far enough away to invert the
    distribution the way the old ±200 base + ±200 streak window could (that
    let a word land ~400 ELO from the player, so even losing gained rating).

    Falls back to heuristic difficulty when no calibrated DB entry exists.

    Returns:
        (word, difficulty_elo) tuple.
    """
    # Difficulty envelope around the player's own rating. The offsets are
    # derived from the performance/expected model in services.elo so that,
    # at typical accuracy, X/6 stays negative and a 1-3 guess win stays
    # positive across the whole band.
    floor_elo = user_elo - 90.0
    ceil_elo = user_elo + 125.0
    # Streak still nudges difficulty, but damped (×0.35) and clamped into the
    # envelope rather than pushing the whole ±200 window off the player.
    shift = await _get_streak_shift(db, user_id, user_elo)
    center = min(ceil_elo, max(floor_elo, user_elo + shift * 0.35))
    lo = max(floor_elo, center - 80.0)
    hi = min(ceil_elo, center + 80.0)

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


def resolve_daily_date(local_date: str | None) -> date:
    """Resolve the puzzle date from a client-supplied local date (YYYY-MM-DD).

    Wordle-style: the daily word tracks the player's *local* calendar date, so
    everyone gets the same word for a given date but at their own midnight. The
    client date is trusted, clamped to ±1 day of the server's UTC date — any
    real timezone is within ±14h of UTC, so a legitimate local date can differ
    by at most one calendar day. Unparseable or out-of-range input falls back
    to the UTC date.
    """
    utc_today = datetime.now(timezone.utc).date()
    if not local_date:
        return utc_today
    try:
        d = date.fromisoformat(local_date)
    except (ValueError, TypeError):
        return utc_today
    return d if abs((d - utc_today).days) <= 1 else utc_today


async def _get_or_create_daily_word(
    db: AsyncSession, on_date: date | None = None
) -> tuple[str, float]:
    """Return the daily word for ``on_date`` (default: server UTC date),
    creating it if not yet assigned.

    Fetches the official NYT Wordle answer first; falls back to random
    if the API is unavailable.

    Returns:
        (word, difficulty_elo) tuple.
    """
    from app.analysis.engine import ANSWERS

    today = on_date or datetime.now(timezone.utc).date()
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
    daily_date: date | None = None,
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

    # Transaction-scoped advisory lock keyed on (user_id, mode). Forces
    # concurrent `create_game` calls for the same player+mode to serialise
    # — the second call blocks here until the first commits, then re-reads
    # the just-created row and returns it via the existing-game branches
    # downstream (in daily.py and play_challenge). Without this, racing
    # POSTs to /api/daily/play each saw "no existing daily" and each
    # created a separate row, giving the player parallel attempts at the
    # same puzzle.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:k)"),
        {"k": _create_game_lock_key(user.id, mode)},
    )

    # Abandon any in-progress games of the same mode for this user before
    # starting a new one. Route each through abandon_game() so rated
    # competitive games get the proper ELO penalty (X/6-equivalent loss).
    # A naive bulk UPDATE here would leave the cheese vector "close tab on
    # losing rated game, start a fresh competitive, no ELO lost" wide open.
    # Scope is intentionally same-mode only: a user mid-competitive who
    # opens a daily/practice shouldn't be penalized for switching modes.
    stale = await db.execute(
        select(Game).where(
            Game.user_id == user.id,
            Game.mode == mode,
            Game.status == "in_progress",
        )
    )
    for stale_game in stale.scalars().all():
        await abandon_game(db, stale_game.id, user)

    if mode == "daily":
        target_word, difficulty = await _get_or_create_daily_word(db, daily_date)
        # Only one non-abandoned daily game per user per puzzle. Match on
        # target_word (the word for the player's local date) plus a recent
        # window, so an archive-replay of a word that happens to repeat from
        # long ago doesn't block today's daily. A 36h window safely covers the
        # current local day for any timezone without a brittle UTC-vs-local
        # date comparison.
        recent_cutoff = datetime.now(timezone.utc) - timedelta(hours=36)
        existing = await db.execute(
            select(Game).where(
                Game.user_id == user.id,
                Game.mode == "daily",
                Game.target_word == target_word,
                Game.created_at >= recent_cutoff,
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
    local_date: str | None = None,
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

    # Load game with moves — row-level lock to serialize concurrent guesses.
    # Without `with_for_update()`, two simultaneous /guess POSTs both pass the
    # `status == 'in_progress'` check on stale snapshots and both insert Move
    # rows; the attacker pumps N concurrent guesses per "slot," extracting
    # pattern info without consuming a guess budget. The FOR UPDATE locks the
    # Game row until commit, forcing the second call to wait, observe the
    # post-first-guess state, and either continue legitimately or reject with
    # 409 if the first guess completed the game.
    #
    # Guest games (user_id IS NULL) are intentionally NOT accessible here —
    # the `/api/daily/guest/{id}/guess` endpoint handles those with its own
    # query. Previously this filter allowed any authed user to submit on any
    # guest game (IDOR), enabling cross-account play and sacrificial-guest
    # solving to learn the daily answer.
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == user.id)
        .with_for_update()
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

    # Snapshot prior-move data BEFORE inserting the new move so
    # analyze_single_move replays state from a clean prior set.
    prior_moves_data = [
        {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]

    move = Move(
        id=uuid.uuid4(),
        game_id=game.id,
        move_number=move_number,
        guess_word=guess,
        pattern=pattern,
    )
    db.add(move)

    # ── Per-guess analysis ─────────────────────────────────────────────
    # Each move is analysed at submission and persisted on its Move row.
    # Doing it here (rather than retroactively for every move on game
    # completion) amortises the cost — most of which is hidden inside the
    # client's flip animation — so the winning guess no longer pays the
    # spike of analysing every prior move all at once.
    try:
        from app.analysis.incremental import analyze_single_move

        move_analysis = await asyncio.to_thread(
            analyze_single_move,
            prior_moves_data,
            guess,
            pattern,
            move_number,
            game.target_word,
            competitive=game.mode == "competitive",
        )
        move.remaining_words = move_analysis["remaining_words"]
        move.entropy_before = move_analysis["entropy_before"]
        move.entropy_after = move_analysis["entropy_after"]
        move.info_gained = move_analysis["info_gained"]
        move.optimal_info = move_analysis["optimal_info"]
        move.optimal_word = move_analysis["optimal_word"]
        move.expected_remaining = move_analysis["expected_remaining"]
        move.optimal_expected_remaining = move_analysis["optimal_expected_remaining"]
        move.efficiency_ratio = move_analysis["efficiency_ratio"]
        move.bits_lost = move_analysis["bits_lost"]
        move.classification = move_analysis["classification"]
        move.constraint_violation = move_analysis["constraint_violation"]
        move.trap_detected = move_analysis["trap_detected"]
        move.is_book_move = move_analysis["is_book_move"]
    except Exception as exc:
        # Per-move analysis must never block the game flow — the move is
        # still recorded; analysis fields just stay NULL for this row.
        _log.warning("analyze_single_move failed for game %s move %s: %s", game.id, move_number, exc)

    game.num_guesses = move_number
    won = pattern == 242  # all greens: 2+2*3+2*9+2*27+2*81 = 242

    if won:
        game.status = "won"
        game.completed_at = datetime.now(timezone.utc)
    elif move_number >= 6:
        game.status = "lost"
        game.completed_at = datetime.now(timezone.utc)

    # Stamp the grid fingerprint on completion so the uniqueness analytic
    # can count how many other players solved this same (target, guesses).
    if game.status in ("won", "lost"):
        from app.services.uniqueness import compute_move_fingerprint

        existing_nums_for_fp = {m.move_number for m in game.moves}
        completed_moves_for_fp = sorted(
            [*game.moves] + ([move] if move.move_number not in existing_nums_for_fp else []),
            key=lambda m: m.move_number,
        )
        game.move_fingerprint = compute_move_fingerprint(
            game.target_word,
            [m.guess_word for m in completed_moves_for_fp],
        )

    await db.flush()

    # Run completion side-effects for every finished game (won|lost).
    # Only the ELO update inside this block is gated on `game.rated` —
    # streaks, word stats, achievements and profile refresh run for every
    # completion (so unrated daily games still update streaks).
    if game.status in ("won", "lost"):
        # Game-level analysis aggregates derived from per-move data that
        # analyze_single_move already wrote. No fresh analysis pass.
        try:
            from app.analysis.incremental import aggregate_completion_metrics

            # Same convention as the prior code: `move` was added via db.add
            # but back-population into game.moves only happens after refresh,
            # so we union explicitly.
            existing_nums = {m.move_number for m in game.moves}
            all_completed_moves = sorted(
                [*game.moves] + ([move] if move.move_number not in existing_nums else []),
                key=lambda m: m.move_number,
            )
            metrics = aggregate_completion_metrics(all_completed_moves)
            accuracy = metrics["accuracy_score"]
            game.accuracy_score = accuracy
            game.luck_factor = metrics["luck_factor"]
            game.constraint_violations = metrics["constraint_violations"]
            game.traps_encountered = metrics["traps_encountered"]
        except Exception as exc:
            _log.warning("aggregate_completion_metrics failed for game %s: %s", game.id, exc)
            accuracy = 50.0

        # Update daily streak BEFORE ELO update. Only the player's CURRENT
        # daily counts toward the streak (won extends, lost resets), regardless
        # of rated. Archive replays carry mode="daily" too but target a PAST
        # puzzle word — counting them would let a player inflate
        # `current_streak` just by replaying old puzzles on consecutive real
        # days, so they're excluded by requiring the game's word to match the
        # daily word for the player's date. "Today" is the player's LOCAL date
        # (Wordle-style), resolved from the client clock, so finishing past
        # local midnight (but before UTC midnight) still credits the streak.
        if game.mode == "daily":
            player_today = resolve_daily_date(local_date)
            today_dw = (
                await db.execute(
                    select(DailyWord).where(DailyWord.date == player_today)
                )
            ).scalar_one_or_none()
            is_todays_daily = (
                today_dw is not None
                and game.target_word is not None
                and game.target_word.upper() == today_dw.word.upper()
            )
            if is_todays_daily:
                update_daily_streak(user, won=won, on_date=player_today)

        if game.rated:
            await apply_elo_update(
                db=db,
                user=user,
                game=game,
                accuracy=accuracy,
            )

        # Recalculate player profile — must not block game completion.
        # Wrapped in SAVEPOINT so a failure (e.g., schema drift) doesn't
        # poison the outer transaction and stop the user from completing.
        try:
            from app.services.profile import recalculate_profile

            async with db.begin_nested():
                await recalculate_profile(db, user.id)
        except Exception as exc:
            _log.warning("recalculate_profile failed for game %s: %s", game.id, exc)

        # Update community word statistics — must not block game completion
        try:
            from app.services.word_stats import update_word_stats

            async with db.begin_nested():
                await update_word_stats(db, game.target_word, game.num_guesses, won, accuracy)
        except Exception as exc:
            _log.warning("update_word_stats failed for game %s: %s", game.id, exc)

        # Check and unlock achievements — must not block game completion
        try:
            from app.services.achievements import check_and_unlock

            async with db.begin_nested():
                newly_unlocked = await check_and_unlock(db, user, game)
        except Exception as exc:
            _log.warning("check_and_unlock failed for game %s: %s", game.id, exc)
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
