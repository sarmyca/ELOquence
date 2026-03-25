"""Game ORM model."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Game(Base):
    """Represents a single Wordle game session."""

    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    # Game configuration
    mode: Mapped[str] = mapped_column(String(20), nullable=False)  # daily/competitive/practice
    target_word: Mapped[str] = mapped_column(String(5), nullable=False)
    word_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Game state
    status: Mapped[str] = mapped_column(String(20), default="in_progress", nullable=False)
    num_guesses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    rated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Analysis results (filled after completion)
    accuracy_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    luck_factor: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ELO tracking
    elo_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    elo_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    elo_delta: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_placement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Quality metrics
    constraint_violations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    traps_encountered: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="games")  # noqa: F821
    moves: Mapped[list["Move"]] = relationship(  # noqa: F821
        "Move",
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="Move.move_number",
        lazy="select",
    )
    elo_history: Mapped[list["EloHistory"]] = relationship(  # noqa: F821
        "EloHistory", back_populates="game", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Game id={self.id} mode={self.mode} status={self.status}>"
