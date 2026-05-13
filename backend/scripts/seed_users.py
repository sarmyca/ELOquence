"""Seed the database with faux users, game histories, and ELO records.

Usage (run from backend container or with backend venv):
    python -m scripts.seed_users

Or via docker:
    docker compose exec backend python -m scripts.seed_users
"""
from __future__ import annotations

import asyncio
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from passlib.context import CryptContext

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NUM_USERS = 30
GAMES_PER_USER = (8, 35)       # random range of games each user has played
DEFAULT_PASSWORD = "password1"  # all faux users share this password

# Skill profiles — determines win rate and guess distribution
PROFILES = [
    # (name, weight, elo_range, win_rate, avg_guesses, streak_range)
    ("beginner",  0.30, (700, 1100),  (0.55, 0.72), (4.5, 5.2), (0, 3)),
    ("average",   0.35, (1050, 1300), (0.70, 0.82), (3.8, 4.4), (1, 6)),
    ("skilled",   0.25, (1250, 1500), (0.80, 0.92), (3.2, 3.9), (2, 10)),
    ("expert",    0.10, (1450, 1700), (0.88, 0.96), (2.8, 3.5), (4, 15)),
]

USERNAMES = [
    "wordsmith42", "puzzlequeen", "letterboxer", "vowelhunter", "greenflash",
    "fiveLetters", "guessmaster", "cranetactic", "saletfan", "adieuplayer",
    "entropyboss", "bitcruncher", "infotheory", "yellowchaser", "grayzone",
    "trapescaper", "endgamepro", "openingbook", "streakking", "elogrinder",
    "dailydriver", "nightowl_w", "morningword", "quicksolve", "slowsteady",
    "patternseek", "heatmaplord", "graphwalker", "coachfan", "placements",
    "trialgamer", "boldguess", "safepick", "riskrunner", "cluehunter",
    "freqanalyst", "dupletter", "consonant5", "vowelstack", "silentE",
]

COMMON_OPENERS = [
    "SALET", "CRANE", "SLATE", "TRACE", "ADIEU", "AUDIO", "RAISE",
    "ARISE", "STARE", "IRATE", "ROATE", "CRATE", "LEAST", "STORE",
]

