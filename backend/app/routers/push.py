"""Push notification endpoints — subscribe / unsubscribe / preferences / test."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.notification_preferences import DEFAULT_PREFS, NotificationPreferences
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.schemas.push import (
    NotificationPreferencesPayload,
    NotificationPreferencesUpdate,
    PushSubscribeRequest,
    PushTestResponse,
    PushUnsubscribeRequest,
    PushVapidPublicKey,
)
from app.services.auth import get_current_user
from app.services.push import build_payload, send_push_to_subscriptions

router = APIRouter(prefix="/push", tags=["push"])


async def _get_or_default_prefs(db: AsyncSession, user_id) -> dict:
    result = await db.execute(
        select(NotificationPreferences).where(NotificationPreferences.user_id == user_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return dict(DEFAULT_PREFS)
    return {k: getattr(row, k) for k in DEFAULT_PREFS}


@router.get("/preferences", response_model=NotificationPreferencesPayload)
async def get_preferences(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NotificationPreferencesPayload:
    """Return the user's per-trigger opt-in settings (defaults to all on)."""
    prefs = await _get_or_default_prefs(db, current_user.id)
    return NotificationPreferencesPayload(**prefs)


@router.patch("/preferences", response_model=NotificationPreferencesPayload)
async def update_preferences(
    payload: NotificationPreferencesUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> NotificationPreferencesPayload:
    """Toggle one or more per-trigger preferences for the current user."""
    result = await db.execute(
        select(NotificationPreferences).where(NotificationPreferences.user_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    updates = payload.model_dump(exclude_unset=True)

    if row is None:
        # First write — start from defaults and overlay the provided fields.
        merged = {**DEFAULT_PREFS, **updates}
        row = NotificationPreferences(user_id=current_user.id, **merged)
        db.add(row)
    else:
        for key, value in updates.items():
            setattr(row, key, value)

    await db.flush()
    return NotificationPreferencesPayload(
        **{k: getattr(row, k) for k in DEFAULT_PREFS}
    )


@router.get("/vapid-public-key", response_model=PushVapidPublicKey)
async def get_vapid_public_key() -> PushVapidPublicKey:
    """Return the VAPID public key the browser needs to subscribe.

    Anonymous endpoint — the public key is public by design.
    """
    return PushVapidPublicKey(
        public_key=settings.VAPID_PUBLIC_KEY,
        enabled=settings.push_enabled,
    )


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    payload: PushSubscribeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Register a browser push subscription for the authenticated user.

    Endpoints are globally unique. If the same endpoint already exists:
      - belongs to the current user → update keys + UA (legitimate re-sub)
      - belongs to a different user → 409 (don't silently steal the
        subscription; the previous owner's device would then receive
        notifications intended for the new owner)
    """
    if not settings.push_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured on this server.",
        )

    sub = payload.subscription
    existing = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == sub.endpoint)
    )
    row = existing.scalar_one_or_none()

    if row is None:
        row = PushSubscription(
            id=uuid.uuid4(),
            user_id=current_user.id,
            endpoint=sub.endpoint,
            p256dh=sub.keys.p256dh,
            auth=sub.keys.auth,
            user_agent=payload.user_agent,
        )
        db.add(row)
    elif row.user_id == current_user.id:
        # Same user re-subscribing on the same browser — refresh keys/UA.
        row.p256dh = sub.keys.p256dh
        row.auth = sub.keys.auth
        if payload.user_agent:
            row.user_agent = payload.user_agent
    else:
        # Endpoint claimed by another user. Refuse to re-own it. The new
        # caller must first DELETE their old subscription (the browser's
        # PushManager.unsubscribe() does this) before re-subscribing.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This subscription endpoint is already registered to another account.",
        )

    await db.flush()
    return {"id": str(row.id)}


@router.delete("/subscribe")
async def unsubscribe(
    payload: PushUnsubscribeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Remove a subscription by endpoint. Only deletes if it belongs to caller."""
    result = await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == payload.endpoint,
            PushSubscription.user_id == current_user.id,
        )
    )
    return {"deleted": result.rowcount or 0}


@router.post("/test", response_model=PushTestResponse)
async def send_test_notification(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PushTestResponse:
    """Send a test push to every device the user is subscribed on.

    Useful for the settings-page "Send test" button so a user can confirm
    the pipeline works end-to-end without having to wait for a real trigger.
    """
    if not settings.push_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications are not configured on this server.",
        )

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == current_user.id)
    )
    subs = list(result.scalars().all())
    if not subs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No push subscriptions registered for this account.",
        )

    payload = build_payload(
        title="ELOquence",
        body="Push notifications are working. Welcome aboard.",
        url="/",
        tag="test-notification",
    )
    sent, removed = await send_push_to_subscriptions(db, subs, payload)
    return PushTestResponse(sent=sent, removed=removed)
