"""Analysis router — run full information-theory analysis on a completed game."""
import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.analysis.patterns import detect_strategic_patterns
from app.schemas.analysis import (
    AnalysisResponse,
    GamePhaseAccuracy,
    MoveAnalysis,
    PatternBucket,
    StrategicPattern,
    TopPick,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/games/{game_id}/analyze", response_model=AnalysisResponse)
async def analyze_game_endpoint(
    game_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AnalysisResponse:
    """Run full analysis on a completed game and persist the results.

    Returns a detailed breakdown of every move's information-theoretic quality.
    """
    from app.analysis import analyze_game

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot analyse an in-progress game.",
        )

    moves_data = [
        {
            "guess_word": m.guess_word,
            "pattern": m.pattern,
            "move_number": m.move_number,
        }
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]

    analysis = await asyncio.to_thread(
        analyze_game, moves_data, game.target_word, competitive=game.mode == "competitive"
    )

    # Persist per-move analysis back to the database
    move_map = {m.move_number: m for m in game.moves}
    for move_result in analysis["moves"]:
        db_move = move_map.get(move_result["move_number"])
        if db_move is None:
            continue
        db_move.remaining_words = move_result["remaining_words"]
        db_move.entropy_before = move_result["entropy_before"]
        db_move.entropy_after = move_result["entropy_after"]
        db_move.info_gained = move_result["info_gained"]
        db_move.optimal_info = move_result["optimal_info"]
        db_move.optimal_word = move_result["optimal_word"]
        db_move.expected_remaining = move_result["expected_remaining"]
        db_move.optimal_expected_remaining = move_result["optimal_expected_remaining"]
        db_move.efficiency_ratio = move_result["efficiency_ratio"]
        db_move.bits_lost = move_result["bits_lost"]
        db_move.classification = move_result["classification"]
        db_move.game_phase = move_result["game_phase"]
        db_move.constraint_violation = move_result["constraint_violation"]
        db_move.trap_detected = move_result["trap_detected"]
        db_move.is_book_move = move_result["is_book_move"]

    # Also update summary fields on the game
    game.accuracy_score = analysis["accuracy_score"]
    game.luck_factor = analysis["luck_factor"]
    game.constraint_violations = analysis["constraint_violations"]
    game.traps_encountered = analysis["traps_encountered"]

    await db.flush()

    phase_acc = analysis["phase_accuracies"]
    raw_patterns = detect_strategic_patterns(analysis["moves"], current_user.elo_rating)

    return AnalysisResponse(
        game_id=str(game_id),
        accuracy_score=analysis["accuracy_score"],
        luck_factor=analysis["luck_factor"],
        constraint_violations=analysis["constraint_violations"],
        traps_encountered=analysis["traps_encountered"],
        phase_accuracies=GamePhaseAccuracy(
            opening=phase_acc.get("opening", 0.0),
            midgame=phase_acc.get("midgame", 0.0),
            endgame=phase_acc.get("endgame", 0.0),
        ),
        patterns=[
            StrategicPattern(
                pattern_type=p["pattern_type"],
                description=p["description"],
                severity=p["severity"],
                move_number=p.get("move_number"),
                details=p.get("details"),
            )
            for p in raw_patterns
        ],
        moves=[
            MoveAnalysis(
                move_number=m["move_number"],
                guess_word=m["guess_word"],
                pattern=m["pattern"],
                remaining_words=m["remaining_words"],
                remaining_after=m["remaining_after"],
                entropy_before=m["entropy_before"],
                entropy_after=m["entropy_after"],
                info_gained=m["info_gained"],
                optimal_info=m["optimal_info"],
                optimal_word=m["optimal_word"],
                expected_remaining=m["expected_remaining"],
                optimal_expected_remaining=m["optimal_expected_remaining"],
                efficiency_ratio=m["efficiency_ratio"],
                bits_lost=m["bits_lost"],
                classification=m["classification"],
                game_phase=m["game_phase"],
                constraint_violation=m["constraint_violation"],
                constraint_violation_reason=m.get("constraint_violation_reason", ""),
                trap_detected=m["trap_detected"],
                trap_info=m.get("trap_info"),
                is_book_move=m["is_book_move"],
                luck=m["luck"],
                remaining_words_list=m.get("remaining_words_list", []),
                top_picks=[
                    TopPick(
                        word=tp["word"],
                        entropy=tp["entropy"],
                        expected_remaining=tp["expected_remaining"],
                    )
                    for tp in m["top_picks"]
                ],
                pattern_distribution=[
                    PatternBucket(
                        pattern=pb["pattern"],
                        count=pb["count"],
                        probability=pb["probability"],
                        is_actual=pb["is_actual"],
                        words=pb.get("words", []),
                    )
                    for pb in m.get("pattern_distribution", [])
                ],
                optimal_pattern_distribution=[
                    PatternBucket(
                        pattern=pb["pattern"],
                        count=pb["count"],
                        probability=pb["probability"],
                        is_actual=pb["is_actual"],
                    )
                    for pb in m.get("optimal_pattern_distribution", [])
                ],
                letter_frequencies=m.get("letter_frequencies", {}),
            )
            for m in analysis["moves"]
        ],
    )
