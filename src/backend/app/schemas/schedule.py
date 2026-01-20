"""Schedule schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.schedule import RunStatus
from app.schemas.generation import GenerationConfig


class ScheduleBase(BaseModel):
    """Base schedule schema."""

    name: str = Field(min_length=1, max_length=255, description="Schedule name")
    cron_expression: str = Field(description="CRON expression (5 fields)")
    timezone: str = Field(default="Europe/Paris", description="IANA timezone")

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str) -> str:
        """Validate CRON expression format."""
        from croniter import croniter

        try:
            croniter(v)
        except (KeyError, ValueError) as e:
            raise ValueError(f"Invalid CRON expression: {e}") from e
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        """Validate timezone."""
        import pytz

        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError as e:
            raise ValueError(f"Invalid timezone: {e}") from e
        return v


class ScheduleCreate(ScheduleBase):
    """Schema for creating a schedule."""

    template_id: str = Field(description="Template ID to use")
    generation_config: GenerationConfig = Field(description="Generation configuration")
    is_active: bool = Field(default=True, description="Enable schedule")


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    cron_expression: str | None = None
    timezone: str | None = None
    template_id: str | None = None
    generation_config: GenerationConfig | None = None
    is_active: bool | None = None

    @field_validator("cron_expression")
    @classmethod
    def validate_cron(cls, v: str | None) -> str | None:
        """Validate CRON expression if provided."""
        if v is None:
            return v
        from croniter import croniter

        try:
            croniter(v)
        except (KeyError, ValueError) as e:
            raise ValueError(f"Invalid CRON expression: {e}") from e
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        """Validate timezone if provided."""
        if v is None:
            return v
        import pytz

        try:
            pytz.timezone(v)
        except pytz.exceptions.UnknownTimeZoneError as e:
            raise ValueError(f"Invalid timezone: {e}") from e
        return v


class ScheduleResponse(ScheduleBase):
    """Schedule response schema."""

    id: str
    is_active: bool
    template_id: str
    generation_config: dict
    last_run_at: datetime | None
    last_run_status: RunStatus | None
    next_run_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScheduleNextRuns(BaseModel):
    """Next scheduled runs preview."""

    schedule_id: str
    cron_expression: str
    cron_description: str = Field(description="Human-readable CRON description")
    next_runs: list[datetime] = Field(description="Next 5 scheduled runs")
