"""Generation configuration schemas."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class PublicationMode(str, Enum):
    """Newsletter publication mode."""

    DRAFT = "draft"
    PUBLISH = "publish"
    EMAIL = "email"
    EMAIL_PUBLISH = "email+publish"


class MaintenanceType(str, Enum):
    """Type of maintenance notice."""

    SCHEDULED = "scheduled"
    OUTAGE = "outage"
    NETWORK = "network"
    UPDATE = "update"
    IMPROVEMENT = "improvement"
    SECURITY = "security"


class ContentSourceConfig(BaseModel):
    """Base configuration for content sources."""

    enabled: bool = False
    days: int = Field(default=7, ge=1, le=90, description="Number of days to fetch")
    max_items: int = Field(default=-1, ge=-1, description="Max items (-1 = unlimited)")


class TautulliConfig(ContentSourceConfig):
    """Tautulli-specific configuration."""

    featured_item: bool = Field(default=False, description="Include featured item highlight")


class TunarrConfig(ContentSourceConfig):
    """Tunarr-specific configuration."""

    days: int = Field(default=7, ge=1, le=7, description="Days of TV programming (1-7)")
    channels: list[str] = Field(default_factory=list, description="Channel IDs to include")
    display_format: str = Field(default="grid", description="Display format: grid or list")


class StatisticsConfig(BaseModel):
    """Statistics section configuration."""

    enabled: bool = False
    days: int = Field(default=7, ge=1, le=90, description="Statistics period in days")
    include_comparison: bool = Field(default=False, description="Include period comparison")


class MaintenanceConfig(BaseModel):
    """Maintenance notice configuration."""

    enabled: bool = False
    description: str = Field(default="", description="Maintenance description")
    type: MaintenanceType = Field(default=MaintenanceType.SCHEDULED)
    duration_value: int = Field(default=1, ge=1, description="Duration value")
    duration_unit: str = Field(default="hours", description="Duration unit: hours/days/weeks")
    start_datetime: datetime | None = Field(default=None, description="Maintenance start time")


class GenerationConfig(BaseModel):
    """Full newsletter generation configuration."""

    template_id: str = Field(description="Template ID to use")
    title: str = Field(default="Newsletter {{date.week}}", description="Newsletter title")
    publication_mode: PublicationMode = Field(default=PublicationMode.DRAFT)
    ghost_newsletter_id: str | None = Field(default=None, description="Ghost newsletter/tier ID")

    # Content sources
    tautulli: TautulliConfig = Field(default_factory=TautulliConfig)
    romm: ContentSourceConfig = Field(default_factory=ContentSourceConfig)
    komga: ContentSourceConfig = Field(default_factory=ContentSourceConfig)
    audiobookshelf: ContentSourceConfig = Field(default_factory=ContentSourceConfig)
    tunarr: TunarrConfig = Field(default_factory=TunarrConfig)

    # Statistics
    statistics: StatisticsConfig = Field(default_factory=StatisticsConfig)

    # Maintenance
    maintenance: MaintenanceConfig = Field(default_factory=MaintenanceConfig)

    # Global options
    max_total_items: int = Field(default=-1, ge=-1, description="Max total items (-1 = unlimited)")
    skip_if_empty: bool = Field(default=False, description="Skip generation if no content")


class GenerationRequest(BaseModel):
    """Request to generate a newsletter."""

    config: GenerationConfig


class PreviewRequest(BaseModel):
    """Request to preview a newsletter."""

    config: GenerationConfig


class PreviewResponse(BaseModel):
    """Preview response with rendered HTML."""

    html: str = Field(description="Rendered HTML content")
    title: str = Field(description="Resolved title")
    items_count: int = Field(description="Number of items included")
