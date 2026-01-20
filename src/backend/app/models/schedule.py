"""Schedule model for automated newsletter generation."""

import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import relationship

from app.database import Base


class RunStatus(enum.Enum):
    """Status of schedule execution."""

    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class Schedule(Base):
    """Automated generation schedule with CRON expression."""

    __tablename__ = "schedules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(255), nullable=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    cron_expression = Column(String(100), nullable=False)  # "0 8 * * 1"
    timezone = Column(String(50), default="Europe/Paris")
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=False)
    generation_config = Column(JSON, nullable=False)  # Full config snapshot
    last_run_at = Column(DateTime, nullable=True)
    last_run_status = Column(
        Enum(RunStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    next_run_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    template = relationship("Template", back_populates="schedules")
    history_entries = relationship("History", back_populates="schedule")

    def __repr__(self) -> str:
        return f"<Schedule(id={self.id}, name={self.name}, active={self.is_active})>"
