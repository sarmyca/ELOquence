"""Per-user Learn (trainer) progress — one row per user × lesson.

Stores the high-water mark of challenges completed in each lesson so the
Learn page's progress follows the account across devices instead of living
only in browser ``localStorage``. A lesson is considered "done" by the client
when ``completed >= lesson.challenges.length``.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LearnProgress(Base):
    """A user's completed-challenge high-water mark for a single lesson."""

    __tablename__ = "learn_progress"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # Lesson identifier from the frontend lesson catalogue (e.g. "m1l1").
    lesson_id: Mapped[str] = mapped_column(String(64), primary_key=True)

    # High-water mark of challenges completed in this lesson. Monotonic: the
    # service only ever raises it, never lowers it, so a stale device pushing
    # an older (lower) value can't wipe out progress made elsewhere.
    completed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<LearnProgress user={self.user_id} lesson={self.lesson_id} "
            f"completed={self.completed}>"
        )
