"""Application configuration from environment variables."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Security
    app_secret_key: str = Field(
        default="dev-secret-key-change-in-production-32chars",
        description="Secret key for encryption (min 32 characters)",
    )

    # Application
    app_env: str = Field(default="development", description="Environment: development/production")
    app_timezone: str = Field(default="Europe/Paris", description="Default timezone")
    app_log_level: str = Field(default="INFO", description="Logging level")

    # Server
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8080, description="Server port")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:8080",
        description="Comma-separated list of allowed CORS origins",
    )

    # Paths
    config_dir: str = Field(default="/config", description="Configuration directory path")
    templates_dir: str = Field(default="/config/templates", description="Templates directory path")

    # Retention
    retention_history_days: int = Field(default=90, description="Days to keep history entries")
    retention_logs_days: int = Field(default=30, description="Days to keep log entries")

    @property
    def cors_origins_list(self) -> list[str]:
        """Get CORS origins as a list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
