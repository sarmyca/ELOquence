"""FastAPI application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

# Conservative defaults that match an API + SPA topology. Anything that
# would break the existing frontend (e.g. a strict Content-Security-Policy
# enumerating every script source) is left out — the SPA loads its own
# assets and Next.js inline scripts, and a half-right CSP would simply
# break things in prod without adding real defence. Reverse-proxy in front
# of this in production for proper HSTS + CSP tuning.
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",  # blocks MIME sniffing
    "X-Frame-Options": "DENY",            # clickjacking — the API has no UI
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    # Only meaningful when served over HTTPS; harmless on plain HTTP.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Append a small set of hardening headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for k, v in _SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler.

    On startup:
    - Load word lists from disk.
    - Pre-compute (or reload from .cache/) the pattern matrix.

    The pattern matrix computation is O(n_words * n_answers) and takes
    30-120 seconds on first run, but is instant on subsequent startups
    because the result is cached as a .npy file.
    """
    from app.analysis.engine import load_word_lists, precompute_pattern_matrix, is_valid_word

    print("Loading word lists…")
    load_word_lists()

    print("Building / loading pattern matrix (this may take a minute on first run)…")
    precompute_pattern_matrix()

    # Pre-warm the word index cache so the first guess doesn't pay the cold-start cost
    is_valid_word("WARMUP")

    # Scheduled notification jobs (daily reminder + streak warning).
    # They are no-ops when push is not configured, but the loops still
    # run so we don't have to special-case toggle the lifecycle.
    from app.services.notifications_cron import start_cron_tasks

    cron_tasks = start_cron_tasks()

    print("ELOquence backend ready.")
    yield

    for task in cron_tasks:
        task.cancel()


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application."""
    app = FastAPI(
        title="ELOquence API",
        description="Competitive Wordle platform with information-theory analysis.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS — restrict methods and headers to what the SPA actually uses.
    # Wildcarding both with `allow_credentials=True` is permissive enough
    # that a misconfigured CORS_ORIGINS entry quickly becomes a credential
    # exfiltration channel; pin the allowlist instead.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )
    app.add_middleware(SecurityHeadersMiddleware)

    # Global exception handler — never leak stack traces or internal paths
    # to clients. The full traceback is still logged server-side for ops.
    @app.exception_handler(Exception)
    async def _unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        _log.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error."},
        )

    # Routers
    from app.routers.achievements import router as achievements_router
    from app.routers.admin import public_router as announcements_public_router
    from app.routers.admin import router as admin_router
    from app.routers.ai import router as ai_router
    from app.routers.analysis import router as analysis_router
    from app.routers.auth import router as auth_router
    from app.routers.challenges import router as challenges_router
    from app.routers.daily import router as daily_router
    from app.routers.games import router as games_router
    from app.routers.graph import router as graph_router
    from app.routers.learn import router as learn_router
    from app.routers.leaderboard import router as leaderboard_router
    from app.routers.push import router as push_router
    from app.routers.users import router as users_router

    app.include_router(auth_router, prefix="/api")
    app.include_router(games_router, prefix="/api")
    app.include_router(challenges_router, prefix="/api")
    app.include_router(analysis_router, prefix="/api")
    app.include_router(ai_router, prefix="/api")
    app.include_router(daily_router, prefix="/api")
    app.include_router(leaderboard_router, prefix="/api")
    app.include_router(users_router, prefix="/api")
    app.include_router(graph_router, prefix="/api")
    app.include_router(learn_router, prefix="/api")
    app.include_router(admin_router, prefix="/api")
    app.include_router(achievements_router, prefix="/api")
    app.include_router(announcements_public_router, prefix="/api")
    app.include_router(push_router, prefix="/api")

    @app.get("/health")
    async def health_check() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
