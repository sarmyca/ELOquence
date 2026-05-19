"""Per-user opt-in toggles for each notification trigger.

Existence of a row implies the user has interacted with the settings at
least once. If no row exists the service falls back to ``DEFAULT_PREFS``
(everything enabled), so users who never visit the toggles still get
sensible behaviour.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class NotificationPreferences(Base):
    """Per-trigger push notification opt-in toggles."""

    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # When False, no push of that kind is delivered to this user, regardless
    # of subscription status.
    challenge_results: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    achievement_unlock: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily_reminder: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    streak_warning: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<NotificationPreferences user={self.user_id} "
            f"challenge={self.challenge_results} achievement={self.achievement_unlock} "
            f"daily={self.daily_reminder} streak={self.streak_warning}>"
        )


# Used when no row exists yet — keeps the trigger-check helper from
# needing special-case logic when the row is missing.
DEFAULT_PREFS = {
    "challenge_results": True,
    "achievement_unlock": True,
    "daily_reminder": True,
    "streak_warning": True,
}