CLASSIFICATIONS = ["brilliant", "best", "good", "okay", "inaccuracy", "mistake", "blunder"]
PHASES = ["opening", "midgame", "endgame"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def pick_profile() -> tuple:
    r = random.random()
    cumulative = 0.0
    for name, weight, *rest in PROFILES:
        cumulative += weight
        if r <= cumulative:
            return (name, weight, *rest)
    return PROFILES[-1]


def rand_between(lo: float, hi: float) -> float:
    return lo + random.random() * (hi - lo)


def encode_pattern(guess: str, target: str) -> int:
    """Encode a Wordle pattern as a ternary integer (matches the Move model)."""
    pattern = [0] * 5
    target_chars = list(target)

    # First pass: greens
    for i in range(5):
        if guess[i] == target[i]:
            pattern[i] = 2
            target_chars[i] = ""

    # Second pass: yellows
    for i in range(5):
        if pattern[i] == 0 and guess[i] in target_chars:
            pattern[i] = 1
            target_chars[target_chars.index(guess[i])] = ""

    return sum(v * (3 ** i) for i, v in enumerate(pattern))


def simulate_game(
    target: str,
    words: list[str],
    profile_name: str,
    win_rate: float,
    avg_guesses: float,
) -> tuple[str, list[tuple[str, int]]]:
    """Simulate a game and return (status, [(guess, pattern_int), ...])."""
    won = random.random() < win_rate

    if won:
        # Number of guesses — weighted around avg_guesses
        n = max(1, min(6, round(random.gauss(avg_guesses, 0.7))))
    else:
        n = 6

    guesses: list[tuple[str, int]] = []

    for move_i in range(n):
        if move_i == 0:
            # Use a common opener
            guess = random.choice(COMMON_OPENERS)
        elif won and move_i == n - 1:
            # Final guess is the answer
            guess = target
        else:
            # Random word from the pool
            guess = random.choice(words[:500]).upper()

        pat = encode_pattern(guess, target)
        guesses.append((guess, pat))

    status = "won" if won else "lost"
    return status, guesses


# ---------------------------------------------------------------------------
# Main seeder
# ---------------------------------------------------------------------------

async def seed():
    # Import here so the script can be parsed without the full app context
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Load word list
    answers_path = Path(__file__).resolve().parent.parent / "data" / "answers.txt"
    words = [w.strip().upper() for w in open(answers_path) if w.strip()]

    password_hash = pwd_ctx.hash(DEFAULT_PASSWORD)

    async with SessionLocal() as session:
        # Check how many faux users already exist
        result = await session.execute(
            text("SELECT COUNT(*) FROM users WHERE email LIKE '%@eloquence.fake'")
        )
        existing = result.scalar()
        if existing and existing > 0:
            print(f"Already {existing} faux users in DB. Skipping seed.")
            await engine.dispose()
            return

        print(f"Seeding {NUM_USERS} faux users...")

        usernames_pool = random.sample(USERNAMES, min(NUM_USERS, len(USERNAMES)))

        for idx in range(NUM_USERS):
            username = usernames_pool[idx] if idx < len(usernames_pool) else f"player{idx:03d}"
            email = f"{username}@eloquence.fake"
            profile_name, _, elo_range, win_range, guess_range, streak_range = pick_profile()

            target_elo = rand_between(*elo_range)
            win_rate = rand_between(*win_range)
            avg_guesses = rand_between(*guess_range)
            num_games = random.randint(*GAMES_PER_USER)

            user_id = uuid.uuid4()
            games_played = 0
            current_elo = 1000.0
            current_streak = 0
            max_streak = 0
            is_placement = True

            # Create user
            created_days_ago = random.randint(5, 60)
            user_created = datetime.now(timezone.utc) - timedelta(days=created_days_ago)

            await session.execute(
                text("""
                    INSERT INTO users (id, email, username, password_hash,
                        elo_rating, games_played, is_placement,
                        current_streak, max_streak, last_played_date,
                        is_admin, created_at)
                    VALUES (:id, :email, :username, :pw,
                        :elo, :gp, :placement,
                        :cs, :ls, :lpd,
                        false, :created)
                """),
                {
                    "id": user_id, "email": email, "username": username,
                    "pw": password_hash, "elo": 1000.0, "gp": 0,
                    "placement": True, "cs": 0, "ls": 0, "lpd": None,
                    "created": user_created,
                },
            )

            # Simulate games
            elo_history_rows = []
            last_played = None

            for g_idx in range(num_games):
                game_id = uuid.uuid4()
                target_word = random.choice(words)
                mode = random.choices(
                    ["competitive", "daily", "practice"],
                    weights=[0.55, 0.25, 0.20],
                )[0]
                rated = mode != "practice"
                is_placement_game = rated and games_played < 5

                game_time_offset = created_days_ago - int(
                    (g_idx / max(num_games - 1, 1)) * (created_days_ago - 1)
                )
                game_created = datetime.now(timezone.utc) - timedelta(
                    days=game_time_offset,
                    hours=random.randint(0, 12),
                    minutes=random.randint(0, 59),
                )
                game_completed = game_created + timedelta(
                    seconds=random.randint(45, 420)
                )
                game_date = game_created.date()

                status, moves = simulate_game(
                    target_word, words, profile_name, win_rate, avg_guesses,
                )

                # Compute ELO delta (simplified)
                elo_before = current_elo
                if rated:
                    word_elo = rand_between(800, 1500)
                    expected = 1.0 / (1.0 + 10.0 ** ((word_elo - current_elo) / 400.0))
                    perf = rand_between(0.6, 1.0) if status == "won" else rand_between(0.0, 0.35)
                    k = 128.0 if is_placement_game else 32.0
                    delta = round(k * (perf - expected))
                    current_elo = max(100.0, current_elo + delta)
                    games_played += 1
                else:
                    delta = 0
                    word_elo = rand_between(800, 1200)

                # Streaks
                if status == "won":
                    current_streak += 1
                    max_streak = max(max_streak, current_streak)
                else:
                    current_streak = 0

                last_played = game_date
                accuracy = rand_between(40, 95) if status == "won" else rand_between(10, 45)

                # Insert game
                await session.execute(
                    text("""
                        INSERT INTO games (id, user_id, mode, target_word, word_difficulty,
                            status, num_guesses, time_seconds, rated,
                            accuracy_score, elo_before, elo_after, elo_delta,
                            is_placement, constraint_violations, traps_encountered,
                            created_at, completed_at)
                        VALUES (:id, :uid, :mode, :tw, :wd,
                            :status, :ng, :ts, :rated,
                            :acc, :eb, :ea, :ed,
                            :ip, :cv, :te,
                            :ca, :coa)
                    """),
                    {
                        "id": game_id, "uid": user_id, "mode": mode,
                        "tw": target_word, "wd": word_elo,
                        "status": status, "ng": len(moves),
                        "ts": random.randint(45, 420), "rated": rated,
                        "acc": round(accuracy, 1),
                        "eb": round(elo_before, 1),
                        "ea": round(current_elo, 1),
                        "ed": delta,
                        "ip": is_placement_game,
                        "cv": random.choices([0, 0, 0, 1, 2], weights=[50, 20, 10, 5, 2])[0],
                        "te": random.choices([0, 0, 1], weights=[80, 15, 5])[0],
                        "ca": game_created, "coa": game_completed,
                    },
                )

                # Insert moves
                for m_idx, (guess, pat_int) in enumerate(moves):
                    is_last = m_idx == len(moves) - 1
                    phase = PHASES[min(m_idx, 2)] if len(moves) <= 3 else (
                        "opening" if m_idx == 0 else "endgame" if is_last else "midgame"
                    )

                    # Classification weighted by profile
                    if is_last and status == "won":
                        classification = "forced" if len(moves) <= 2 else random.choice(["best", "good", "brilliant"])
                    elif profile_name == "expert":
                        classification = random.choices(
                            CLASSIFICATIONS, weights=[8, 30, 25, 15, 10, 5, 2]
                        )[0]
                    elif profile_name == "skilled":
                        classification = random.choices(
                            CLASSIFICATIONS, weights=[4, 20, 30, 20, 12, 8, 3]
                        )[0]
                    elif profile_name == "average":
                        classification = random.choices(
                            CLASSIFICATIONS, weights=[2, 10, 20, 25, 20, 15, 5]
                        )[0]
                    else:
                        classification = random.choices(
                            CLASSIFICATIONS, weights=[1, 5, 12, 20, 25, 22, 10]
                        )[0]

                    entropy_before = max(0, 11.2 - m_idx * rand_between(2.0, 3.5))
                    info_gained = rand_between(1.5, 4.5) if m_idx < len(moves) - 1 else entropy_before
                    entropy_after = max(0, entropy_before - info_gained)
                    optimal_info = info_gained + rand_between(0, 0.8)
                    efficiency = min(1.15, info_gained / max(optimal_info, 0.01))

                    await session.execute(
                        text("""
                            INSERT INTO moves (id, game_id, move_number, guess_word, pattern,
                                remaining_words, entropy_before, entropy_after,
                                info_gained, optimal_info, efficiency_ratio, bits_lost,
                                classification, game_phase, constraint_violation,
                                trap_detected, is_book_move, created_at)
                            VALUES (:id, :gid, :mn, :gw, :pat,
                                :rw, :eb, :ea,
                                :ig, :oi, :er, :bl,
                                :cls, :gp, :cv,
                                :td, :bm, :ca)
                        """),
                        {
                            "id": uuid.uuid4(), "gid": game_id,
                            "mn": m_idx + 1, "gw": guess, "pat": pat_int,
                            "rw": max(1, int(2309 / (3 ** (m_idx + 1)) * rand_between(0.5, 1.5))),
                            "eb": round(entropy_before, 2),
                            "ea": round(entropy_after, 2),
                            "ig": round(info_gained, 2),
                            "oi": round(optimal_info, 2),
                            "er": round(efficiency, 3),
                            "bl": round(max(0, optimal_info - info_gained), 2),
                            "cls": classification,
                            "gp": phase,
                            "cv": random.choices(["none", "none", "none", "soft", "hard"], weights=[70, 15, 5, 5, 2])[0],
                            "td": random.random() < 0.05,
                            "bm": m_idx == 0,
                            "ca": game_created + timedelta(seconds=m_idx * random.randint(8, 60)),
                        },
                    )

                # ELO history for rated games
                if rated and delta != 0:
                    elo_history_rows.append({
                        "id": uuid.uuid4(), "uid": user_id, "gid": game_id,
                        "eb": round(elo_before, 1), "ea": round(current_elo, 1),
                        "delta": delta, "acc": round(accuracy, 1),
                        "ra": game_completed,
                    })

            # Nudge final ELO toward target range
            # (the simulation drifts randomly, so we adjust)
            elo_adjust = target_elo - current_elo
            current_elo = round(target_elo + rand_between(-50, 50))
            current_elo = max(100, current_elo)

            # Update user with final stats
            is_placement = games_played < 5
            await session.execute(
                text("""
                    UPDATE users SET
                        elo_rating = :elo,
                        games_played = :gp,
                        is_placement = :placement,
                        current_streak = :cs,
                        max_streak = :ls,
                        last_played_date = :lpd
                    WHERE id = :id
                """),
                {
                    "id": user_id, "elo": current_elo, "gp": games_played,
                    "placement": is_placement, "cs": current_streak,
                    "ls": max_streak, "lpd": last_played,
                },
            )

            # Bulk insert ELO history
            for eh in elo_history_rows:
                await session.execute(
                    text("""
                        INSERT INTO elo_history (id, user_id, game_id,
                            elo_before, elo_after, delta, accuracy_score, recorded_at)
                        VALUES (:id, :uid, :gid, :eb, :ea, :delta, :acc, :ra)
                    """),
                    eh,
                )

            tier = (
                "Grandmaster" if current_elo >= 1600 else
                "Master" if current_elo >= 1400 else
                "Veteran" if current_elo >= 1200 else
                "Novice"
            )
            print(f"  {username:20s}  {tier:14s}  ELO {current_elo:>6.0f}  {games_played:>2d} games  ({profile_name})")

        await session.commit()
        print(f"\nDone! Seeded {NUM_USERS} users with game histories.")
        print(f"All users share password: {DEFAULT_PASSWORD}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
