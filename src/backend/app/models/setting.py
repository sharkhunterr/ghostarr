"""Setting model for application configuration."""

from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, String

from app.database import Base


class Setting(Base):
    """Key-value store for application settings."""

    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Setting(key={self.key})>"


# Reserved setting keys
SETTING_KEYS = {
    # Service credentials
    "services.tautulli": {"url": str, "api_key_encrypted": str},
    "services.tmdb": {"api_key_encrypted": str},
    "services.ghost": {"url": str, "admin_api_key_encrypted": str},
    "services.romm": {"url": str, "api_key_encrypted": str},
    "services.komga": {"url": str, "api_key_encrypted": str},
    "services.audiobookshelf": {"url": str, "api_key_encrypted": str},
    "services.tunarr": {"url": str, "api_key_encrypted": str},
    # Retention settings
    "retention.history_days": int,
    "retention.logs_days": int,
    # Notifications
    "notifications.admin_email": str,
}
