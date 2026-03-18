"""User ORM model."""
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """Represents a registered player."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # ELO / stats
    elo_rating: Mapped[float] = mapped_column(Float, default=1000.0, nullable=False)
    games_played: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_placement: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Streaks
    current_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_played_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Roles
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    # Relationships
    games: Mapped[list["Game"]] = relationship("Game", back_populates="user", lazy="select")  # noqa: F821
    elo_history: Mapped[list["EloHistory"]] = relationship(  # noqa: F821
        "EloHistory", back_populates="user", lazy="select"
    )
    profile: Mapped["PlayerProfile | None"] = relationship(  # noqa: F821
        "PlayerProfile", back_populates="user", uselist=False, lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} elo={self.elo_rating}>"
