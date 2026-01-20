"""Newsletter generation API endpoints."""

import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.models.history import History, GenerationType, GenerationStatus
from app.models.template import Template
from app.schemas.generation import (
    GenerationConfig,
    GenerationRequest,
    PreviewRequest,
    PreviewResponse,
)
from app.schemas.history import HistoryResponse
from app.services.newsletter_generator import (
    NewsletterGenerator,
    cancel_generation,
    is_generation_active,
)
from app.services.template_service import template_service
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/generate", response_model=HistoryResponse)
async def generate_newsletter(
    request: GenerationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Start newsletter generation.

    Returns immediately with the history entry. Progress is streamed via SSE.
    """
    # Validate template exists
    template = await db.get(Template, request.config.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Create generator and history entry
    generator = NewsletterGenerator(db, request.config)
    history = await generator.create_history_entry(generation_type=GenerationType.MANUAL)

    # Get generation_id and config before the session closes
    generation_id = generator.generation_id
    config = request.config

    # Run generation in background task with a new session
    async def run_generation():
        # Longer delay to allow SSE connection to establish
        # Client needs time to: receive response -> update state -> create EventSource -> connect
        await asyncio.sleep(1.5)
        try:
            async with AsyncSessionLocal() as new_db:
                bg_generator = NewsletterGenerator(new_db, config)
                bg_generator.generation_id = generation_id
                # Reload the history from the new session
                bg_generator.history = await new_db.get(History, generation_id)
                # Re-initialize tracker
                enabled_steps = bg_generator._get_enabled_steps()
                from app.services.progress_tracker import ProgressTracker
                from app.services.newsletter_generator import _active_generations
                bg_generator.tracker = ProgressTracker(generation_id, enabled_steps)
                _active_generations[generation_id] = bg_generator.tracker

                await bg_generator.run_pipeline()
        except Exception as e:
            logger.error(f"Background generation failed: {e}")

    asyncio.create_task(run_generation())

    return HistoryResponse.model_validate(history)


@router.post("/preview", response_model=PreviewResponse)
async def preview_newsletter(
    request: PreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """Preview newsletter without publishing.

    Fetches real data but doesn't publish to Ghost.
    """
    # Validate template exists
    template = await db.get(Template, request.config.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # For preview, we'll use mock data
    context = template_service.get_mock_context()
    context["title"] = template_service.render_title(request.config.title)

    # Add maintenance if configured
    if request.config.maintenance.enabled:
        context["maintenance"] = request.config.maintenance.model_dump()

    try:
        html = template_service.render(template.file_path, context)

        return PreviewResponse(
            html=html,
            title=context["title"],
            items_count=len(context.get("movies", [])) + len(context.get("series", [])),
        )

    except Exception as e:
        logger.error(f"Preview failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{generation_id}/cancel")
async def cancel_newsletter_generation(
    generation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Cancel an active newsletter generation."""
    # Check if generation exists
    history = await db.get(History, generation_id)
    if not history:
        raise HTTPException(status_code=404, detail="Generation not found")

    if history.status != GenerationStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Generation is not running")

    # Cancel the generation
    cancelled = await cancel_generation(generation_id)

    if cancelled:
        # Update history status
        history.status = GenerationStatus.CANCELLED
        await db.commit()
        return {"status": "cancelled", "generation_id": generation_id}

    raise HTTPException(status_code=400, detail="Could not cancel generation")


@router.get("/{generation_id}/status")
async def get_generation_status(
    generation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get current status of a generation."""
    history = await db.get(History, generation_id)
    if not history:
        raise HTTPException(status_code=404, detail="Generation not found")

    return {
        "generation_id": generation_id,
        "status": history.status.value,
        "is_active": is_generation_active(generation_id),
        "progress_log": history.progress_log,
    }
