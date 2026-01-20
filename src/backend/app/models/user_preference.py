"""UserPreference model for UI customization."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Enum, String

from app.database import Base


class Theme(enum.Enum):
    """UI theme preference."""

    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class UserPreference(Base):
    """User-specific UI preferences."""

    __tablename__ = "user_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(100), default="default", unique=True, index=True)
    theme = Column(Enum(Theme), default=Theme.SYSTEM)
    language = Column(String(5), default="fr")  # ISO 639-1
    timezone = Column(String(50), default="Europe/Paris")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<UserPreference(user_id={self.user_id}, theme={self.theme})>"


# Supported languages
SUPPORTED_LANGUAGES = ["fr", "en", "de", "it", "es"]
