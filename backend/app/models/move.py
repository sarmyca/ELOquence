"""Move ORM model."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Move(Base):
    """Represents a single guess within a game."""

    __tablename__ = "moves"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True
    )
    move_number: Mapped[int] = mapped_column(Integer, nullable=False)
    guess_word: Mapped[str] = mapped_column(String(5), nullable=False)

    # Pattern encoded as ternary integer (0-242): green=2, yellow=1, gray=0
    # encoded as sum(val * 3^pos) for pos in 0..4
    pattern: Mapped[int] = mapped_column(Integer, nullable=False)

    # Information theory metrics (filled by analysis engine)
    remaining_words: Mapped[int | None] = mapped_column(Integer, nullable=True)
    entropy_before: Mapped[float | None] = mapped_column(Float, nullable=True)
    entropy_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    info_gained: Mapped[float | None] = mapped_column(Float, nullable=True)
    optimal_info: Mapped[float | None] = mapped_column(Float, nullable=True)
    optimal_word: Mapped[str | None] = mapped_column(String(5), nullable=True)
    expected_remaining: Mapped[float | None] = mapped_column(Float, nullable=True)
    optimal_expected_remaining: Mapped[float | None] = mapped_column(Float, nullable=True)
    efficiency_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    bits_lost: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Move classification
    # brilliant/best/good/okay/inaccuracy/mistake/blunder/miss/forced
    classification: Mapped[str | None] = mapped_column(String(20), nullable=True)
    game_phase: Mapped[str | None] = mapped_column(String(20), nullable=True)  # opening/midgame/endgame
    constraint_violation: Mapped[str | None] = mapped_column(String(10), nullable=True)  # none/hard/soft
    trap_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_book_move: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    game: Mapped["Game"] = relationship("Game", back_populates="moves")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Move game={self.game_id} #{self.move_number} guess={self.guess_word}>"
