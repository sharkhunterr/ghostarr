"""History CRUD API endpoints."""

import csv
import io
import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.database import get_db
from app.integrations.ghost import ghost_client
from app.models.history import GenerationStatus, GenerationType, History
from app.models.template import Template
from app.schemas.generation import GenerationConfig
from app.schemas.history import (
    HistoryExportFormat,
    HistoryResponse,
)
from app.services.deletion_service import DeletionService
from app.services.newsletter_generator import NewsletterGenerator

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=list[HistoryResponse])
async def list_history(
    type: GenerationType | None = None,
    status: GenerationStatus | None = None,
    template_id: str | None = None,
    schedule_id: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List history entries with optional filters."""
    query = select(History).options(
        selectinload(History.template),
        selectinload(History.schedule),
    )

    # Apply filters
    conditions = []
    if type:
        conditions.append(History.type == type)
    if status:
        conditions.append(History.status == status)
    if template_id:
        conditions.append(History.template_id == template_id)
    if schedule_id:
        conditions.append(History.schedule_id == schedule_id)
    if start_date:
        conditions.append(History.created_at >= start_date)
    if end_date:
        conditions.append(History.created_at <= end_date)

    if conditions:
        query = query.where(and_(*conditions))

    # Order by creation date descending
    query = query.order_by(desc(History.created_at))

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    entries = result.scalars().all()

    return [HistoryResponse.model_validate(e) for e in entries]


@router.get("/export")
async def export_history(
    format: HistoryExportFormat = HistoryExportFormat.JSON,
    type: GenerationType | None = None,
    status: GenerationStatus | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Export history entries to JSON or CSV."""
    query = select(History)

    # Apply filters
    conditions = []
    if type:
        conditions.append(History.type == type)
    if status:
        conditions.append(History.status == status)
    if start_date:
        conditions.append(History.created_at >= start_date)
    if end_date:
        conditions.append(History.created_at <= end_date)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(desc(History.created_at))

    result = await db.execute(query)
    entries = result.scalars().all()

    if format == HistoryExportFormat.JSON:
        data = [
            {
                "id": e.id,
                "type": e.type.value,
                "status": e.status.value,
                "template_id": e.template_id,
                "schedule_id": e.schedule_id,
                "ghost_post_id": e.ghost_post_id,
                "ghost_post_url": e.ghost_post_url,
                "items_count": e.items_count,
                "duration_seconds": e.duration_seconds,
                "error_message": e.error_message,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "started_at": e.started_at.isoformat() if e.started_at else None,
                "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            }
            for e in entries
        ]

        return StreamingResponse(
            io.BytesIO(json.dumps(data, indent=2).encode()),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=history_export.json"},
        )

    else:  # CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "id", "type", "status", "template_id", "schedule_id",
            "ghost_post_id", "ghost_post_url", "items_count",
            "duration_seconds", "error_message", "created_at",
            "started_at", "completed_at"
        ])

        # Data rows
        for e in entries:
            writer.writerow([
                e.id,
                e.type.value,
                e.status.value,
                e.template_id,
                e.schedule_id,
                e.ghost_post_id,
                e.ghost_post_url,
                e.items_count,
                e.duration_seconds,
                e.error_message,
                e.created_at.isoformat() if e.created_at else "",
                e.started_at.isoformat() if e.started_at else "",
                e.completed_at.isoformat() if e.completed_at else "",
            ])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=history_export.csv"},
        )


@router.get("/{history_id}", response_model=HistoryResponse)
async def get_history(history_id: str, db: AsyncSession = Depends(get_db)):
    """Get a history entry by ID."""
    result = await db.execute(
        select(History)
        .where(History.id == history_id)
        .options(
            selectinload(History.template),
            selectinload(History.schedule),
        )
    )
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    return HistoryResponse.model_validate(entry)


