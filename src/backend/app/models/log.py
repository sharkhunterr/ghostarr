"""Log model for system diagnostics."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Column, DateTime, Enum, String, Text

from app.database import Base


class LogLevel(enum.Enum):
    """Log severity level."""

    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class LogSource(enum.Enum):
    """Log source category."""

    BACKEND = "backend"
    FRONTEND = "frontend"
    INTEGRATION = "integration"


class Log(Base):
    """System log entry for diagnostics."""

    __tablename__ = "logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    level = Column(Enum(LogLevel), nullable=False, index=True)
    source = Column(Enum(LogSource), nullable=False, index=True)
    service = Column(String(50), nullable=True, index=True)  # "tautulli", "ghost", etc.
    message = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)  # Additional structured data
    correlation_id = Column(String(36), nullable=True, index=True)  # Request tracing
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def __repr__(self) -> str:
        return f"<Log(id={self.id}, level={self.level}, source={self.source})>"
