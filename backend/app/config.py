"""Application configuration using pydantic-settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    DATABASE_URL: str = "postgresql+asyncpg://eloquence:eloquence_dev@localhost:5432/eloquence"
    DATABASE_URL_SYNC: str = "postgresql://eloquence:eloquence_dev@localhost:5432/eloquence"
    JWT_SECRET: str = "dev-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24  # 1 day — short-lived tokens limit stolen-token blast radius.
    CORS_ORIGINS: str = "http://localhost:3000"
    # Gemini powers the AI coach (Tier 1 explain-move, Tier 2 game-summary,
    # Tier 3 coach-chat). All three use `gemini-2.0-flash` which has a generous
    # free tier (1500 req/day) — sufficient for a low-traffic uni project.
    GEMINI_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Web Push VAPID — empty values disable push entirely (graceful no-op).
    # Generate a fresh pair with `python -m app.cli.generate_vapid`.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:dev@eloquence.local"

    @property
    def push_enabled(self) -> bool:
        """True when both VAPID keys are configured."""
        return bool(self.VAPID_PUBLIC_KEY and self.VAPID_PRIVATE_KEY)

    model_config = {"env_file": ".env", "case_sensitive": True}

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
