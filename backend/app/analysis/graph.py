"""Game State Graph construction for DFA visualization.

Each completed Wordle game is modelled as a directed acyclic graph (DAG)
where nodes are information states (defined by the set of remaining possible
answer words) and edges are guesses.  Identical states reached via different
guess sequences are merged, making this a true DAG rather than a tree.

Public API
----------
build_graph(game_moves, target_word)   -> graph dict  (player + optimal paths)
explore_from_state(state_hash, guess)  -> branch dict (interactive exploration)
"""
from __future__ import annotations

import hashlib
from typing import Any

import numpy as np

from app.analysis.classifier import classify_move
from app.analysis.engine import (
    ANSWERS,
    compute_entropy,
    compute_pattern,
    find_optimal_guess,
    get_remaining_answers,
    get_word_index,
    is_valid_word,
)

# ---------------------------------------------------------------------------
# In-memory state cache
# ---------------------------------------------------------------------------
# Maps state_hash -> {"remaining": np.ndarray, "target_word": str}
# Lives for the duration of the process.  Fine for development / single-worker
# deployments; replace with Redis if horizontal scaling is required.
_state_cache: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------


def compute_state_hash(remaining_indices: np.ndarray) -> str:
    """Return a 12-character hex digest that uniquely identifies a game state.

    The hash is computed over the **sorted** remaining answer indices so that
    two states with the same answer set always produce the same hash,
    regardless of the order they were derived.

    Args:
        remaining_indices: NumPy array of answer indices still possible.

    Returns:
        12-character MD5 hex prefix.
    """
    sorted_indices = np.sort(remaining_indices)
    return hashlib.md5(sorted_indices.tobytes()).hexdigest()[:12]


def _build_node(
    state_hash: str,
    remaining_indices: np.ndarray,
    depth: int,
    is_start: bool = False,
) -> dict[str, Any]:
    """Construct a graph node dict from the remaining answer indices.

    Args:
        state_hash: Unique identifier for this state.
        remaining_indices: Answer indices still consistent with observed clues.
        depth: Move number at which this state was first reached.
        is_start: Whether this is the initial (pre-guess) state.

    Returns:
        Node dict suitable for JSON serialisation.
    """
    n = len(remaining_indices)
    entropy = float(np.log2(n)) if n > 1 else 0.0
    # Expose up to 5 example words so the UI can display them
    examples = [ANSWERS[i] for i in remaining_indices[:5]]

    return {
        "id": state_hash,
        "remaining_count": n,
        "entropy": round(entropy, 3),
        "example_words": examples,
        "is_start": is_start,
        "is_accept": n == 1,
        "is_critical_decision": False,  # patched by callers when needed
        "depth": depth,
    }


def _build_edge(
    source_hash: str,
    target_hash: str,
    guess_word: str,
    pattern: int,
    info_gained: float,
    classification: str,
    is_player: bool,
    is_optimal: bool,
    edge_id: str | None = None,
) -> dict[str, Any]:
    """Construct a graph edge dict.

    Args:
        source_hash: Hash of the originating state.
        target_hash: Hash of the resulting state.
        guess_word: The 5-letter guess that produced this edge.
        pattern: Ternary-encoded feedback pattern (0-242).
        info_gained: Bits of information gained by this guess.
        classification: Move quality tier from the classifier.
        is_player: True when this edge was played by the actual player.
        is_optimal: True when this edge is on the engine's optimal path.
        edge_id: Override the auto-generated id when deduplicating edges.

    Returns:
        Edge dict suitable for JSON serialisation.
    """
    return {
        "id": edge_id or f"{source_hash}-{guess_word}-{target_hash}",
        "source": source_hash,
        "target": target_hash,
        "guess_word": guess_word,
        "pattern": pattern,
        "info_gained": round(info_gained, 3),
        "classification": classification,
        "is_player_path": is_player,
        "is_optimal_path": is_optimal,
        "is_alternative": not is_player and not is_optimal,
    }


