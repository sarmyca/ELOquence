"""WordStats ORM model."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WordStats(Base):
    """Aggregate play statistics and difficulty calibration per word."""

    __tablename__ = "word_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    word: Mapped[str] = mapped_column(String(5), unique=True, nullable=False, index=True)

    times_played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    times_solved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_guesses: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Difficulty ratings
    tree_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    calibrated_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Trap classification
    trap_family: Mapped[str | None] = mapped_column(String(50), nullable=True)

    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<WordStats word={self.word} difficulty={self.calibrated_difficulty}>"
