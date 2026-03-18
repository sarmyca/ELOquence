"""Challenge ORM model — shareable word challenges between players."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Challenge(Base):
    """A shareable challenge created by a player around a specific word.

    The creator picks (or is assigned) a word, receives a short URL-safe
    ``code``, and can share that code with others.  Each recipient creates
    their own Game record with ``mode="challenge"`` when they play.
    """

    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_word: Mapped[str] = mapped_column(String(5), nullable=False)
    word_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)

    # 8-character URL-safe shareable code (unique, indexed for fast lookup)
    code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Challenge code={self.code} word={self.target_word}>"
