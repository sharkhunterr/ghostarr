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


class DeletionResult(BaseModel):
    """Result of a deletion operation."""

    deleted_count: int = Field(description="Number of history entries deleted")
    ghost_deleted_count: int = Field(default=0, description="Number of Ghost posts deleted")
    retention_days: int = Field(default=0, description="Retention period used (0 for manual)")
    errors: list[str] | None = Field(default=None, description="Errors encountered")


class HistoryCreate(BaseModel):
    """Schema for creating history entry (internal use)."""

    type: GenerationType
    template_id: str | None = None
    schedule_id: str | None = None
    generation_config: dict | None = None


class HistoryResponse(BaseModel):
    """History entry response schema."""

    id: str
    type: GenerationType
    schedule_id: str | None
    template_id: str | None
    status: GenerationStatus
    ghost_post_id: str | None
    ghost_post_url: str | None
    generation_config: dict | None
    progress_log: list[ProgressStep]
    error_message: str | None
    items_count: int
    duration_seconds: float | None
    deletion_result: DeletionResult | None = None
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
