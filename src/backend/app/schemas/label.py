"""Label schemas."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class LabelBase(BaseModel):
    """Base label schema."""

    name: str = Field(min_length=1, max_length=50, description="Label name")
    color: str = Field(
        default="#6366f1",
        min_length=7,
        max_length=7,
        description="Hex color code (e.g., #6366f1)",
    )

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        """Validate hex color format."""
        if not v.startswith("#"):
            raise ValueError("Color must start with #")
        if len(v) != 7:
            raise ValueError("Color must be 7 characters (e.g., #6366f1)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color format")
        return v.lower()


class LabelCreate(LabelBase):
    """Schema for creating a label."""

    pass


class LabelUpdate(BaseModel):
    """Schema for updating a label."""

    name: str | None = Field(default=None, min_length=1, max_length=50)
    color: str | None = Field(default=None, min_length=7, max_length=7)

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        """Validate hex color format."""
        if v is None:
            return v
        if not v.startswith("#"):
            raise ValueError("Color must start with #")
        if len(v) != 7:
            raise ValueError("Color must be 7 characters (e.g., #6366f1)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color format")
        return v.lower()


class LabelResponse(LabelBase):
    """Label response schema."""

    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateLabelAssignment(BaseModel):
    """Schema for assigning labels to a template."""

    label_ids: list[str] = Field(description="List of label IDs to assign")
