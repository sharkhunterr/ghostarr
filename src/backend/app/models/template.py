"""Template model for newsletter templates."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, DateTime, String, Text
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.label import template_labels


class Template(Base):
    """Newsletter template with metadata and preset configuration."""

    __tablename__ = "templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)  # Legacy: ["weekly", "media", "stats"]
    file_path = Column(String(512), nullable=False)  # Relative to /config/templates/
    preset_config = Column(JSON, default=dict)  # Default generation params
    is_default = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schedules = relationship("Schedule", back_populates="template")
    history_entries = relationship("History", back_populates="template")
    labels = relationship(
        "Label",
        secondary=template_labels,
        back_populates="templates",
    )

    def __repr__(self) -> str:
        return f"<Template(id={self.id}, name={self.name})>"
