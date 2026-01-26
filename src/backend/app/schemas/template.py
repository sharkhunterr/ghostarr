"""Template schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.label import LabelResponse


class TemplateBase(BaseModel):
    """Base template schema."""

    name: str = Field(min_length=1, max_length=255, description="Template name")
    description: str | None = Field(default=None, description="Template description")
    tags: list[str] = Field(default_factory=list, max_length=10, description="Legacy template tags")


class TemplateCreate(TemplateBase):
    """Schema for creating a template."""

    file_path: str = Field(description="Path to template file")
    preset_config: dict | None = Field(default=None, description="Preset generation config")
    is_default: bool = Field(default=False, description="Set as default template")


class TemplateUpdate(BaseModel):
    """Schema for updating a template."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    tags: list[str] | None = Field(default=None, max_length=10)
    preset_config: dict | None = None
    is_default: bool | None = None


class TemplateResponse(TemplateBase):
    """Template response schema."""

    id: str
    file_path: str
    preset_config: dict
    is_default: bool
    labels: list[LabelResponse] = Field(default_factory=list, description="Associated labels")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplatePreviewRequest(BaseModel):
    """Request to preview a template with mock data."""

    viewport: str = Field(default="desktop", description="Viewport: mobile/tablet/desktop")


class TemplatePreviewResponse(BaseModel):
    """Template preview response."""

    html: str = Field(description="Rendered HTML with mock data")
    viewport: str
