"""Templates CRUD API endpoints."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.logging import get_logger
from app.database import get_db
from app.models.label import Label
from app.models.schedule import Schedule
from app.models.template import Template
from app.schemas.template import (
    TemplateExport,
    TemplatePreviewResponse,
    TemplateResponse,
    TemplateUpdate,
)
from app.services.template_service import template_service

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=list[TemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    """List all templates."""
    result = await db.execute(
        select(Template)
        .options(selectinload(Template.labels))
        .order_by(Template.is_default.desc(), Template.name)
    )
    templates = result.scalars().all()
    return [TemplateResponse.model_validate(t) for t in templates]


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)):
    """Get a template by ID."""
    result = await db.execute(
        select(Template)
        .options(selectinload(Template.labels))
        .where(Template.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateResponse.model_validate(template)


@router.get("/{template_id}/export")
async def export_template(template_id: str, db: AsyncSession = Depends(get_db)):
    """Export a template with HTML content, labels, and preset config."""
    result = await db.execute(
        select(Template)
        .options(selectinload(Template.labels))
        .where(Template.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Read HTML file content
    file_path = Path(settings.templates_dir) / template.file_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Template file not found")

    html_content = file_path.read_text(encoding="utf-8")

    # Build export data
    export_data = TemplateExport(
        name=template.name,
        description=template.description,
        html=html_content,
        labels=[label.name for label in template.labels],
        preset_config=template.preset_config or {},
    )

    # Return as downloadable JSON file
    filename = f"{template.name.replace(' ', '_').lower()}_template.json"
    content = json.dumps(export_data.model_dump(), indent=2, ensure_ascii=False)

    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import", response_model=TemplateResponse)
async def import_template(
    data: TemplateExport,
    db: AsyncSession = Depends(get_db),
):
    """Import a template from exported JSON format."""
    import uuid

    # Check for duplicate name
    existing = await db.execute(select(Template).where(Template.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Template with this name already exists")

    # Save HTML file
    templates_dir = Path(settings.templates_dir)
    templates_dir.mkdir(parents=True, exist_ok=True)

    unique_filename = f"{uuid.uuid4().hex}.html"
    file_path = templates_dir / unique_filename

    file_path.write_text(data.html, encoding="utf-8")

    # Validate template
    is_valid, error = template_service.validate_template(unique_filename)
    if not is_valid:
        file_path.unlink()
        raise HTTPException(
            status_code=400,
            detail=f"Invalid template: {error}",
        )

    # Create template record
    template = Template(
        name=data.name,
        description=data.description,
        tags=[],
        file_path=unique_filename,
        is_default=False,
        preset_config=data.preset_config or {},
    )
    db.add(template)

    # Handle labels - find existing or create new ones
    if data.labels:
        for label_name in data.labels:
            # Check if label exists
            result = await db.execute(select(Label).where(Label.name == label_name))
            label = result.scalar_one_or_none()

            if not label:
                # Create new label with default color
                label = Label(name=label_name, color="#6366f1")
                db.add(label)

            template.labels.append(label)

    await db.commit()

    # Re-query with labels loaded
    result = await db.execute(
        select(Template)
        .options(selectinload(Template.labels))
        .where(Template.id == template.id)
    )
    template = result.scalar_one()

    logger.info(f"Imported template: {data.name}")
    return TemplateResponse.model_validate(template)


@router.post("", response_model=TemplateResponse)
async def create_template(
    name: str = Form(...),
    description: str | None = Form(None),
    tags: str | None = Form(None),  # Comma-separated
    is_default: bool = Form(False),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Create a new template by uploading a file."""
    # Validate file type
    if not file.filename.endswith((".html", ".htm", ".zip")):
        raise HTTPException(
            status_code=400,
            detail="File must be .html, .htm, or .zip",
        )

    # Check for duplicate name
    existing = await db.execute(select(Template).where(Template.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Template with this name already exists")

    # Save file
    templates_dir = Path(settings.templates_dir)
    templates_dir.mkdir(parents=True, exist_ok=True)

    # Create unique filename
    import uuid
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = templates_dir / unique_filename

    content = await file.read()
    file_path.write_bytes(content)

    # Validate template if it's an HTML file
    if file_ext.lower() in [".html", ".htm"]:
        is_valid, error = template_service.validate_template(unique_filename)
        if not is_valid:
            # Clean up invalid file
            file_path.unlink()
            raise HTTPException(
                status_code=400,
                detail=f"Invalid template: {error}",
            )

    # If setting as default, unset other defaults
    if is_default:
        await db.execute(
            select(Template).where(Template.is_default)
        )
        result = await db.execute(select(Template).where(Template.is_default))
        for t in result.scalars():
            t.is_default = False

    # Parse tags
    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    # Create template record
    template = Template(
        name=name,
        description=description,
        tags=tag_list,
        file_path=unique_filename,
        is_default=is_default,
        preset_config={},
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    return TemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    update: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a template."""
    template = await db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check for duplicate name
    if update.name and update.name != template.name:
        existing = await db.execute(select(Template).where(Template.name == update.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Template with this name already exists")

    # If setting as default, unset other defaults
    if update.is_default:
        result = await db.execute(
            select(Template).where(Template.is_default, Template.id != template_id)
        )
        for t in result.scalars():
            t.is_default = False

    # Update fields
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)

    return TemplateResponse.model_validate(template)


@router.delete("/{template_id}")
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a template."""
    template = await db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check if template is used by any schedules
    result = await db.execute(
        select(Schedule).where(Schedule.template_id == template_id, Schedule.is_active)
    )
    active_schedules = result.scalars().all()

    if active_schedules:
        schedule_names = [s.name for s in active_schedules]
        raise HTTPException(
            status_code=400,
            detail=f"Template is used by active schedules: {', '.join(schedule_names)}",
        )

    # Delete file
    file_path = Path(settings.templates_dir) / template.file_path
    if file_path.exists():
        file_path.unlink()

    await db.delete(template)
    await db.commit()

    return {"status": "deleted", "template_id": template_id}


@router.get("/{template_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    template_id: str,
    viewport: str = "desktop",
    db: AsyncSession = Depends(get_db),
):
    """Preview a template with mock data."""
    template = await db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    try:
        context = template_service.get_mock_context()
        html = template_service.render(template.file_path, context)

        return TemplatePreviewResponse(html=html, viewport=viewport)

    except Exception as e:
        logger.error(f"Template preview failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/default", response_model=TemplateResponse)
async def get_default_template(db: AsyncSession = Depends(get_db)):
    """Get the default template."""
    result = await db.execute(select(Template).where(Template.is_default))
    template = result.scalar_one_or_none()

    if not template:
        # Return first template if no default set
        result = await db.execute(select(Template).limit(1))
        template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="No templates found")

    return TemplateResponse.model_validate(template)


@router.post("/scan", response_model=list[TemplateResponse])
async def scan_and_import_templates(db: AsyncSession = Depends(get_db)):
    """Scan templates directory and import any templates not already in database."""
    import json
    import uuid

    templates_dir = Path(settings.templates_dir)
    if not templates_dir.exists():
        return []

    # Get all existing template file paths from database
    result = await db.execute(select(Template.file_path))
    existing_files = {row[0] for row in result.fetchall()}

    # Track processed JSON files to avoid re-importing
    processed_json_files: set[str] = set()

    imported = []

    # Scan directory for HTML files
    for file_path in templates_dir.glob("*.html"):
        filename = file_path.name

        # Skip if already in database
        if filename in existing_files:
            continue

        # Skip files that look like UUIDs (uploaded via API)
        if len(filename) == 36 and filename.count("-") == 4:
            continue

        # Validate template
        is_valid, error = template_service.validate_template(filename)
        if not is_valid:
            logger.warning(f"Skipping invalid template {filename}: {error}")
            continue

        # Generate name from filename
        name = filename.replace(".html", "").replace("_", " ").title()

        # Check for duplicate name
        existing_name = await db.execute(select(Template).where(Template.name == name))
        if existing_name.scalar_one_or_none():
            # Add suffix to make unique
            name = f"{name} (imported)"

        # Create template record
        template = Template(
            name=name,
            description=f"Imported from {filename}",
            tags=["imported"],
            file_path=filename,
            is_default=False,
            preset_config={},
        )
        db.add(template)
        imported.append(template)
        logger.info(f"Imported template: {name} from {filename}")

    # Scan directory for JSON files (exported template format)
    for file_path in templates_dir.glob("*.json"):
        filename = file_path.name

        # Skip already processed
        if filename in processed_json_files:
            continue
        processed_json_files.add(filename)

        try:
            # Parse JSON file
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Validate it has required fields
            if not data.get("html") or not isinstance(data.get("html"), str):
                logger.warning(f"Skipping invalid JSON template {filename}: missing html field")
                continue

            # Get or generate name
            name = data.get("name") or filename.replace(".json", "").replace("_", " ").title()

            # Check for duplicate name
            existing_name = await db.execute(select(Template).where(Template.name == name))
            if existing_name.scalar_one_or_none():
                logger.info(f"Skipping JSON template {filename}: name '{name}' already exists")
                continue

            # Save HTML content to a new file
            unique_filename = f"{uuid.uuid4().hex}.html"
            html_path = templates_dir / unique_filename
            html_path.write_text(data["html"], encoding="utf-8")

            # Validate the saved template
            is_valid, error = template_service.validate_template(unique_filename)
            if not is_valid:
                html_path.unlink()
                logger.warning(f"Skipping invalid JSON template {filename}: {error}")
                continue

            # Create template record
            template = Template(
                name=name,
                description=data.get("description") or f"Imported from {filename}",
                tags=["imported"],
                file_path=unique_filename,
                is_default=False,
                preset_config=data.get("preset_config") or {},
            )
            db.add(template)

            # Handle labels
            labels_data = data.get("labels") or []
            for label_name in labels_data:
                if not label_name or not isinstance(label_name, str):
                    continue
                # Check if label exists
                result = await db.execute(select(Label).where(Label.name == label_name))
                label = result.scalar_one_or_none()

                if not label:
                    # Create new label with default color
                    label = Label(name=label_name, color="#6366f1")
                    db.add(label)

                template.labels.append(label)

            imported.append(template)
            logger.info(f"Imported JSON template: {name} from {filename}")

        except json.JSONDecodeError as e:
            logger.warning(f"Skipping invalid JSON file {filename}: {e}")
        except Exception as e:
            logger.warning(f"Error processing JSON template {filename}: {e}")

    await db.commit()

    # Re-query imported templates with labels loaded
    if imported:
        imported_ids = [t.id for t in imported]
        result = await db.execute(
            select(Template)
            .options(selectinload(Template.labels))
            .where(Template.id.in_(imported_ids))
        )
        imported = list(result.scalars().all())

    return [TemplateResponse.model_validate(t) for t in imported]
