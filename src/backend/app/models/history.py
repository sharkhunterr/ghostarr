"""History model for newsletter generation attempts."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class GenerationType(enum.Enum):
    """Type of generation trigger."""

    MANUAL = "manual"
    AUTOMATIC = "automatic"


class GenerationStatus(enum.Enum):
    """Status of generation process."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class History(Base):
    """Generation history with full audit trail."""

    __tablename__ = "history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    type = Column(Enum(GenerationType), nullable=False, index=True)
    schedule_id = Column(String(36), ForeignKey("schedules.id"), nullable=True)
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=False)
    status = Column(Enum(GenerationStatus), default=GenerationStatus.PENDING, index=True)
    ghost_post_id = Column(String(100), nullable=True)
    ghost_post_url = Column(String(512), nullable=True)
    generation_config = Column(JSON, nullable=False)
    progress_log = Column(JSON, default=list)  # Array of step logs
    error_message = Column(Text, nullable=True)
    items_count = Column(Integer, default=0)
    duration_seconds = Column(Float, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    schedule = relationship("Schedule", back_populates="history_entries")
    template = relationship("Template", back_populates="history_entries")

    def __repr__(self) -> str:
        return f"<History(id={self.id}, type={self.type}, status={self.status})>"