def _detect_critical_decision(
    possible_indices: np.ndarray,
    top_n: int = 3,
) -> bool:
    """Return True when the top-2 guesses have near-equal entropy (within 0.05 bits).

    A node is a "critical decision point" when multiple guesses are almost
    equally good — small differences in play style may meaningfully diverge
    from here.

    Args:
        possible_indices: Current remaining answer indices.
        top_n: How many top guesses to fetch (only the first two are compared).

    Returns:
        True if the entropy gap between rank-1 and rank-2 is below 0.05 bits.
    """
    if len(possible_indices) <= 2:
        return False

    top_picks = find_optimal_guess(possible_indices, len(possible_indices), top_n=top_n)
    if len(top_picks) < 2:
        return False

    gap = abs(top_picks[0]["entropy"] - top_picks[1]["entropy"])
    return gap < 0.05


def _classify_edge(
    guess: str,
    current_possible: np.ndarray,
    player_entropy: float,
    optimal_info: float,
) -> str:
    """Derive a move classification for an edge.

    Args:
        guess: The guess word (uppercase).
        current_possible: Remaining answer indices before this guess.
        player_entropy: Shannon entropy of this guess over current_possible.
        optimal_info: Entropy of the best available guess.

    Returns:
        Classification string from the 9-tier classifier.
    """
    efficiency = player_entropy / optimal_info if optimal_info > 1e-9 else 1.0
    bits_lost = max(0.0, optimal_info - player_entropy)
    is_candidate = guess in {ANSWERS[i] for i in current_possible}

    return classify_move(
        efficiency_ratio=efficiency,
        bits_lost=bits_lost,
        remaining_words=len(current_possible),
        is_answer_candidate=is_candidate,
        constraint_violation=None,
        remaining_count_before=len(current_possible),
    )


# ---------------------------------------------------------------------------
# Public graph-building function
# ---------------------------------------------------------------------------


