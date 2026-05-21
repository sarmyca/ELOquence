"""Lightweight in-memory rate limiter.

A simple sliding-window counter keyed by an arbitrary string (typically
``"<scope>:<email-or-ip>"``). Lives in process memory and resets on each
backend restart — intentional for a dev/single-instance deployment.

For multi-worker / multi-replica production, replace with a Redis-backed
implementation (e.g. ``slowapi`` + ``redis``); the function signatures
here are designed to map cleanly onto a Redis ``ZADD``/``ZREMRANGEBYSCORE``
pattern.

Two functions are exposed:

* ``check_rate_limit(key, max_attempts, window_seconds)`` — call BEFORE
  the action. Records the attempt if allowed; returns ``None`` if under
  the limit, or a float (seconds until the next allowed attempt) when
  blocked.
* ``reset_bucket(key)`` — clear the bucket. Call after a successful
  action so legitimate users aren't penalised by their own past failures
  (e.g. on a successful login, drop the email and IP buckets so the next
  failed-login window starts fresh).
"""
from __future__ import annotations

from collections import deque
from time import monotonic
from typing import Deque, Dict

# Module-level state. Each bucket holds the timestamps of recent attempts.
_buckets: Dict[str, Deque[float]] = {}


def check_rate_limit(
    key: str,
    max_attempts: int,
    window_seconds: float,
) -> float | None:
    """Record an attempt against *key* and return None if allowed.

    Returns the number of seconds until the next allowed attempt when
    the caller has exceeded ``max_attempts`` within the trailing
    ``window_seconds``. The attempt is NOT recorded when blocked, so
    repeated blocked calls don't artificially extend the cooldown.
    """
    now = monotonic()
    bucket = _buckets.setdefault(key, deque())

    # Evict timestamps that have fallen out of the sliding window.
    cutoff = now - window_seconds
    while bucket and bucket[0] < cutoff:
        bucket.popleft()

    if len(bucket) >= max_attempts:
        retry_after = (bucket[0] + window_seconds) - now
        return max(0.1, retry_after)

    bucket.append(now)
    return None


def reset_bucket(key: str) -> None:
    """Forget all recent attempts for *key*."""
    _buckets.pop(key, None)
