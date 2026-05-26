"""Schemas for the Learn (trainer) progress sync endpoints."""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

# Guard rails: a lesson id is short (e.g. "m1l1"); `completed` is a small
# challenge count (the legacy localStorage format used 999 as a "done"
# sentinel, so allow generous headroom). The map is bounded so a malicious
# client can't push thousands of rows in one request.
MAX_LESSONS = 500
MAX_LESSON_ID_LEN = 64
MAX_COMPLETED = 100_000


class LearnProgressUpdate(BaseModel):
    """Bulk upsert payload: a map of ``lesson_id → challenges completed``.

    Used both for incremental single-lesson saves during play and for the
    one-time migration push of a device's existing localStorage progress.
    The server merges each entry as a high-water mark.
    """

    progress: dict[str, int] = Field(default_factory=dict)

    @field_validator("progress")
    @classmethod
    def _validate_progress(cls, v: dict[str, int]) -> dict[str, int]:
        if len(v) > MAX_LESSONS:
            raise ValueError(f"Too many lessons (max {MAX_LESSONS}).")
        cleaned: dict[str, int] = {}
        for key, val in v.items():
            if not key or len(key) > MAX_LESSON_ID_LEN:
                raise ValueError("Invalid lesson id.")
            if not isinstance(val, int) or val < 0 or val > MAX_COMPLETED:
                raise ValueError("Invalid completed count.")
            cleaned[key] = val
        return cleaned


class LearnProgressResponse(BaseModel):
    """The user's full, merged progress map after a read or upsert."""

    progress: dict[str, int] = Field(default_factory=dict)
