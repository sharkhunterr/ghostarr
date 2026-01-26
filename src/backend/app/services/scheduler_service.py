"""Scheduler service for automatic newsletter generation using APScheduler."""

from datetime import datetime

import pytz
from apscheduler.job import Job
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.logging import get_logger
from app.database import SYNC_DATABASE_URL, AsyncSessionLocal
from app.models.history import GenerationType
from app.models.schedule import RunStatus, Schedule, ScheduleType
from app.schemas.generation import GenerationConfig

logger = get_logger(__name__)

# Global scheduler instance
_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    """Get the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized")
    return _scheduler


def init_scheduler() -> AsyncIOScheduler:
    """Initialize the APScheduler with SQLAlchemy job store."""
    global _scheduler

    if _scheduler is not None:
        return _scheduler

    # Configure job stores
    jobstores = {
        "default": SQLAlchemyJobStore(url=SYNC_DATABASE_URL, tablename="apscheduler_jobs"),
    }

    # Configure executors
    executors = {
        "default": {"type": "asyncio"},
    }

    # Job defaults
    job_defaults = {
        "coalesce": True,  # Combine missed runs into one
        "max_instances": 1,  # Only one instance of each job at a time
        "misfire_grace_time": 60 * 60,  # 1 hour grace period for missed jobs
    }

    _scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone=pytz.timezone(settings.app_timezone),
    )

    logger.info("Scheduler initialized")
    return _scheduler


async def start_scheduler() -> None:
    """Start the scheduler and load all active schedules."""
    scheduler = get_scheduler()

    if scheduler.running:
        logger.warning("Scheduler already running")
        return

    # Load active schedules from database
    async with AsyncSessionLocal() as db:
        await load_schedules_from_db(db)

    scheduler.start()
    logger.info("Scheduler started")


async def stop_scheduler() -> None:
    """Stop the scheduler gracefully."""
    global _scheduler

    if _scheduler is None:
        return

    if _scheduler.running:
        _scheduler.shutdown(wait=True)
        logger.info("Scheduler stopped")

    _scheduler = None


async def load_schedules_from_db(db: AsyncSession) -> None:
    """Load all active schedules from database and add them to scheduler."""
    result = await db.execute(
        select(Schedule).where(Schedule.is_active)
    )
    schedules = result.scalars().all()

    for schedule in schedules:
        try:
            add_schedule_job(schedule)
            logger.info(f"Loaded schedule: {schedule.name} ({schedule.id})")
        except Exception as e:
            logger.error(f"Failed to load schedule {schedule.id}: {e}")


def add_schedule_job(schedule: Schedule) -> Job | None:
    """Add a schedule as an APScheduler job."""
    scheduler = get_scheduler()

    try:
        trigger = CronTrigger.from_crontab(
            schedule.cron_expression,
            timezone=pytz.timezone(schedule.timezone),
        )

        # Choose executor based on schedule type
        if schedule.schedule_type == ScheduleType.DELETION:
            executor_func = execute_scheduled_deletion
        else:
            executor_func = execute_scheduled_generation

        job = scheduler.add_job(
            executor_func,
            trigger=trigger,
            id=f"schedule_{schedule.id}",
            name=schedule.name,
            args=[schedule.id],
            replace_existing=True,
        )

        logger.info(f"Added job for schedule {schedule.id}, next run: {job.next_run_time}")
        return job

    except Exception as e:
        logger.error(f"Failed to add job for schedule {schedule.id}: {e}")
        return None


def remove_schedule_job(schedule_id: str) -> bool:
    """Remove a schedule job from the scheduler."""
    scheduler = get_scheduler()
    job_id = f"schedule_{schedule_id}"

    try:
        scheduler.remove_job(job_id)
        logger.info(f"Removed job for schedule {schedule_id}")
        return True
    except Exception as e:
        logger.warning(f"Failed to remove job {job_id}: {e}")
        return False


def pause_schedule_job(schedule_id: str) -> bool:
    """Pause a schedule job."""
    scheduler = get_scheduler()
    job_id = f"schedule_{schedule_id}"

    try:
        scheduler.pause_job(job_id)
        logger.info(f"Paused job for schedule {schedule_id}")
        return True
    except Exception as e:
        logger.warning(f"Failed to pause job {job_id}: {e}")
        return False


def resume_schedule_job(schedule_id: str) -> bool:
    """Resume a paused schedule job."""
    scheduler = get_scheduler()
    job_id = f"schedule_{schedule_id}"

    try:
        scheduler.resume_job(job_id)
        logger.info(f"Resumed job for schedule {schedule_id}")
        return True
    except Exception as e:
        logger.warning(f"Failed to resume job {job_id}: {e}")
        return False


def get_job_next_run(schedule_id: str) -> datetime | None:
    """Get the next run time for a schedule job."""
    scheduler = get_scheduler()
    job_id = f"schedule_{schedule_id}"

    try:
        job = scheduler.get_job(job_id)
        return job.next_run_time if job else None
    except Exception:
        return None


async def execute_scheduled_generation(schedule_id: str) -> None:
    """Execute a scheduled newsletter generation."""
    from app.services.newsletter_generator import NewsletterGenerator

    logger.info(f"Executing scheduled generation for schedule {schedule_id}")

    async with AsyncSessionLocal() as db:
        # Get the schedule
        schedule = await db.get(Schedule, schedule_id)

        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            return

        if not schedule.is_active:
            logger.warning(f"Schedule {schedule_id} is not active, skipping")
            return

        try:
            # Create generation config from schedule
            config = GenerationConfig.model_validate(schedule.generation_config)

            # Create and run generator
            generator = NewsletterGenerator(db, config)
            history = await generator.generate(
                generation_type=GenerationType.AUTOMATIC,
                schedule_id=schedule_id,
            )

            # Update schedule last run info
            schedule.last_run_at = datetime.utcnow()
            # Map history status to RunStatus enum
            if history.status.value == "success":
                schedule.last_run_status = RunStatus.SUCCESS
            elif history.status.value == "failed":
                schedule.last_run_status = RunStatus.FAILED
            else:
                schedule.last_run_status = RunStatus.PENDING

            # Update next run time
            job = get_scheduler().get_job(f"schedule_{schedule_id}")
            if job:
                schedule.next_run_at = job.next_run_time

            await db.commit()

            logger.info(
                f"Scheduled generation completed for {schedule_id}: "
                f"status={history.status.value}, items={history.items_count}"
            )

        except Exception as e:
            logger.exception(f"Scheduled generation failed for {schedule_id}: {e}")

            # Update schedule with failure
            schedule.last_run_at = datetime.utcnow()
            schedule.last_run_status = RunStatus.FAILED
            await db.commit()


async def execute_scheduled_deletion(schedule_id: str) -> None:
    """Execute a scheduled deletion/cleanup."""
    from app.services.deletion_service import DeletionService

    logger.info(f"Executing scheduled deletion for schedule {schedule_id}")

    async with AsyncSessionLocal() as db:
        # Get the schedule
        schedule = await db.get(Schedule, schedule_id)

        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            return

        if not schedule.is_active:
            logger.warning(f"Schedule {schedule_id} is not active, skipping")
            return

        try:
            # Get deletion config
            deletion_config = schedule.deletion_config or {}
            retention_days = deletion_config.get("retention_days", 30)
            delete_from_ghost = deletion_config.get("delete_from_ghost", False)

            # Execute cleanup
            service = DeletionService(db)
            result = await service.execute_cleanup(
                retention_days=retention_days,
                delete_from_ghost=delete_from_ghost,
                schedule_id=schedule_id,
            )

            # Update schedule last run info
            schedule.last_run_at = datetime.utcnow()
            schedule.last_run_status = RunStatus.SUCCESS

            # Update next run time
            job = get_scheduler().get_job(f"schedule_{schedule_id}")
            if job:
                schedule.next_run_at = job.next_run_time

            await db.commit()

            logger.info(
                f"Scheduled deletion completed for {schedule_id}: "
                f"deleted={result['deleted_count']}, ghost={result['ghost_deleted_count']}"
            )

        except Exception as e:
            logger.exception(f"Scheduled deletion failed for {schedule_id}: {e}")

            # Update schedule with failure
            schedule.last_run_at = datetime.utcnow()
            schedule.last_run_status = RunStatus.FAILED
            await db.commit()


def validate_cron_expression(expression: str) -> tuple[bool, str | None]:
    """Validate a CRON expression.

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        croniter(expression)
        return True, None
    except (ValueError, KeyError) as e:
        return False, str(e)


