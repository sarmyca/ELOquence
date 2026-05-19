"""Scheduled push notification jobs.

Two recurring jobs, scheduled as plain asyncio tasks (no APScheduler dep):

  - ``daily_reminder``  fires once per day at DAILY_REMINDER_HOUR. For every
    user who has at least one push subscription AND the daily_reminder
    preference enabled AND has not yet completed today's daily puzzle, push
    a "today's puzzle is ready" notification.

  - ``streak_warning``  fires once per day at STREAK_WARNING_HOUR. Same
    audience filter as above, plus current_streak >= 2 — we only nag
    streak-holders who have something to lose.

The jobs run in the same FastAPI process. ``start_cron_tasks()`` returns
the asyncio Task handles so the lifespan handler can cancel them on
shutdown.

Both jobs are also exposed via an admin endpoint
(``POST /admin/notifications/trigger?type=...``) so a demo doesn't have to
wait until 9:00 to see them work.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Awaitable, Callable

from sqlalchemy import distinct, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.game import Game
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services.push import notify_daily_reminder, notify_streak_warning

_log = logging.getLogger(__name__)


# Local-time hours when the recurring jobs fire. Backend container runs in
# Europe/Zagreb (set in docker-compose) so these are local hours.
DAILY_REMINDER_HOUR = 9
STREAK_WARNING_HOUR = 19


async def _users_with_active_subscription(db: AsyncSession) -> list:
    """All distinct user_ids that own at least one push subscription."""
    result = await db.execute(
        select(distinct(PushSubscription.user_id))
    )
    return [row[0] for row in result.all()]


async def _user_played_daily_today(db: AsyncSession, user_id) -> bool:
    """True if the user has at least one completed daily game with
    completed_at falling on today's local date."""
    today_start = datetime.combine(date.today(), time.min).astimezone()
    today_end = today_start + timedelta(days=1)
    result = await db.execute(
        select(Game.id)
        .where(
            Game.user_id == user_id,
            Game.mode == "daily",
            Game.status.in_(("won", "lost")),
            Game.completed_at >= today_start,
            Game.completed_at < today_end,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def run_daily_reminder_job() -> dict:
    """Send 'today's puzzle is ready' pushes to opted-in subscribers who
    haven't played today yet. Returns a small stats dict for the admin
    trigger endpoint to surface.
    """
    sent = 0
    skipped_already_played = 0
    async with AsyncSessionLocal() as db:
        user_ids = await _users_with_active_subscription(db)
        for uid in user_ids:
            if await _user_played_daily_today(db, uid):
                skipped_already_played += 1
                continue
            await notify_daily_reminder(uid)
            sent += 1
    _log.info(
        "daily_reminder: sent=%s skipped_already_played=%s",
        sent,
        skipped_already_played,
    )
    return {"sent": sent, "skipped_already_played": skipped_already_played}


async def run_streak_warning_job() -> dict:
    """Notify subscribers with current_streak >= 2 who haven't played the
    daily puzzle today yet — losing the streak at midnight would feel bad.
    """
    sent = 0
    skipped_no_streak = 0
    skipped_already_played = 0
    async with AsyncSessionLocal() as db:
        user_ids = await _users_with_active_subscription(db)
        for uid in user_ids:
            user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
            if user is None or (user.current_streak or 0) < 2:
                skipped_no_streak += 1
                continue
            if await _user_played_daily_today(db, uid):
                skipped_already_played += 1
                continue
            await notify_streak_warning(uid, int(user.current_streak))
            sent += 1
    _log.info(
        "streak_warning: sent=%s skipped_no_streak=%s skipped_already_played=%s",
        sent,
        skipped_no_streak,
        skipped_already_played,
    )
    return {
        "sent": sent,
        "skipped_no_streak": skipped_no_streak,
        "skipped_already_played": skipped_already_played,
    }


# ─── Scheduler loop ───────────────────────────────────────────────────────

def _seconds_until(hour: int) -> float:
    """Seconds from now until the next occurrence of HH:00 local time."""
    now = datetime.now().astimezone()
    target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return max(1.0, (target - now).total_seconds())


async def _daily_loop(hour: int, job: Callable[[], Awaitable[dict]], name: str) -> None:
    """Wait until next HH:00, run the job, repeat. Survives job errors."""
    while True:
        try:
            delay = _seconds_until(hour)
            _log.info("%s loop: sleeping %.0fs until %02d:00", name, delay, hour)
            await asyncio.sleep(delay)
            await job()
        except asyncio.CancelledError:
            _log.info("%s loop cancelled", name)
            return
        except Exception as exc:  # noqa: BLE001
            _log.warning("%s loop iteration failed: %s", name, exc)
            # Avoid a hot crash-loop if anything goes wrong.
            await asyncio.sleep(60)


def start_cron_tasks() -> list[asyncio.Task]:
    """Spawn the cron loops as background tasks owned by the running loop.

    Called from the FastAPI lifespan startup hook. The returned tasks
    should be cancelled on shutdown.
    """
    return [
        asyncio.create_task(
            _daily_loop(DAILY_REMINDER_HOUR, run_daily_reminder_job, "daily_reminder"),
            name="cron:daily_reminder",
        ),
        asyncio.create_task(
            _daily_loop(STREAK_WARNING_HOUR, run_streak_warning_job, "streak_warning"),
            name="cron:streak_warning",
        ),
    ]
