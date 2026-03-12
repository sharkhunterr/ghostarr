"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.v1.router import api_router
from app.config import settings
from app.core.exceptions import GhostarrException, NotFoundError
from app.core.logging import (
    get_logger,
    set_correlation_id,
    setup_logging,
    start_db_logging,
    stop_db_logging,
)
from app.database import Base, async_engine
from app.schemas.common import ErrorResponse, HealthResponse

logger = get_logger(__name__)


async def seed_default_templates():
    """Seed all templates found in the templates directory into the database."""
    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.models.template import Template

    templates_path = Path(settings.templates_dir)
    if not templates_path.exists():
        return

    async with AsyncSessionLocal() as db:
        for template_file in sorted(templates_path.glob("*.html")):
            file_name = template_file.name
            # Check if template already exists by file_path
            result = await db.execute(
                select(Template).where(Template.file_path == file_name)
            )
            existing = result.scalar_one_or_none()

            if not existing:
                # Generate a readable name from the filename
                # template_cyber_punk.html -> Cyber Punk
                name = file_name.replace("template_", "").replace(".html", "")
                name = name.replace("_", " ").title()

                template = Template(
                    name=name,
                    description=f"Template {name}",
                    file_path=file_name,
                    tags=[],
                    is_default=False,
                )
                db.add(template)
                logger.info(f"Seeded template: {name}")

        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    from app.services.scheduler_service import init_scheduler, start_scheduler, stop_scheduler

    # Startup
    setup_logging()
    logger.info(f"Starting Ghostarr v{__version__}")
    logger.info(f"Environment: {settings.app_env}")
    logger.info(f"Timezone: {settings.app_timezone}")

    # Ensure config directory exists
    config_path = Path(settings.config_dir)
    config_path.mkdir(parents=True, exist_ok=True)
    templates_path = Path(settings.templates_dir)
    templates_path.mkdir(parents=True, exist_ok=True)

    # Copy built-in templates to user templates directory if not already present
    # In Docker, built-in templates are at /app/builtin-templates/ (not affected by volume mounts)
    # In development, they are at data/templates/ relative to the backend root
    import shutil

    builtin_candidates = [
        Path("/app/builtin-templates"),  # Docker production
        Path(__file__).parent.parent / "data" / "templates",  # Development
    ]
    for builtin_dir in builtin_candidates:
        if builtin_dir.exists() and any(builtin_dir.glob("*.html")):
            for src_file in builtin_dir.glob("*.html"):
                dest_file = templates_path / src_file.name
                if not dest_file.exists():
                    shutil.copy2(src_file, dest_file)
                    logger.info(f"Copied built-in template: {src_file.name}")
            break

    # Create database tables (in production, use Alembic migrations)
    if settings.app_env == "development":
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created (development mode)")

    # Seed default templates
    await seed_default_templates()

    # Start database logging handler
    start_db_logging()
    logger.info("Database log handler started")

    # Initialize and start scheduler
    init_scheduler()
    await start_scheduler()
    logger.info("Scheduler started")

    yield

    # Shutdown
    logger.info("Shutting down Ghostarr")

    # Stop scheduler
    await stop_scheduler()
    logger.info("Scheduler stopped")

    # Stop database logging handler
    stop_db_logging()

    await async_engine.dispose()


app = FastAPI(
    title="Ghostarr",
    description="Newsletter generator for media server administrators",
    version=__version__,
    lifespan=lifespan,
    docs_url="/docs" if settings.app_env == "development" else None,
    redoc_url="/redoc" if settings.app_env == "development" else None,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """Add correlation ID to each request."""
    correlation_id = request.headers.get("X-Correlation-ID")
    set_correlation_id(correlation_id)

    response = await call_next(request)
    response.headers["X-Correlation-ID"] = set_correlation_id(correlation_id)
    return response


# Exception handlers
@app.exception_handler(GhostarrException)
async def ghostarr_exception_handler(request: Request, exc: GhostarrException):
    """Handle custom Ghostarr exceptions."""
    status_code = 400
    if isinstance(exc, NotFoundError):
        status_code = 404

    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            detail=exc.message,
            code=exc.code,
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            detail="An unexpected error occurred",
            code="internal_error",
        ).model_dump(),
    )


# Health check endpoint
@app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Check application health."""
    return HealthResponse(
        status="ok",
        version=__version__,
        timestamp=datetime.utcnow(),
    )


# Include API router
app.include_router(api_router, prefix="/api/v1")

# Serve static files (frontend) in production
static_path = Path(__file__).parent.parent / "static"
if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")
