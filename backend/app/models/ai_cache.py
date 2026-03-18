"""AiCache ORM model — stores LLM responses keyed by content hash."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AiCache(Base):
    """Cached AI coach responses to reduce API cost and latency.

    Cache entries are evicted based on ``expires_at``.  The ``cache_key`` is a
    SHA-256 hex digest (truncated to 64 chars) derived from the request tier
    and relevant content fields so that identical game positions always reuse
    the same response.

    Attributes:
        tier: Tier level (1 = move explanation, 2 = game summary).
        cache_key: Unique content-addressed key for lookup.
        response_text: The cached LLM response string.
        expires_at: UTC datetime after which this entry is considered stale.
    """

    __tablename__ = "ai_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    cache_key: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    tier: Mapped[int] = mapped_column(Integer, nullable=False)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AiCache key={self.cache_key[:16]}… tier={self.tier}>"
