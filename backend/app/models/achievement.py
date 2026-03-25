"""Achievement ORM model."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Valid achievement_type values:
# first_brilliant, ten_brilliants
# first_90_accuracy, first_95_accuracy, first_100_accuracy
# streak_7, streak_30, streak_100
# reach_veteran (ELO 1200), reach_master (ELO 1400), reach_grandmaster (ELO 1600)
# underdog (beat word 300+ ELO above rating)
# perfectionist (all Best/Brilliant in a game)
# climber (gain 200 ELO from starting 1000)


class Achievement(Base):
    """Records a specific achievement unlocked by a user."""

    __tablename__ = "achievements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    achievement_type: Mapped[str] = mapped_column(String(50), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Achievement user={self.user_id} type={self.achievement_type}>"
