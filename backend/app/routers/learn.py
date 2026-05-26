"""Learn (trainer) progress sync — read and high-water-mark upsert.

Progress used to live only in the browser's localStorage, so it never
followed the account across devices. These endpoints persist it per-user so
the Learn page shows the same completion state everywhere the user signs in.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.learn_progress import LearnProgress
from app.models.user import User
from app.schemas.learn import LearnProgressResponse, LearnProgressUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/learn", tags=["learn"])


async def _read_progress(db: AsyncSession, user_id) -> dict[str, int]:
    result = await db.execute(
        select(LearnProgress.lesson_id, LearnProgress.completed).where(
            LearnProgress.user_id == user_id
        )
    )
    return {row.lesson_id: row.completed for row in result.all()}


@router.get("/progress", response_model=LearnProgressResponse)
async def get_progress(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LearnProgressResponse:
    """Return the user's full lesson progress map (lesson_id → completed)."""
    return LearnProgressResponse(progress=await _read_progress(db, current_user.id))


@router.patch("/progress", response_model=LearnProgressResponse)
async def update_progress(
    payload: LearnProgressUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LearnProgressResponse:
    """Merge the supplied progress map into the user's stored progress.

    Each entry is applied as a high-water mark: the stored ``completed`` only
    ever rises (``GREATEST(existing, incoming)``), done atomically via an
    ``ON CONFLICT`` upsert so concurrent writes from two devices can't race
    one another into a lower value. Returns the full merged map.
    """
    # Drop zero entries — they can never raise an existing value and would
    # only create useless rows for lessons the user hasn't started.
    rows = [
        {"user_id": current_user.id, "lesson_id": lesson_id, "completed": completed}
        for lesson_id, completed in payload.progress.items()
        if completed > 0
    ]

    if rows:
        stmt = pg_insert(LearnProgress).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["user_id", "lesson_id"],
            set_={
                "completed": func.greatest(
                    LearnProgress.completed, stmt.excluded.completed
                ),
                "updated_at": func.now(),
            },
        )
        await db.execute(stmt)
        await db.flush()

    return LearnProgressResponse(progress=await _read_progress(db, current_user.id))
