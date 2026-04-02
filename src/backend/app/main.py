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
    """Seed all templates found in the templates directory into the database with labels."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.database import AsyncSessionLocal
    from app.models.label import Label
    from app.models.template import Template

    templates_path = Path(settings.templates_dir)
    if not templates_path.exists():
        return

    # Label definitions: name -> hex color
    BUILTIN_LABELS = {
        "Cinéma": "#ef4444",
        "Rétro": "#f59e0b",
        "Minimal": "#6366f1",
        "Festif": "#10b981",
        "Sci-Fi": "#8b5cf6",
        "Streaming": "#3b82f6",
        "Fun": "#f97316",
        "Statistiques": "#06b6d4",
        "Programme TV": "#14b8a6",
        "Complet": "#ec4899",
        "Nouveautés": "#84cc16",
        # Content-type labels
        "Films": "#3b82f6",
        "Séries": "#8b5cf6",
        "Jeux": "#10b981",
        "Livres": "#f59e0b",
        "Livres Audio": "#06b6d4",
    }

    # Template -> labels mapping (by filename without template_ prefix and .html suffix)
    TEMPLATE_LABELS = {
        "airport": ["Fun", "Films", "Séries", "Jeux", "Livres"],
        "alien": ["Sci-Fi", "Films", "Séries", "Jeux"],
        "anime": ["Fun", "Films", "Séries", "Jeux"],
        "apple": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "art_deco": ["Rétro", "Films", "Séries"],
        "bento": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "blog": ["Minimal", "Films", "Séries"],
        "blueprint": ["Sci-Fi", "Films", "Séries", "Jeux", "Livres"],
        "bobine_cinema": ["Cinéma", "Rétro", "Films", "Séries", "Jeux"],
        "bookclub": ["Fun", "Livres", "Livres Audio"],
        "brutalist": ["Minimal", "Films", "Séries", "Jeux"],
        "casino": ["Fun", "Films", "Séries", "Jeux"],
        "cinema_tickets": ["Cinéma", "Films", "Séries"],
        "complet": ["Complet", "Nouveautés", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "comic": ["Fun", "Films", "Séries", "Jeux"],
        "complet_small": ["Complet", "Statistiques", "Nouveautés", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "cyberpunk": ["Sci-Fi", "Films", "Séries", "Jeux"],
        "dark_minimal": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "disco": ["Rétro", "Fun", "Films", "Séries", "Jeux"],
        "fanart": ["Fun", "Films", "Séries", "Jeux"],
        "film_noir": ["Cinéma", "Rétro", "Films", "Séries", "Jeux", "Livres"],
        "gaming": ["Fun", "Jeux"],
        "glassmorphism": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "gradient_mesh": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "halloween": ["Festif", "Films", "Séries"],
        "harry_potter": ["Fun", "Films", "Séries", "Jeux", "Livres"],
        "horror": ["Cinéma", "Films", "Séries", "Jeux", "Livres"],
        "instagram": ["Streaming", "Films", "Séries"],
        "iphone": ["Minimal", "Films", "Séries", "Jeux"],
        "jellyfin": ["Streaming", "Films", "Séries", "Jeux", "Livres"],
        "journal_papier": ["Rétro", "Films", "Séries", "Jeux"],
        "magazine": ["Minimal", "Films", "Séries", "Jeux"],
        "magazine_jv": ["Fun", "Films", "Séries", "Jeux"],
        "maintenance": ["Minimal", "Films", "Séries"],
        "minimalist": ["Minimal", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "minority_report": ["Sci-Fi", "Films", "Séries", "Jeux"],
        "mixe": ["Complet", "Films", "Séries"],
        "monochrome": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "mosaique": ["Fun", "Films", "Séries", "Jeux", "Livres"],
        "multimedia_complet": ["Complet", "Nouveautés", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "nasa": ["Sci-Fi", "Films", "Séries"],
        "neon": ["Sci-Fi", "Films", "Séries", "Jeux", "Livres"],
        "neon_retro": ["Rétro", "Sci-Fi", "Films", "Séries"],
        "netflix": ["Streaming", "Films", "Séries", "Jeux"],
        "netflix_preview": ["Streaming", "Films", "Séries"],
        "netflix_top10": ["Streaming", "Films", "Séries"],
        "noel": ["Festif", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "noel_calendrier": ["Festif", "Films", "Séries", "Jeux", "Livres"],
        "noel_carte": ["Festif", "Films", "Séries", "Jeux", "Livres"],
        "notion": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "nouveautes_complet": ["Nouveautés", "Complet", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "nouveautes_small": ["Nouveautés", "Films", "Séries"],
        "pastel": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "people": ["Fun", "Films", "Séries", "Jeux"],
        "plex": ["Streaming", "Films", "Séries", "Jeux", "Livres"],
        "polaroid": ["Rétro", "Films", "Séries", "Jeux", "Livres"],
        "posters": ["Minimal", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "posters_email": ["Minimal", "Films", "Séries", "Jeux", "Livres", "Livres Audio"],
        "programme_tv": ["Programme TV", "Films"],
        "radio": ["Rétro", "Films", "Séries", "Jeux"],
        "revue_presse": ["Rétro", "Films", "Séries"],
        "scrapbook": ["Fun", "Films", "Séries", "Jeux", "Livres"],
        "simple_mixe": ["Complet", "Statistiques", "Films", "Séries"],
        "spotify": ["Streaming", "Films", "Séries", "Jeux"],
        "star_wars": ["Sci-Fi", "Films", "Séries", "Jeux"],
        "statistiques_small": ["Statistiques", "Films"],
        "stats_dashboard": ["Statistiques", "Films", "Séries"],
        "steampunk": ["Rétro", "Sci-Fi", "Films", "Séries"],
        "summer": ["Festif", "Films", "Séries"],
        "swiss": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "terminal": ["Sci-Fi", "Films", "Séries", "Jeux"],
        "tuiles": ["Minimal", "Films", "Séries", "Jeux", "Livres"],
        "tunarr": ["Programme TV", "Films"],
        "tv_guide": ["Programme TV", "Films", "Séries", "Jeux", "Livres"],
        "twitch": ["Streaming", "Films", "Séries", "Jeux"],
        "vhs_videoclub": ["Cinéma", "Rétro", "Films", "Séries", "Jeux"],
        "western": ["Rétro", "Films", "Séries"],
        "youtube": ["Streaming", "Films", "Séries", "Jeux"],
    }

    async with AsyncSessionLocal() as db:
        # Ensure all built-in labels exist
        label_cache: dict[str, Label] = {}
        for label_name, label_color in BUILTIN_LABELS.items():
            result = await db.execute(select(Label).where(Label.name == label_name))
            label = result.scalar_one_or_none()
            if not label:
                label = Label(name=label_name, color=label_color)
                db.add(label)
                logger.info(f"Created label: {label_name}")
            label_cache[label_name] = label

        await db.flush()

        # Seed templates
        for template_file in sorted(templates_path.glob("*.html")):
            file_name = template_file.name
            result = await db.execute(
                select(Template).options(selectinload(Template.labels)).where(Template.file_path == file_name)
            )
            existing = result.scalar_one_or_none()

            # Derive template key from filename
            template_key = file_name.replace("template_", "").replace(".html", "")

            if not existing:
                # Generate a readable name from the filename
                name = template_key.replace("_", " ").title()

                template = Template(
                    name=name,
                    description=f"Template {name}",
                    file_path=file_name,
                    tags=[],
                    is_default=False,
                )
                db.add(template)

                # Assign labels to built-in templates
                label_names = TEMPLATE_LABELS.get(template_key, [])
                for label_name in label_names:
                    if label_name in label_cache:
                        template.labels.append(label_cache[label_name])

                logger.info(f"Seeded template: {name} (labels: {label_names})")
            else:
                # Sync labels for existing templates: add missing labels
                label_names = TEMPLATE_LABELS.get(template_key, [])
                existing_label_names = {lbl.name for lbl in existing.labels}
                for label_name in label_names:
                    if label_name not in existing_label_names and label_name in label_cache:
                        existing.labels.append(label_cache[label_name])
                added = [n for n in label_names if n not in existing_label_names and n in label_cache]
                if added:
                    logger.info(f"Updated template labels: {existing.name} (+{added})")

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