@router.delete("/{history_id}")
async def delete_history(history_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a history entry."""
    entry = await db.get(History, history_id)
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    await db.delete(entry)
    await db.commit()

    return {"status": "deleted", "history_id": history_id}


@router.post("/bulk-delete")
async def bulk_delete_history(
    history_ids: list[str],
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple history entries at once."""
    if not history_ids:
        raise HTTPException(status_code=400, detail="No history IDs provided")

    deleted_count = 0
    for history_id in history_ids:
        entry = await db.get(History, history_id)
        if entry:
            await db.delete(entry)
            deleted_count += 1

    await db.commit()

    # Log manual deletion in history if enabled
    deletion_service = DeletionService(db)
    await deletion_service.log_manual_deletion(
        deleted_count=deleted_count,
        ghost_deleted_count=0,
        errors=None,
    )

    return {"status": "deleted", "deleted_count": deleted_count}


@router.post("/bulk-delete-with-ghost")
async def bulk_delete_history_with_ghost(
    history_ids: list[str],
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple history entries and their Ghost posts."""
    if not history_ids:
        raise HTTPException(status_code=400, detail="No history IDs provided")

    deleted_count = 0
    ghost_deleted_count = 0
    errors = []

    for history_id in history_ids:
        entry = await db.get(History, history_id)
        if entry:
            # Try to delete Ghost post if exists
            if entry.ghost_post_id:
                try:
                    await ghost_client.delete_post(entry.ghost_post_id)
                    ghost_deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to delete Ghost post {entry.ghost_post_id}: {e}")
                    errors.append(f"Ghost post {entry.ghost_post_id}: {str(e)}")

            await db.delete(entry)
            deleted_count += 1

    await db.commit()

    # Log manual deletion in history if enabled
    deletion_service = DeletionService(db)
    await deletion_service.log_manual_deletion(
        deleted_count=deleted_count,
        ghost_deleted_count=ghost_deleted_count,
        errors=errors if errors else None,
    )

    return {
        "status": "deleted",
        "deleted_count": deleted_count,
        "ghost_deleted_count": ghost_deleted_count,
        "errors": errors if errors else None,
    }


@router.post("/{history_id}/regenerate", response_model=HistoryResponse)
async def regenerate_history(history_id: str, db: AsyncSession = Depends(get_db)):
    """Regenerate a newsletter from a history entry."""
    entry = await db.get(History, history_id)
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    # Validate template still exists
    template = await db.get(Template, entry.template_id)
    if not template:
        raise HTTPException(
            status_code=400,
            detail="Template used for this generation no longer exists"
        )

    try:
        # Create generation config from history entry
        config = GenerationConfig.model_validate(entry.generation_config)

        # Create and run generator
        generator = NewsletterGenerator(db, config)
        new_history = await generator.generate(
            generation_type=GenerationType.MANUAL,
            schedule_id=None,
        )

        return HistoryResponse.model_validate(new_history)

    except Exception as e:
        logger.error(f"Regeneration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{history_id}/ghost-post")
async def delete_ghost_post(history_id: str, db: AsyncSession = Depends(get_db)):
    """Delete the Ghost post associated with a history entry."""
    entry = await db.get(History, history_id)
    if not entry:
        raise HTTPException(status_code=404, detail="History entry not found")

    if not entry.ghost_post_id:
        raise HTTPException(
            status_code=400,
            detail="No Ghost post associated with this history entry"
        )

    try:
        # Delete from Ghost
        await ghost_client.delete_post(entry.ghost_post_id)

        # Update history entry
        entry.ghost_post_id = None
        entry.ghost_post_url = None
        await db.commit()

        return {"status": "deleted", "history_id": history_id}

    except Exception as e:
        logger.error(f"Failed to delete Ghost post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def purge_old_history(retention_days: int = 90) -> int:
    """Purge history entries older than retention period.

    This function is designed to be called by the scheduler.

    Args:
        retention_days: Number of days to keep history entries

    Returns:
        Number of entries purged
    """
    from app.database import AsyncSessionLocal

    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(History).where(History.created_at < cutoff_date)
        )
        entries = result.scalars().all()

        count = len(entries)
        for entry in entries:
            await db.delete(entry)

        await db.commit()

    logger.info(f"Purged {count} history entries older than {retention_days} days")
    return count
