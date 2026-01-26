"""Label model for template categorization."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Table
from sqlalchemy.orm import relationship

from app.database import Base

# Association table for many-to-many relationship between templates and labels
template_labels = Table(
    "template_labels",
    Base.metadata,
    Column("template_id", String(36), ForeignKey("templates.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", String(36), ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


class Label(Base):
    """Label for categorizing templates with colors."""

    __tablename__ = "labels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(50), unique=True, nullable=False, index=True)
    color = Column(String(7), nullable=False, default="#6366f1")  # Hex color code
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    templates = relationship(
        "Template",
        secondary=template_labels,
        back_populates="labels",
    )

    def __repr__(self) -> str:
        return f"<Label(id={self.id}, name={self.name}, color={self.color})>"
