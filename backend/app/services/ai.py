"""AI coach service — LLM-powered move explanations, game summaries, and chat.

All database-backed calls (Tier 1 and Tier 2) accept an ``AsyncSession`` so
they can be composed inside existing request handlers without opening extra
connections.

Tier 3 (coach chat) is synchronous because the Anthropic Python SDK performs a
blocking network call; callers must run it in a thread pool (``asyncio.to_thread``)
if they need to stay async.

Cache policy
------------
- Tier 1 (move explanation): 30-day TTL, keyed on remaining_words + guess +
  optimal + classification.
- Tier 2 (game summary): 30-day TTL, keyed on move-list MD5 + rounded ELO.
- Tier 3 (coach chat): NOT cached — conversational and ephemeral.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.ai_cache import AiCache

# ---------------------------------------------------------------------------
# Lazy Anthropic client
# ---------------------------------------------------------------------------

try:
    from anthropic import Anthropic as _Anthropic

    _anthropic_available = True
except ImportError:
    _anthropic_available = False

_client: object | None = None


def _get_client() -> "_Anthropic":  # type: ignore[name-defined]
    """Return a module-level singleton Anthropic client.

    Raises:
        RuntimeError: If the ``anthropic`` package is not installed or no API
            key is configured.
    """
    global _client
    if not _anthropic_available:
        raise RuntimeError("anthropic package is not installed.")
    if not settings.ANTHROPIC_API_KEY:
        raise RuntimeError("AI features unavailable — no API key configured.")
    if _client is None:
        _client = _Anthropic(api_key=settings.ANTHROPIC_API_KEY)  # type: ignore[operator]
    return _client  # type: ignore[return-value]


def _ai_available() -> bool:
    """Return True when AI features can be used."""
    return _anthropic_available and bool(settings.ANTHROPIC_API_KEY)


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_key(tier: int, *parts: str) -> str:
    """Build a deterministic, URL-safe cache key from content parts.

    Args:
        tier: Tier level (1 or 2).
        *parts: Arbitrary string fields that uniquely identify the request.

    Returns:
        64-character lowercase hex digest.
    """
    raw = f"t{tier}:" + "|".join(parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:64]


async def get_cached(db: AsyncSession, key: str) -> str | None:
    """Look up a non-expired cache entry by key.

    Args:
        db: Active async SQLAlchemy session.
        key: Cache key produced by :func:`_cache_key`.

    Returns:
        Cached response text, or ``None`` if not found / expired.
    """
    result = await db.execute(
        select(AiCache).where(
            AiCache.cache_key == key,
            AiCache.expires_at > datetime.now(timezone.utc),
        )
    )
    row = result.scalar_one_or_none()
    return row.response_text if row else None


async def set_cache(
    db: AsyncSession,
    key: str,
    tier: int,
    text: str,
    ttl_days: int = 30,
) -> None:
    """Persist a new cache entry.

    Does not flush/commit — the caller's session boundary handles that.

    Args:
        db: Active async SQLAlchemy session.
        key: Cache key.
        tier: Tier level for audit purposes.
        text: LLM response to cache.
        ttl_days: Lifetime in days (default 30).
    """
    entry = AiCache(
        id=uuid.uuid4(),
        cache_key=key,
        tier=tier,
        response_text=text,
        expires_at=datetime.now(timezone.utc) + timedelta(days=ttl_days),
    )
    db.add(entry)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

COACH_SYSTEM = (
    "You are ELOquence Coach, an expert Wordle strategist with deep knowledge"
    " of information theory.\n"
    "You analyze Wordle games using entropy, expected information, and partition"
    " balance.\n"
    "You explain strategy in clear, engaging language adapted to the player's"
    " skill level.\n"
    "You never compute entropy yourself — you interpret pre-computed analysis"
    " data.\n"
    "When a player asks about a move, reference specific numbers (efficiency %,"
    " bits lost, remaining words).\n"
    "Be encouraging but honest. Celebrate good moves, explain mistakes without"
    " judgment.\n"
    "Keep responses concise (2-4 sentences for move explanations, 3-5 for"
    " summaries)."
)


def _skill_level(player_elo: float) -> str:
    if player_elo < 1000:
        return "beginner"
    if player_elo < 1400:
        return "intermediate"
    return "expert"


def _skill_instruction(level: str) -> str:
    if level == "beginner":
        return "Use simple language and focus on practical tips."
    if level == "expert":
        return "Use information-theoretic terms where helpful."
    return "Balance practical advice with some technical detail."


# ---------------------------------------------------------------------------
# Tier 1 — Move explanation
# ---------------------------------------------------------------------------

async def explain_move(
    db: AsyncSession,
    move_data: dict,
    player_elo: float,
) -> str:
    """Generate an AI explanation for a single move.

    Results are cached for 30 days keyed on position state + guess + optimal
    word + classification, so identical positions across different games share
    the same response.

    Args:
        db: Active async session (used for cache read/write).
        move_data: Dict with keys matching the analysis move schema.
        player_elo: Player's current ELO rating.

    Returns:
        Human-readable explanation string.

    Raises:
        RuntimeError: Propagated if AI is not available.
    """
    key = _cache_key(
        1,
        str(move_data.get("remaining_words", 0)),
        move_data.get("guess_word", ""),
        move_data.get("optimal_word", ""),
        move_data.get("classification", ""),
    )
    cached = await get_cached(db, key)
    if cached:
        return cached

    level = _skill_level(player_elo)
    prompt = (
        "[MOVE_DATA]\n"
        f"Guess: {move_data.get('guess_word', '?')}\n"
        f"Optimal guess: {move_data.get('optimal_word', '?')}\n"
        f"Classification: {move_data.get('classification', '?')}\n"
        f"Efficiency: {(move_data.get('efficiency_ratio', 0) * 100):.1f}%\n"
        f"Bits lost: {move_data.get('bits_lost', 0):.2f}\n"
        f"Remaining words before: {move_data.get('remaining_words', '?')}\n"
        f"Remaining words after: {move_data.get('remaining_after', '?')}\n"
        f"Info gained: {move_data.get('info_gained', 0):.2f} bits\n"
        f"Constraint violation: {move_data.get('constraint_violation', 'none')}\n"
        f"Trap detected: {move_data.get('trap_detected', False)}\n\n"
        f"[PLAYER_LEVEL] {level} (ELO {player_elo:.0f})\n\n"
        "[INSTRUCTION] Explain in 2-3 sentences why the optimal word was better"
        " than the player's guess. Focus on strategic reasoning (letter coverage,"
        f" position targeting, partition balance). {_skill_instruction(level)}"
    )

    client = _get_client()
    response = client.messages.create(  # type: ignore[union-attr]
        model="claude-haiku-4-5-20251001",
        max_tokens=150,
        temperature=0.3,
        system=COACH_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    text: str = response.content[0].text
    await set_cache(db, key, 1, text)
    return text


# ---------------------------------------------------------------------------
# Tier 2 — Post-game summary
# ---------------------------------------------------------------------------

async def generate_game_summary(
    db: AsyncSession,
    analysis: dict,
    game_data: dict,
    player_elo: float,
) -> str:
    """Generate an AI post-game summary.

    Cached for 30 days keyed on an MD5 of the full move list plus the
    player's rounded ELO bucket.

    Args:
        db: Active async session (used for cache read/write).
        analysis: Full analysis dict as returned by ``analyze_game``.
        game_data: Flat dict with at least ``target_word``, ``status``,
            and ``num_guesses``.
        player_elo: Player's current ELO rating.

    Returns:
        Human-readable multi-sentence summary string.
    """
    moves_hash = hashlib.md5(
        str(analysis.get("moves", [])).encode()
    ).hexdigest()[:16]
    key = _cache_key(2, moves_hash, str(round(player_elo)))

    cached = await get_cached(db, key)
    if cached:
        return cached

    level = _skill_level(player_elo)

    move_lines: list[str] = []
    for m in analysis.get("moves", []):
        move_lines.append(
            f"  Move {m['move_number']}: {m['guess_word']} -> {m['classification']}"
            f" (eff: {m.get('efficiency_ratio', 0) * 100:.0f}%,"
            f" info: {m.get('info_gained', 0):.2f}b,"
            f" remaining: {m.get('remaining_words', '?')}->{m.get('remaining_after', '?')})"
        )

    prompt = (
        "[GAME_DATA]\n"
        f"Target word: {game_data.get('target_word', '?')}\n"
        f"Result: {game_data.get('status', '?')} in {game_data.get('num_guesses', '?')} guesses\n"
        f"Accuracy: {analysis.get('accuracy_score', 0):.1f}%\n"
        f"Luck factor: {analysis.get('luck_factor', 0):.3f}\n"
        f"Constraint violations: {analysis.get('constraint_violations', 0)}\n"
        f"Traps encountered: {analysis.get('traps_encountered', 0)}\n\n"
        "Moves:\n"
        + "\n".join(move_lines)
        + "\n\n"
        f"[PLAYER_LEVEL] {level} (ELO {player_elo:.0f})\n\n"
        "[INSTRUCTION] Write a 3-5 sentence post-game summary. Cover: overall"
        " strategy assessment, highlight the best move, explain the key mistake"
        " (if any), mention luck factor if significant, and give one actionable"
        f" improvement tip. {_skill_instruction(level)}"
    )

    client = _get_client()
    response = client.messages.create(  # type: ignore[union-attr]
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        temperature=0.3,
        system=COACH_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    await set_cache(db, key, 2, text)
    return text


# ---------------------------------------------------------------------------
# Tier 3 — Coach chat (synchronous, not cached)
# ---------------------------------------------------------------------------

def coach_chat_message(
    game_context: str,
    conversation_history: list[dict],
    user_message: str,
    player_elo: float,
) -> str:
    """Generate a single coach chat response.

    This function is **synchronous** because the Anthropic SDK is blocking.
    Wrap it with ``asyncio.to_thread`` when calling from an async handler.

    Results are NOT cached as conversations are ephemeral.

    Args:
        game_context: Pre-formatted string describing the current game state
            and analysis (injected into the system prompt).
        conversation_history: List of ``{"role": ..., "content": ...}`` dicts
            representing the prior turns in this session.
        user_message: The latest message from the player.
        player_elo: Player's current ELO rating.

    Returns:
        Assistant's response string.
    """
    level = _skill_level(player_elo)
    system = (
        COACH_SYSTEM
        + f"\n\n[GAME_CONTEXT]\n{game_context}"
        + f"\n\n[PLAYER_LEVEL] {level} (ELO {player_elo:.0f})"
    )

    messages: list[dict] = []
    for msg in conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": user_message})

    client = _get_client()
    response = client.messages.create(  # type: ignore[union-attr]
        model="claude-sonnet-4-6",
        max_tokens=500,
        temperature=0.7,
        system=system,
        messages=messages,
    )
    return response.content[0].text