def build_graph(game_moves: list[dict], target_word: str) -> dict[str, Any]:
    """Build the full game state graph for a completed game.

    The returned structure contains:
    - Every information state (node) encountered on the player's path.
    - The top-5 alternative guesses branching from each node.
    - The engine's optimal path from the start state.
    - DAG merge: states reached via different routes share the same node.

    Args:
        game_moves: List of dicts with keys ``guess_word``, ``pattern``,
                    and ``move_number``.
        target_word: The correct answer for this game (uppercase or lowercase).

    Returns:
        Dict with keys ``nodes``, ``edges``, ``player_path_node_ids``,
        and ``optimal_path_node_ids``.
    """
    global _state_cache  # noqa: PLW0603

    nodes: dict[str, dict[str, Any]] = {}  # hash -> node dict
    edges: list[dict[str, Any]] = []
    player_path_ids: list[str] = []
    optimal_path_ids: list[str] = []

    target_upper = target_word.upper()

    # ------------------------------------------------------------------
    # Player path
    # ------------------------------------------------------------------
    all_indices = np.arange(len(ANSWERS), dtype=np.int32)
    start_hash = compute_state_hash(all_indices)

    _state_cache[start_hash] = {
        "remaining": all_indices.copy(),
        "target_word": target_upper,
    }

    start_node = _build_node(start_hash, all_indices, depth=0, is_start=True)
    start_node["is_critical_decision"] = _detect_critical_decision(all_indices)
    nodes[start_hash] = start_node
    player_path_ids.append(start_hash)

    current_possible = all_indices.copy()

    for move in sorted(game_moves, key=lambda m: m["move_number"]):
        guess = move["guess_word"].upper()
        pattern = int(move["pattern"])
        depth = int(move["move_number"])

        source_hash = compute_state_hash(current_possible)
        entropy_before = float(np.log2(len(current_possible))) if len(current_possible) > 1 else 0.0

        # Narrow the answer set
        new_possible = get_remaining_answers(current_possible, guess, pattern)
        target_hash = compute_state_hash(new_possible)

        _state_cache[target_hash] = {
            "remaining": new_possible.copy(),
            "target_word": target_upper,
        }

        # Build result node if not yet seen (DAG merge otherwise)
        if target_hash not in nodes:
            node = _build_node(target_hash, new_possible, depth=depth)
            node["is_critical_decision"] = (
                _detect_critical_decision(new_possible) if len(new_possible) > 2 else False
            )
            nodes[target_hash] = node

        # Metrics for the player's edge
        entropy_after = float(np.log2(len(new_possible))) if len(new_possible) > 1 else 0.0
        info_gained = entropy_before - entropy_after

        top_picks = find_optimal_guess(current_possible, len(current_possible), top_n=5)
        optimal = top_picks[0] if top_picks else None
        optimal_info = optimal["entropy"] if optimal else 0.0

        try:
            guess_idx = get_word_index(guess)
            player_entropy = compute_entropy(guess_idx, current_possible)
        except ValueError:
            player_entropy = 0.0

        player_classification = _classify_edge(guess, current_possible, player_entropy, optimal_info)

        player_edge = _build_edge(
            source_hash,
            target_hash,
            guess,
            pattern,
            info_gained,
            player_classification,
            is_player=True,
            is_optimal=False,
        )
        edges.append(player_edge)
        player_path_ids.append(target_hash)

        # --------------------------------------------------------------
        # Top-5 alternative guesses at this node (1 level deep only)
        # --------------------------------------------------------------
        for i, pick in enumerate(top_picks[:5]):
            alt_word = pick["word"]
            if alt_word == guess:
                continue  # player already chose this one

            alt_pattern = compute_pattern(alt_word, target_upper)

            try:
                alt_possible = get_remaining_answers(current_possible, alt_word, alt_pattern)
            except ValueError:
                continue

            alt_hash = compute_state_hash(alt_possible)

            _state_cache[alt_hash] = {
                "remaining": alt_possible.copy(),
                "target_word": target_upper,
            }

            if alt_hash not in nodes:
                alt_node = _build_node(alt_hash, alt_possible, depth=depth)
                nodes[alt_hash] = alt_node

            alt_entropy_after = float(np.log2(len(alt_possible))) if len(alt_possible) > 1 else 0.0
            alt_info_gained = entropy_before - alt_entropy_after

            alt_classification = _classify_edge(
                alt_word, current_possible, pick["entropy"], optimal_info
            )

            alt_edge = _build_edge(
                source_hash,
                alt_hash,
                alt_word,
                alt_pattern,
                alt_info_gained,
                alt_classification,
                is_player=False,
                is_optimal=(i == 0),
            )
            edges.append(alt_edge)

        current_possible = new_possible

    # ------------------------------------------------------------------
    # Optimal path (engine's choices from the initial state)
    # ------------------------------------------------------------------
    opt_possible = all_indices.copy()
    optimal_path_ids.append(start_hash)

    for depth_i in range(1, 7):  # Wordle allows at most 6 guesses
        if len(opt_possible) <= 1:
            break

        opt_picks = find_optimal_guess(opt_possible, len(opt_possible), top_n=1)
        if not opt_picks:
            break

        opt_guess = opt_picks[0]["word"]
        opt_pattern = compute_pattern(opt_guess, target_upper)

        opt_source_hash = compute_state_hash(opt_possible)
        opt_entropy_before = float(np.log2(len(opt_possible))) if len(opt_possible) > 1 else 0.0

        opt_new_possible = get_remaining_answers(opt_possible, opt_guess, opt_pattern)
        opt_target_hash = compute_state_hash(opt_new_possible)

        _state_cache[opt_target_hash] = {
            "remaining": opt_new_possible.copy(),
            "target_word": target_upper,
        }

        if opt_target_hash not in nodes:
            opt_node = _build_node(opt_target_hash, opt_new_possible, depth=depth_i)
            nodes[opt_target_hash] = opt_node

        # Re-use existing edge if the optimal path happens to overlap the
        # player path (DAG property); otherwise create a new one.
        edge_id = f"{opt_source_hash}-{opt_guess}-{opt_target_hash}"
        existing_edges = [e for e in edges if e["id"] == edge_id]
        if existing_edges:
            existing_edges[0]["is_optimal_path"] = True
        else:
            opt_entropy_after = (
                float(np.log2(len(opt_new_possible))) if len(opt_new_possible) > 1 else 0.0
            )
            opt_info_gained = opt_entropy_before - opt_entropy_after

            opt_edge = _build_edge(
                opt_source_hash,
                opt_target_hash,
                opt_guess,
                opt_pattern,
                opt_info_gained,
                "best",
                is_player=False,
                is_optimal=True,
            )
            edges.append(opt_edge)

        optimal_path_ids.append(opt_target_hash)
        opt_possible = opt_new_possible

    return {
        "nodes": list(nodes.values()),
        "edges": edges,
        "player_path_node_ids": player_path_ids,
        "optimal_path_node_ids": optimal_path_ids,
    }


