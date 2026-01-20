"""Log-related schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.log import LogLevel, LogSource


class LogBase(BaseModel):
    """Base log schema."""

    level: LogLevel
    source: LogSource
    service: str | None = None
    message: str
    context: dict[str, Any] | None = None
    correlation_id: str | None = None


class LogCreate(LogBase):
    """Schema for creating a log entry."""

    pass


class LogResponse(LogBase):
    """Schema for log response."""

    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class LogFilter(BaseModel):
    """Schema for filtering logs."""

    level: LogLevel | None = None
    source: LogSource | None = None
    service: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    correlation_id: str | None = None
    search: str | None = Field(default=None, description="Search in message")


class LogExportFormat(BaseModel):
    """Schema for log export format."""

    format: str = Field(default="json", pattern="^(json|csv)$")


class LogStats(BaseModel):
    """Schema for log statistics."""

    total: int
    by_level: dict[str, int]
    by_source: dict[str, int]
    by_service: dict[str, int]
