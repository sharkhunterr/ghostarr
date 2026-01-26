"""Settings and preferences schemas."""

from pydantic import BaseModel, Field

from app.models.user_preference import SUPPORTED_LANGUAGES, Theme


class ServiceConfig(BaseModel):
    """External service configuration."""

    url: str | None = Field(default=None, description="Service URL")
    api_key: str | None = Field(default=None, description="API key (will be encrypted)")
    username: str | None = Field(default=None, description="Username for basic auth")
    password: str | None = Field(default=None, description="Password for basic auth (will be encrypted)")


class ServiceConfigResponse(BaseModel):
    """Service configuration response (masked)."""

    url: str | None = None
    api_key_masked: str | None = Field(default=None, description="Masked API key (last 4 chars)")
    username: str | None = Field(default=None, description="Username for basic auth")
    password_masked: str | None = Field(default=None, description="Masked password (last 4 chars)")
    is_configured: bool = False


class ServiceTestResult(BaseModel):
    """Result of service connection test."""

    service: str = Field(description="Service name")
    success: bool = Field(description="Connection successful")
    message: str = Field(description="Status message")
    response_time_ms: int | None = Field(default=None, description="Response time in ms")


class AllServicesStatus(BaseModel):
    """Status of all configured services."""

    tautulli: ServiceTestResult | None = None
    tmdb: ServiceTestResult | None = None
    ghost: ServiceTestResult | None = None
    romm: ServiceTestResult | None = None
    komga: ServiceTestResult | None = None
    audiobookshelf: ServiceTestResult | None = None
    tunarr: ServiceTestResult | None = None


class PreferencesUpdate(BaseModel):
    """Update user preferences."""

    theme: Theme | None = None
    language: str | None = Field(default=None, description="Language code (fr/en/de/it/es)")
    timezone: str | None = None

    @property
    def is_valid_language(self) -> bool:
        """Check if language is supported."""
        return self.language is None or self.language in SUPPORTED_LANGUAGES


class PreferencesResponse(BaseModel):
    """User preferences response."""

    theme: Theme
    language: str
    timezone: str

    class Config:
        from_attributes = True


class RetentionSettings(BaseModel):
    """Data retention configuration."""

    history_days: int = Field(default=90, ge=1, le=365, description="Days to keep history")
    logs_days: int = Field(default=30, ge=1, le=365, description="Days to keep logs")


class DeletionLoggingSettings(BaseModel):
    """Deletion logging settings."""

    log_deletions: bool = Field(default=True, description="Log deletion actions in history")


class ConfigExport(BaseModel):
    """Full configuration export."""

    services: dict = Field(description="Service configurations")
    preferences: PreferencesResponse = Field(description="User preferences")
    retention: RetentionSettings = Field(description="Retention settings")
    schedules: list = Field(description="Schedule configurations")
    templates: list = Field(description="Template metadata")
