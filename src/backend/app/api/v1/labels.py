"""Labels CRUD API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.label import Label
from app.models.template import Template
from app.schemas.label import (
    LabelCreate,
    LabelUpdate,
    LabelResponse,
    TemplateLabelAssignment,
)
from app.schemas.template import TemplateResponse
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=list[LabelResponse])
async def list_labels(db: AsyncSession = Depends(get_db)):
    """List all labels."""
    result = await db.execute(select(Label).order_by(Label.name))
    labels = result.scalars().all()
    return [LabelResponse.model_validate(label) for label in labels]


@router.get("/{label_id}", response_model=LabelResponse)
async def get_label(label_id: str, db: AsyncSession = Depends(get_db)):
    """Get a label by ID."""
    label = await db.get(Label, label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    return LabelResponse.model_validate(label)


@router.post("", response_model=LabelResponse)
async def create_label(
    data: LabelCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new label."""
    # Check for duplicate name
    existing = await db.execute(select(Label).where(Label.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Label with this name already exists")

    label = Label(
        name=data.name,
        color=data.color,
    )
    db.add(label)
    await db.commit()
    await db.refresh(label)

    return LabelResponse.model_validate(label)


@router.put("/{label_id}", response_model=LabelResponse)
async def update_label(
    label_id: str,
    data: LabelUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a label."""
    label = await db.get(Label, label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    # Check for duplicate name
    if data.name and data.name != label.name:
        existing = await db.execute(select(Label).where(Label.name == data.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Label with this name already exists")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(label, field, value)

    await db.commit()
    await db.refresh(label)

    return LabelResponse.model_validate(label)


@router.delete("/{label_id}")
async def delete_label(label_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a label."""
    label = await db.get(Label, label_id)
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    await db.delete(label)
    await db.commit()

    return {"status": "deleted", "label_id": label_id}


@router.post("/templates/{template_id}/labels", response_model=TemplateResponse)
async def assign_labels_to_template(
    template_id: str,
    data: TemplateLabelAssignment,
    db: AsyncSession = Depends(get_db),
):
    """Assign labels to a template (replaces existing labels)."""
    # Get template with labels loaded
    result = await db.execute(
        select(Template)
        .options(selectinload(Template.labels))
        .where(Template.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get labels by IDs
    if data.label_ids:
        result = await db.execute(select(Label).where(Label.id.in_(data.label_ids)))
        labels = result.scalars().all()

        # Check all labels exist
        found_ids = {label.id for label in labels}
        missing_ids = set(data.label_ids) - found_ids
        if missing_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Labels not found: {', '.join(missing_ids)}",
            )

        template.labels = list(labels)
    else:
        template.labels = []

    await db.commit()
    await db.refresh(template)

    return TemplateResponse.model_validate(template)


@router.get("/templates/{template_id}/labels", response_model=list[LabelResponse])
async def get_template_labels(
    template_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get labels assigned to a template."""
    result = await db.execute(
        select(Template)
        .options(selectinload(Template.labels))
        .where(Template.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return [LabelResponse.model_validate(label) for label in template.labels]
