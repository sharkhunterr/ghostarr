"""Integrations data API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.setting import Setting
from app.services.crypto_service import crypto_service
from app.integrations.ghost import GhostIntegration, GhostNewsletter
from app.integrations.tunarr import TunarrIntegration, TunarrChannel
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


async def _get_service_credentials(db: AsyncSession, service: str) -> tuple[str, str]:
    """Get decrypted service credentials."""
    setting = await db.get(Setting, f"services.{service}")
    if not setting:
        return "", ""

    config = setting.value
    url = config.get("url", "")
    api_key_encrypted = config.get("api_key_encrypted", "")
    api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else ""

    return url, api_key


@router.get("/ghost/newsletters", response_model=list[dict])
async def get_ghost_newsletters(db: AsyncSession = Depends(get_db)):
    """Get available newsletters from Ghost."""
    url, api_key = await _get_service_credentials(db, "ghost")

    if not url or not api_key:
        raise HTTPException(status_code=400, detail="Ghost not configured")

    try:
        integration = GhostIntegration(url=url, api_key=api_key)
        newsletters = await integration.get_newsletters()
        await integration.close()

        return [
            {
                "id": n.id,
                "name": n.name,
                "slug": n.slug,
                "description": n.description,
            }
            for n in newsletters
        ]

    except Exception as e:
        logger.error(f"Failed to fetch Ghost newsletters: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tunarr/channels", response_model=list[dict])
async def get_tunarr_channels(db: AsyncSession = Depends(get_db)):
    """Get available channels from Tunarr."""
    url, api_key = await _get_service_credentials(db, "tunarr")

    # Tunarr can work without API key, only URL is required
    if not url:
        raise HTTPException(status_code=400, detail="Tunarr not configured")

    try:
        integration = TunarrIntegration(url=url, api_key=api_key)
        channels = await integration.get_channels()
        await integration.close()

        return [
            {
                "id": c.id,
                "number": c.number,
                "name": c.name,
                "icon_url": c.icon_url,
                "group": c.group,
            }
            for c in channels
        ]

    except Exception as e:
        logger.error(f"Failed to fetch Tunarr channels: {e}")
        raise HTTPException(status_code=500, detail=str(e))
