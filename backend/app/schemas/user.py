"""User-related Pydantic schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Payload for creating a new account."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, digits, underscores, and hyphens.")
        return v


class UserLogin(BaseModel):
    """Payload for logging in."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Public representation of a user."""

    id: uuid.UUID
    email: str
    username: str
    avatar_url: str | None = None
    elo_rating: float
    games_played: int
    is_placement: bool
    current_streak: int
    max_streak: int
    created_at: datetime

    model_config = {"from_attributes": True}


class GoogleLogin(BaseModel):
    """Payload for Google OAuth login."""

    credential: str


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
