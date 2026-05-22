"""Admin audit-log service.

Provides a single helper that records an admin mutation into admin_audit_log.
Failures are swallowed so that auditing never breaks the actual admin action.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_audit_log import AdminAuditLog

_log = logging.getLogger(__name__)


async def record_admin_action(
    db: AsyncSession,
    admin_user_id: uuid.UUID,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    target_label: str | None = None,
    payload: dict | None = None,
    request: Request | None = None,
) -> None:
    """Insert one row into admin_audit_log.

    Caller is responsible for the db.flush() that follows the mutation.
    This function itself does not flush — the caller's existing flush covers it.
    If the insert fails for any reason the exception is caught, logged as a
    warning, and swallowed so that the surrounding admin action is unaffected.
    """
    ip_address: str | None = None
    if request is not None:
        try:
            ip_address = request.client.host if request.client else None
        except Exception:
            ip_address = None

    try:
        entry = AdminAuditLog(
            admin_user_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label,
            payload=payload,
            ip_address=ip_address,
        )
        db.add(entry)
    except Exception as exc:  # pragma: no cover
        _log.warning("Failed to record admin audit action %r: %s", action, exc)
