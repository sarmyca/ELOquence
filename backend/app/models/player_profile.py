"""PlayerProfile ORM model — aggregated per-player statistics."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlayerProfile(Base):
    """Aggregated statistics and trends for a single player.

    This table is recomputed after every completed game via
    ``services.profile.recalculate_profile``.
    """

    __tablename__ = "player_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # Aggregate counters
    total_games: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Accuracy averages
    avg_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_accuracy_opening: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_accuracy_midgame: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_accuracy_endgame: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Opener usage — e.g. {"CRANE": 5, "SLATE": 3}
    favorite_openers: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Quality rates
    constraint_violation_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    trap_detection_rate: Mapped[float | None] = mapped_column(Float, nullable=True)

    # 30-day trend slopes (positive = improving)
    accuracy_trend_30d: Mapped[float | None] = mapped_column(Float, nullable=True)
    elo_trend_30d: Mapped[float | None] = mapped_column(Float, nullable=True)

    last_updated: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship back to User
    user: Mapped["User"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return f"<PlayerProfile user_id={self.user_id} games={self.total_games}>"
