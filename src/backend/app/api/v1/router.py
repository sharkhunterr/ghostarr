"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.help import router as help_router
from app.api.v1.history import router as history_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.labels import router as labels_router
from app.api.v1.logs import router as logs_router
from app.api.v1.newsletters import router as newsletters_router
from app.api.v1.progress import router as progress_router
from app.api.v1.schedules import router as schedules_router

# Import routers
from app.api.v1.settings import router as settings_router
from app.api.v1.templates import router as templates_router

api_router = APIRouter()

# Register routers
api_router.include_router(settings_router, prefix="/settings", tags=["Settings"])
api_router.include_router(integrations_router, prefix="/integrations", tags=["Integrations"])
api_router.include_router(newsletters_router, prefix="/newsletters", tags=["Newsletters"])
api_router.include_router(templates_router, prefix="/templates", tags=["Templates"])
api_router.include_router(labels_router, prefix="/labels", tags=["Labels"])
api_router.include_router(progress_router, prefix="/progress", tags=["Progress"])
api_router.include_router(schedules_router, prefix="/schedules", tags=["Schedules"])
api_router.include_router(history_router, prefix="/history", tags=["History"])
api_router.include_router(logs_router, prefix="/logs", tags=["Logs"])
api_router.include_router(help_router, prefix="/help", tags=["Help"])
