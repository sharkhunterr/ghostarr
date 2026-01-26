"""Schedule schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.schedule import RunStatus, ScheduleType
from app.schemas.generation import GenerationConfig


class DeletionConfig(BaseModel):
    """Configuration for deletion schedules."""

    delete_from_ghost: bool = Field(default=False, description="Also delete posts from Ghost")
    retention_days: int = Field(ge=1, le=365, description="Delete items older than X days")


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

    schedule_type: ScheduleType = Field(default=ScheduleType.GENERATION, description="Schedule type")
    template_id: str | None = Field(default=None, description="Template ID (required for generation)")
    generation_config: GenerationConfig | None = Field(default=None, description="Generation configuration")
    deletion_config: DeletionConfig | None = Field(default=None, description="Deletion configuration")
    is_active: bool = Field(default=True, description="Enable schedule")

    @model_validator(mode="after")
    def validate_config(self):
        """Validate config based on schedule type."""
        if self.schedule_type == ScheduleType.GENERATION:
            if not self.template_id:
                raise ValueError("template_id is required for generation schedules")
            if not self.generation_config:
                raise ValueError("generation_config is required for generation schedules")
        elif self.schedule_type == ScheduleType.DELETION:
            if not self.deletion_config:
                raise ValueError("deletion_config is required for deletion schedules")
        return self


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    cron_expression: str | None = None
    timezone: str | None = None
    template_id: str | None = None
    generation_config: GenerationConfig | None = None
    deletion_config: DeletionConfig | None = None
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
    schedule_type: ScheduleType
    is_active: bool
    template_id: str | None
    generation_config: dict | None
    deletion_config: dict | None
    last_run_at: datetime | None
    last_run_status: RunStatus | None
    next_run_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @field_validator("last_run_status", mode="before")
    @classmethod
    def validate_run_status(cls, v):
        """Convert string status to enum if needed (for backward compatibility)."""
        if v is None:
            return v
        if isinstance(v, RunStatus):
            return v
        if isinstance(v, str):
            # Try to match by value
            for status in RunStatus:
                if status.value == v.lower():
                    return status
            # Try to match by name
            try:
                return RunStatus[v.upper()]
            except KeyError:
                pass
        return v

    class Config:
        from_attributes = True


class ScheduleNextRuns(BaseModel):
    """Next scheduled runs preview."""

    schedule_id: str
    cron_expression: str
    cron_description: str = Field(description="Human-readable CRON description")
    next_runs: list[datetime] = Field(description="Next 5 scheduled runs")