# ---------------------------------------------------------------------------
# Interactive exploration
# ---------------------------------------------------------------------------


def explore_from_state(state_hash: str, guess: str) -> dict[str, Any]:
    """Explore an alternative branch from a previously cached game state.

    Used by the frontend to let users interactively try alternative guesses
    after viewing the initial graph.  The resulting state is cached so
    subsequent exploration calls can branch further.

    Args:
        state_hash: Identifier of the source state (must be in _state_cache).
        guess: The 5-letter guess to try (case-insensitive).

    Returns:
        Dict with keys:
        - ``new_node``: Node dict for the resulting state.
        - ``edge``: Edge dict representing the guess.
        - ``merged_with``: Hash of a pre-existing node if the state already
          exists in the cache (DAG merge); None otherwise.
        - ``top_picks``: Top-5 engine recommendations at the new state.

    Raises:
        ValueError: If the state hash is not cached or the guess is invalid.
    """
    if state_hash not in _state_cache:
        raise ValueError(f"State '{state_hash}' not found in cache.")

    cached = _state_cache[state_hash]
    remaining: np.ndarray = cached["remaining"]
    target_word: str = cached["target_word"]

    guess = guess.upper()
    if not is_valid_word(guess):
        raise ValueError(f"'{guess}' is not a valid word.")

    pattern = compute_pattern(guess, target_word)
    new_remaining = get_remaining_answers(remaining, guess, pattern)
    new_hash = compute_state_hash(new_remaining)

    # DAG merge: check whether this state already exists
    merged_with: str | None = new_hash if new_hash in _state_cache else None

    # Cache new state regardless (idempotent)
    _state_cache[new_hash] = {
        "remaining": new_remaining.copy(),
        "target_word": target_word,
    }

    # Build the new node — depth is unknown here so use 1 as a placeholder
    new_node = _build_node(new_hash, new_remaining, depth=1)
    new_node["is_critical_decision"] = (
        _detect_critical_decision(new_remaining) if len(new_remaining) > 2 else False
    )

    # Edge metrics
    entropy_before = float(np.log2(len(remaining))) if len(remaining) > 1 else 0.0
    entropy_after = float(np.log2(len(new_remaining))) if len(new_remaining) > 1 else 0.0
    info_gained = entropy_before - entropy_after

    top_picks_source = find_optimal_guess(remaining, len(remaining), top_n=5)
    optimal = top_picks_source[0] if top_picks_source else None
    optimal_info = optimal["entropy"] if optimal else 0.0

    try:
        guess_idx = get_word_index(guess)
        player_entropy = compute_entropy(guess_idx, remaining)
    except ValueError:
        player_entropy = 0.0

    classification = _classify_edge(guess, remaining, player_entropy, optimal_info)

    edge = _build_edge(
        state_hash,
        new_hash,
        guess,
        pattern,
        info_gained,
        classification,
        is_player=False,
        is_optimal=False,
    )

    # Top-5 recommendations at the *new* state
    if len(new_remaining) > 1:
        new_top_picks_raw = find_optimal_guess(new_remaining, len(new_remaining), top_n=5)
        new_top_picks: list[dict[str, Any]] = [
            {
                "word": tp["word"],
                "entropy": round(tp["entropy"], 3),
                "expected_remaining": round(tp["expected_remaining"], 2),
            }
            for tp in new_top_picks_raw
        ]
    else:
        new_top_picks = []

    return {
        "new_node": new_node,
        "edge": edge,
        "merged_with": merged_with,
        "top_picks": new_top_picks,
    }
