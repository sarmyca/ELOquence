"""Pydantic schemas for the push-notification endpoints."""
from __future__ import annotations

from pydantic import BaseModel, Field


class PushSubscriptionKeys(BaseModel):
    """ECDH keys produced by the browser when a subscription is created."""
    p256dh: str = Field(..., max_length=255)
    auth: str = Field(..., max_length=255)


class PushSubscriptionPayload(BaseModel):
    """Shape returned by ``PushManager.subscribe()`` in the browser."""
    endpoint: str
    keys: PushSubscriptionKeys
    expirationTime: float | None = None


class PushSubscribeRequest(BaseModel):
    """Body for POST /push/subscribe."""
    subscription: PushSubscriptionPayload
    user_agent: str | None = Field(default=None, max_length=512)


class PushUnsubscribeRequest(BaseModel):
    """Body for DELETE /push/subscribe — identify which subscription."""
    endpoint: str


class PushVapidPublicKey(BaseModel):
    """Response for GET /push/vapid-public-key."""
    public_key: str
    enabled: bool


class PushTestResponse(BaseModel):
    """Response for POST /push/test."""
    sent: int
    removed: int = 0


class NotificationPreferencesPayload(BaseModel):
    """GET response and PATCH body for /push/preferences."""
    challenge_results: bool = True
    achievement_unlock: bool = True
    daily_reminder: bool = True
    streak_warning: bool = True


class NotificationPreferencesUpdate(BaseModel):
    """PATCH body — every field is optional so the client can toggle one."""
    challenge_results: bool | None = None
    achievement_unlock: bool | None = None
    daily_reminder: bool | None = None
    streak_warning: bool | None = None
