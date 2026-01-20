"""History schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models.history import GenerationStatus, GenerationType


class ProgressStepStatus(str, Enum):
    """Status of a progress step."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class ProgressStep(BaseModel):
    """Individual progress step in generation."""

    step: str = Field(description="Step identifier")
    status: ProgressStepStatus = Field(default=ProgressStepStatus.PENDING)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    items_count: int | None = None
    message: str = Field(default="", description="Step message")
    error: str | None = None


class HistoryCreate(BaseModel):
    """Schema for creating history entry (internal use)."""

    type: GenerationType
    template_id: str
    schedule_id: str | None = None
    generation_config: dict


class HistoryResponse(BaseModel):
    """History entry response schema."""

    id: str
    type: GenerationType
    schedule_id: str | None
    template_id: str
    status: GenerationStatus
    ghost_post_id: str | None
    ghost_post_url: str | None
    generation_config: dict
    progress_log: list[ProgressStep]
    error_message: str | None
    items_count: int
    duration_seconds: float | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class HistoryFilter(BaseModel):
    """Filter parameters for history queries."""

    type: GenerationType | None = None
    status: GenerationStatus | None = None
    template_id: str | None = None
    schedule_id: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None


class HistoryExportFormat(str, Enum):
    """Export format options."""

    JSON = "json"
    CSV = "csv"
