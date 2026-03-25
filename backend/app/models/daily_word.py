"""DailyWord ORM model."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DailyWord(Base):
    """Stores the assigned word for each calendar day."""

    __tablename__ = "daily_words"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True
    )
    word: Mapped[str] = mapped_column(String(5), nullable=False)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<DailyWord date={self.date} word={self.word}>"
