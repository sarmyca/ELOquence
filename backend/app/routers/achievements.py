"""Achievements router — user achievement endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.achievements import ALL_ACHIEVEMENTS, get_user_achievements
from app.services.auth import get_current_user

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("/me")
async def my_achievements(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Return all achievements unlocked by the authenticated user, newest first."""
    return await get_user_achievements(db, current_user.id)


@router.get("/all")
async def all_achievements() -> list[dict]:
    """Return the full catalogue of possible achievements for display in the UI.

    Each entry includes type, name, description, and icon.  The frontend
    can cross-reference the ``/me`` list to determine which are locked.
    """
    return ALL_ACHIEVEMENTS
