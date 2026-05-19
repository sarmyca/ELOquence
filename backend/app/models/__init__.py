"""ORM model package — import all models so Alembic can discover them."""
from app.models.achievement import Achievement
from app.models.ai_cache import AiCache
from app.models.announcement import Announcement
from app.models.challenge import Challenge
from app.models.daily_word import DailyWord
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.move import Move
from app.models.player_profile import PlayerProfile
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.models.word_stats import WordStats

__all__ = [
    "User",
    "Game",
    "Move",
    "EloHistory",
    "DailyWord",
    "WordStats",
    "PlayerProfile",
    "AiCache",
    "Achievement",
    "Announcement",
    "Challenge",
    "PushSubscription",
]
