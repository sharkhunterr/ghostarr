"""Logs API endpoints."""

import csv
import io
import json
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.log import Log, LogLevel, LogSource
from app.schemas.common import PaginatedResponse
from app.schemas.log import LogCreate, LogResponse, LogStats

router = APIRouter()


@router.get("", response_model=PaginatedResponse[LogResponse])
async def list_logs(
    level: Annotated[LogLevel | None, Query()] = None,
    source: Annotated[LogSource | None, Query()] = None,
    service: Annotated[str | None, Query()] = None,
    start_date: Annotated[datetime | None, Query()] = None,
    end_date: Annotated[datetime | None, Query()] = None,
    correlation_id: Annotated[str | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get logs with optional filtering and pagination."""
    # Build base query
    query = select(Log)
    count_query = select(func.count()).select_from(Log)

    # Apply filters
    if level:
        query = query.where(Log.level == level)
        count_query = count_query.where(Log.level == level)

    if source:
        query = query.where(Log.source == source)
        count_query = count_query.where(Log.source == source)

    if service:
        query = query.where(Log.service == service)
        count_query = count_query.where(Log.service == service)

    if start_date:
        query = query.where(Log.created_at >= start_date)
        count_query = count_query.where(Log.created_at >= start_date)

    if end_date:
        query = query.where(Log.created_at <= end_date)
        count_query = count_query.where(Log.created_at <= end_date)

    if correlation_id:
        query = query.where(Log.correlation_id == correlation_id)
        count_query = count_query.where(Log.correlation_id == correlation_id)

    if search:
        query = query.where(Log.message.ilike(f"%{search}%"))
        count_query = count_query.where(Log.message.ilike(f"%{search}%"))

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination and ordering
    offset = (page - 1) * page_size
    query = query.order_by(Log.created_at.desc()).offset(offset).limit(page_size)

    # Execute query
    result = await db.execute(query)
    logs = result.scalars().all()

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size

    return PaginatedResponse(
        items=[LogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/stats", response_model=LogStats)
async def get_log_stats(
    days: Annotated[int, Query(ge=1, le=365)] = 7,
    db: AsyncSession = Depends(get_db),
):
    """Get log statistics for the specified period."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Total count
    total_result = await db.execute(
        select(func.count()).select_from(Log).where(Log.created_at >= cutoff)
    )
    total = total_result.scalar() or 0

    # Count by level
    level_result = await db.execute(
        select(Log.level, func.count())
        .where(Log.created_at >= cutoff)
        .group_by(Log.level)
    )
    by_level = {row[0].value: row[1] for row in level_result.all()}

    # Count by source
    source_result = await db.execute(
        select(Log.source, func.count())
        .where(Log.created_at >= cutoff)
        .group_by(Log.source)
    )
    by_source = {row[0].value: row[1] for row in source_result.all()}

    # Count by service
    service_result = await db.execute(
        select(Log.service, func.count())
        .where(Log.created_at >= cutoff)
        .where(Log.service.isnot(None))
        .group_by(Log.service)
    )
    by_service = {row[0]: row[1] for row in service_result.all() if row[0]}

    return LogStats(
        total=total,
        by_level=by_level,
        by_source=by_source,
        by_service=by_service,
    )


@router.get("/export")
async def export_logs(
    format: Annotated[str, Query(pattern="^(json|csv)$")] = "json",
    level: Annotated[LogLevel | None, Query()] = None,
    source: Annotated[LogSource | None, Query()] = None,
    service: Annotated[str | None, Query()] = None,
    start_date: Annotated[datetime | None, Query()] = None,
    end_date: Annotated[datetime | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    """Export logs in JSON or CSV format."""
    # Build query
    query = select(Log).order_by(Log.created_at.desc())

    if level:
        query = query.where(Log.level == level)
    if source:
        query = query.where(Log.source == source)
    if service:
        query = query.where(Log.service == service)
    if start_date:
        query = query.where(Log.created_at >= start_date)
    if end_date:
        query = query.where(Log.created_at <= end_date)

    # Limit to 10000 logs max
    query = query.limit(10000)

    result = await db.execute(query)
    logs = result.scalars().all()

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["id", "level", "source", "service", "message", "correlation_id", "created_at"]
        )

        for log in logs:
            writer.writerow([
                log.id,
                log.level.value,
                log.source.value,
                log.service,
                log.message,
                log.correlation_id,
                log.created_at.isoformat(),
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=logs-{datetime.utcnow().strftime('%Y%m%d')}.csv"
            },
        )
    else:
        data = [
            {
                "id": log.id,
                "level": log.level.value,
                "source": log.source.value,
                "service": log.service,
                "message": log.message,
                "context": log.context,
                "correlation_id": log.correlation_id,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]

        output = io.StringIO()
        json.dump(data, output, indent=2)
        output.seek(0)

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=logs-{datetime.utcnow().strftime('%Y%m%d')}.json"
            },
        )


@router.post("", response_model=LogResponse)
async def create_log(
    log_data: LogCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new log entry (mainly for frontend logging)."""
    log = Log(
        level=log_data.level,
        source=log_data.source,
        service=log_data.service,
        message=log_data.message,
        context=log_data.context,
        correlation_id=log_data.correlation_id,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return LogResponse.model_validate(log)


@router.delete("/purge")
async def purge_logs(
    days: Annotated[int, Query(ge=1, description="Delete logs older than X days")] = 30,
    db: AsyncSession = Depends(get_db),
):
    """Purge logs older than specified days."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Count logs to delete
    count_result = await db.execute(
        select(func.count()).select_from(Log).where(Log.created_at < cutoff)
    )
    count = count_result.scalar() or 0

    # Delete old logs
    await db.execute(delete(Log).where(Log.created_at < cutoff))
    await db.commit()

    return {"deleted": count, "cutoff_date": cutoff.isoformat()}