def get_cron_description(expression: str) -> str:
    """Get a human-readable description of a CRON expression."""
    # Basic descriptions for common patterns
    parts = expression.split()
    if len(parts) != 5:
        return expression

    minute, hour, day, month, weekday = parts

    descriptions = []

    # Time
    if minute != "*" and hour != "*":
        descriptions.append(f"at {hour.zfill(2)}:{minute.zfill(2)}")
    elif hour != "*":
        descriptions.append(f"at {hour}:00")

    # Day of week
    weekday_names = {
        "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
        "4": "Thursday", "5": "Friday", "6": "Saturday", "7": "Sunday",
        "SUN": "Sunday", "MON": "Monday", "TUE": "Tuesday", "WED": "Wednesday",
        "THU": "Thursday", "FRI": "Friday", "SAT": "Saturday",
    }

    if weekday != "*":
        if weekday in weekday_names:
            descriptions.append(f"every {weekday_names[weekday]}")
        else:
            descriptions.append(f"on day {weekday}")

    # Day of month
    if day != "*":
        descriptions.append(f"on day {day}")

    # Month
    if month != "*":
        descriptions.append(f"in month {month}")

    if not descriptions:
        return "every minute"

    return " ".join(descriptions)


def get_next_runs(expression: str, timezone: str = "UTC", count: int = 5) -> list[datetime]:
    """Get the next N run times for a CRON expression."""
    try:
        tz = pytz.timezone(timezone)
        cron = croniter(expression, datetime.now(tz))

        runs = []
        for _ in range(count):
            runs.append(cron.get_next(datetime))

        return runs
    except Exception:
        return []
