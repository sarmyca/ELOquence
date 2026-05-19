"""Web Push subscription ORM model.

Each row represents a single browser/device that has agreed to receive
push notifications for one user. A user can have many subscriptions
(phone + desktop + laptop). Endpoint is unique — re-subscribing from the
same browser yields the same endpoint and we upsert on it.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PushSubscription(Base):
    """A browser push subscription registered by a user."""

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Push service endpoint URL (Mozilla / Google / Apple / ...).
    # Browsers issue a new endpoint per device+origin, so this acts as
    # a stable per-device identifier — we upsert on it.
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    # Browser-issued ECDH public key (p256dh) used to encrypt the payload.
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    # Browser-issued shared auth secret used for payload authentication.
    auth: Mapped[str] = mapped_column(String(255), nullable=False)

    # Optional user-agent string, helps users identify "which device is this"
    # in a future device-list UI.
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return f"<PushSubscription user={self.user_id} endpoint={self.endpoint[:40]}...>"
