"""Web Push delivery service (pywebpush wrapper).

The browser-side flow:

    1. JS asks the SW for a PushManager subscription, passing our VAPID
       public key. The browser hits its push service (Mozilla / Google /
       Apple) and returns ``{endpoint, keys: {p256dh, auth}}``.
    2. JS POSTs that to /push/subscribe — we persist a PushSubscription row.
    3. To notify the user we ``send_push_to_user(user_id, payload)``; this
       module looks up every subscription, encrypts and POSTs the payload
       to the push service, which delivers to the device.

Endpoints that have expired (HTTP 404 / 410 from the push service) get
removed automatically — they can never receive a notification again.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Iterable

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.push_subscription import PushSubscription

_log = logging.getLogger(__name__)


def _send_one(sub: PushSubscription, payload: dict) -> tuple[bool, bool]:
    """Send a single notification synchronously (blocking HTTP call).

    Returns ``(sent, expired)``:
      - ``sent``   — True if the push service accepted the message.
      - ``expired`` — True if the endpoint is permanently gone (404/410),
        so the caller can purge it from the DB.
    """
    if not settings.push_enabled:
        return (False, False)
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=settings.__dict__.get("VAPID_TTL_SECONDS", 60 * 60 * 24),
        )
        return (True, False)
    except WebPushException as exc:
        status_code = getattr(exc.response, "status_code", None)
        if status_code in (404, 410):
            return (False, True)
        _log.warning(
            "push delivery failed (endpoint=%s status=%s): %s",
            sub.endpoint[:60],
            status_code,
            exc,
        )
        return (False, False)
    except Exception as exc:  # noqa: BLE001 — never let push fail bubble out
        _log.warning("push delivery raised: %s", exc)
        return (False, False)


async def send_push_to_subscriptions(
    db: AsyncSession,
    subs: Iterable[PushSubscription],
    payload: dict,
) -> tuple[int, int]:
    """Fan out a payload across many subscriptions concurrently.

    Returns ``(sent_count, removed_count)``.
    """
    subs_list = list(subs)
    if not subs_list or not settings.push_enabled:
        return (0, 0)

    # pywebpush is blocking; run each delivery in the default thread pool so
    # the event loop doesn't stall on slow push services.
    results = await asyncio.gather(
        *(asyncio.to_thread(_send_one, sub, payload) for sub in subs_list)
    )

    sent_count = 0
    expired_ids: list[Any] = []
    for sub, (sent, expired) in zip(subs_list, results):
        if sent:
            sent_count += 1
        if expired:
            expired_ids.append(sub.id)

    # Touch last_used_at for live subscriptions; prune dead ones.
    live_ids = [sub.id for sub, (sent, _) in zip(subs_list, results) if sent]
    if live_ids:
        await db.execute(
            update(PushSubscription)
            .where(PushSubscription.id.in_(live_ids))
            .values(last_used_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc))
        )
    if expired_ids:
        await db.execute(
            delete(PushSubscription).where(PushSubscription.id.in_(expired_ids))
        )

    return (sent_count, len(expired_ids))


async def send_push_to_user(
    db: AsyncSession,
    user_id,
    payload: dict,
) -> tuple[int, int]:
    """Push to every subscription belonging to a user. Returns (sent, removed)."""
    if not settings.push_enabled:
        return (0, 0)
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subs = list(result.scalars().all())
    return await send_push_to_subscriptions(db, subs, payload)


def build_payload(
    title: str,
    body: str,
    *,
    url: str = "/",
    tag: str | None = None,
    badge: str = "/icon-192.png",
    icon: str = "/icon-192.png",
) -> dict:
    """Construct the JSON payload the SW expects in its ``push`` handler."""
    return {
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
        "badge": badge,
        "icon": icon,
    }


async def notify_challenge_completed(game_id) -> None:
    """Push the challenge creator(s) that someone just played their challenge.

    Runs in a fresh DB session — designed to be fired via asyncio.create_task
    so it does NOT block the response that returns the player's result.

    Identifies challenges by ``target_word`` (the same convention the
    /challenges/{code}/results endpoint uses). In the rare case where two
    creators independently rolled the same word, both get pinged — they
    each created a challenge that someone is now playing.
    """
    if not settings.push_enabled:
        return

    from app.database import AsyncSessionLocal
    from app.models.challenge import Challenge
    from app.models.game import Game
    from app.models.user import User

    try:
        async with AsyncSessionLocal() as db:
            game = (
                await db.execute(select(Game).where(Game.id == game_id))
            ).scalar_one_or_none()
            if game is None or game.mode != "challenge":
                return

            # Load player username for personalisation
            player_username = "Someone"
            if game.user_id:
                player = (
                    await db.execute(select(User).where(User.id == game.user_id))
                ).scalar_one_or_none()
                if player:
                    player_username = player.username or "Someone"

            # All challenges for this target_word (existing convention)
            challenges = (
                await db.execute(
                    select(Challenge).where(Challenge.target_word == game.target_word)
                )
            ).scalars().all()

            # Build per-creator notification list, deduping if a creator
            # somehow appears more than once.
            seen_creators: set = set()
            for c in challenges:
                if not c.creator_id or c.creator_id == game.user_id:
                    continue
                if c.creator_id in seen_creators:
                    continue
                seen_creators.add(c.creator_id)

                if game.status == "won":
                    body = f"{player_username} solved your challenge in {game.num_guesses}/6"
                elif game.status == "lost":
                    body = f"{player_username} couldn't crack your challenge"
                else:
                    continue  # in_progress slipped through somehow — skip

                payload = build_payload(
                    title="ELOquence",
                    body=body,
                    url=f"/challenge/{c.code}",
                    tag=f"challenge-{c.code}",
                )

                subs = (
                    await db.execute(
                        select(PushSubscription).where(
                            PushSubscription.user_id == c.creator_id
                        )
                    )
                ).scalars().all()
                if subs:
                    await send_push_to_subscriptions(db, list(subs), payload)

            await db.commit()
    except Exception as exc:  # noqa: BLE001 — never let push fail bubble out
        _log.warning("notify_challenge_completed failed for game %s: %s", game_id, exc)
