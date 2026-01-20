"""Schedules CRUD API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.schedule import Schedule
from app.models.template import Template
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleNextRuns,
)
from app.services.scheduler_service import (
    add_schedule_job,
    remove_schedule_job,
    pause_schedule_job,
    resume_schedule_job,
    get_job_next_run,
    execute_scheduled_generation,
    validate_cron_expression,
    get_cron_description,
    get_next_runs,
)
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(db: AsyncSession = Depends(get_db)):
    """List all schedules."""
    result = await db.execute(
        select(Schedule).order_by(Schedule.is_active.desc(), Schedule.name)
    )
    schedules = result.scalars().all()

    # Update next_run_at from scheduler
    for schedule in schedules:
        if schedule.is_active:
            next_run = get_job_next_run(schedule.id)
            if next_run:
                schedule.next_run_at = next_run

    return [ScheduleResponse.model_validate(s) for s in schedules]


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    """Get a schedule by ID."""
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Update next_run_at from scheduler
    if schedule.is_active:
        next_run = get_job_next_run(schedule.id)
        if next_run:
            schedule.next_run_at = next_run

    return ScheduleResponse.model_validate(schedule)


@router.post("", response_model=ScheduleResponse)
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new schedule."""
    # Validate CRON expression
    is_valid, error = validate_cron_expression(data.cron_expression)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid CRON expression: {error}")

    # Validate template exists
    template = await db.get(Template, data.template_id)
    if not template:
        raise HTTPException(status_code=400, detail="Template not found")

    # Check for duplicate name
    existing = await db.execute(select(Schedule).where(Schedule.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Schedule with this name already exists")

    # Create schedule
    schedule = Schedule(
        name=data.name,
        cron_expression=data.cron_expression,
        timezone=data.timezone or "UTC",
        template_id=data.template_id,
        generation_config=data.generation_config.model_dump(),
        is_active=data.is_active if data.is_active is not None else True,
    )
    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)

    # Add to scheduler if active
    if schedule.is_active:
        job = add_schedule_job(schedule)
        if job:
            schedule.next_run_at = job.next_run_time
            await db.commit()

    return ScheduleResponse.model_validate(schedule)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a schedule."""
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Validate CRON if provided
    if data.cron_expression:
        is_valid, error = validate_cron_expression(data.cron_expression)
        if not is_valid:
            raise HTTPException(status_code=400, detail=f"Invalid CRON expression: {error}")

    # Validate template if provided
    if data.template_id:
        template = await db.get(Template, data.template_id)
        if not template:
            raise HTTPException(status_code=400, detail="Template not found")

    # Check for duplicate name
    if data.name and data.name != schedule.name:
        existing = await db.execute(select(Schedule).where(Schedule.name == data.name))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Schedule with this name already exists")

    # Track if we need to update scheduler
    needs_reschedule = False
    was_active = schedule.is_active

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "generation_config" and value:
            value = value.model_dump() if hasattr(value, "model_dump") else value
        setattr(schedule, field, value)
        if field in ["cron_expression", "timezone", "is_active"]:
            needs_reschedule = True

    await db.commit()

    # Update scheduler job
    if needs_reschedule:
        if was_active:
            remove_schedule_job(schedule_id)

        if schedule.is_active:
            job = add_schedule_job(schedule)
            if job:
                schedule.next_run_at = job.next_run_time
                await db.commit()
        else:
            schedule.next_run_at = None
            await db.commit()

    await db.refresh(schedule)
    return ScheduleResponse.model_validate(schedule)


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a schedule."""
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Remove from scheduler
    if schedule.is_active:
        remove_schedule_job(schedule_id)

    await db.delete(schedule)
    await db.commit()

    return {"status": "deleted", "schedule_id": schedule_id}


@router.patch("/{schedule_id}/toggle", response_model=ScheduleResponse)
async def toggle_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    """Toggle a schedule's active state."""
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    schedule.is_active = not schedule.is_active

    if schedule.is_active:
        job = add_schedule_job(schedule)
        if job:
            schedule.next_run_at = job.next_run_time
    else:
        remove_schedule_job(schedule_id)
        schedule.next_run_at = None

    await db.commit()
    await db.refresh(schedule)

    return ScheduleResponse.model_validate(schedule)


@router.post("/{schedule_id}/execute")
async def execute_schedule(schedule_id: str, db: AsyncSession = Depends(get_db)):
    """Execute a schedule immediately (manual trigger)."""
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # Execute in background
    import asyncio
    asyncio.create_task(execute_scheduled_generation(schedule_id))

    return {"status": "started", "schedule_id": schedule_id}


@router.get("/{schedule_id}/next-runs", response_model=ScheduleNextRuns)
async def get_schedule_next_runs(
    schedule_id: str,
    count: int = 5,
    db: AsyncSession = Depends(get_db),
):
    """Get the next N run times for a schedule."""
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    next_runs = get_next_runs(schedule.cron_expression, schedule.timezone, count)
    description = get_cron_description(schedule.cron_expression)

    return ScheduleNextRuns(
        schedule_id=schedule_id,
        cron_expression=schedule.cron_expression,
        cron_description=description,
        next_runs=[run.isoformat() for run in next_runs],
    )


@router.post("/validate-cron")
async def validate_cron(expression: str):
    """Validate a CRON expression and get its description."""
    is_valid, error = validate_cron_expression(expression)

    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid CRON expression: {error}")

    description = get_cron_description(expression)
    next_runs = get_next_runs(expression, "UTC", 5)

    return {
        "valid": True,
        "expression": expression,
        "description": description,
        "next_runs": [run.isoformat() for run in next_runs],
    }
