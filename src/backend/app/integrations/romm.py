"""ROMM integration for video game library."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.integrations.base import BaseIntegration
from app.core.logging import get_logger

logger = get_logger(__name__)


class GameItem(BaseModel):
    """Game item from ROMM."""

    id: int
    name: str
    slug: str
    platform: str
    platform_slug: str
    file_name: str
    cover_url: str | None = None
    background_url: str | None = None
    summary: str | None = None
    igdb_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ROMMIntegration(BaseIntegration[GameItem]):
    """Integration with ROMM for video game library."""

    SERVICE_NAME = "ROMM"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to ROMM."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/api/platforms")
            elapsed_ms = int((time.time() - start) * 1000)

            if isinstance(response, list):
                platform_count = len(response)
                return True, f"Connected ({platform_count} platforms)", elapsed_ms

            return False, "Invalid response from ROMM", elapsed_ms

        except Exception as e:
            logger.error(f"ROMM connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(self, days: int = 7, max_items: int = -1, **kwargs: Any) -> list[GameItem]:
        """Fetch recently added games from ROMM."""
        if not self.is_configured:
            return []

        items: list[GameItem] = []
        since_date = datetime.now() - timedelta(days=days)

        try:
            # Get all platforms first
            platforms = await self._request("GET", "/api/platforms")

            for platform in platforms:
                platform_id = platform.get("id")
                platform_name = platform.get("name", "Unknown")
                platform_slug = platform.get("slug", "")

                # Get games for this platform
                games = await self._request("GET", f"/api/platforms/{platform_id}/roms")

                for game in games:
                    created_at_str = game.get("created_at")
                    if created_at_str:
                        try:
                            created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                            if created_at.replace(tzinfo=None) < since_date:
                                continue
                        except (ValueError, TypeError):
                            pass

                    game_item = GameItem(
                        id=game.get("id", 0),
                        name=game.get("name", game.get("file_name", "Unknown")),
                        slug=game.get("slug", ""),
                        platform=platform_name,
                        platform_slug=platform_slug,
                        file_name=game.get("file_name", ""),
                        cover_url=game.get("url_cover"),
                        background_url=game.get("url_screenshots", [None])[0] if game.get("url_screenshots") else None,
                        summary=game.get("summary"),
                        igdb_id=game.get("igdb_id"),
                    )
                    items.append(game_item)

                    if max_items != -1 and len(items) >= max_items:
                        return items

        except Exception as e:
            logger.error(f"Failed to fetch ROMM data: {e}")

        return items
