"""ROMM integration for video game library."""

import base64
import time
from datetime import datetime, timedelta
from typing import Any

import httpx
from pydantic import BaseModel

from app.integrations.base import BaseIntegration
from app.core.logging import get_logger

logger = get_logger(__name__)


class GameItem(BaseModel):
    """Game item from ROMM."""

    id: int
    name: str
    slug: str | None = None
    platform: str = "Unknown"
    platform_slug: str = ""
    file_name: str = ""
    cover_url: str | None = None
    background_url: str | None = None
    summary: str | None = None
    igdb_id: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ROMMIntegration(BaseIntegration[GameItem]):
    """Integration with ROMM for video game library."""

    SERVICE_NAME = "ROMM"

    def __init__(self, url: str, api_key: str = "", username: str = "", password: str = ""):
        """Initialize ROMM integration with URL and credentials."""
        super().__init__(url, api_key)
        self.username = username or ""
        self.password = password or ""

    @property
    def is_configured(self) -> bool:
        """Check if integration has required configuration."""
        # ROMM can be configured with either username/password or api_key
        has_basic_auth = bool(self.username and self.password)
        has_api_key = bool(self.api_key)
        return bool(self.url) and (has_basic_auth or has_api_key)

    def _get_default_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "Ghostarr/1.0",
        }
        # Prefer basic auth if username/password are provided
        if self.username and self.password:
            credentials = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
            headers["Authorization"] = f"Basic {credentials}"
        elif self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with appropriate auth."""
        if self._client is None or self._client.is_closed:
            auth = None
            # Use httpx's built-in basic auth if credentials are provided
            if self.username and self.password:
                auth = httpx.BasicAuth(self.username, self.password)

            self._client = httpx.AsyncClient(
                base_url=self.url,
                timeout=httpx.Timeout(self.DEFAULT_TIMEOUT),
                headers=self._get_default_headers(),
                auth=auth,
            )
        return self._client

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
            # Get all platforms first to build a mapping
            platforms = await self._request("GET", "/api/platforms")
            logger.info(f"ROMM: Found {len(platforms)} platforms")

            platform_map = {p.get("id"): p for p in platforms}

            # Fetch all ROMs using the /api/roms endpoint with sorting
            # ROMM API uses /api/roms with optional platform_id filter
            params: dict[str, Any] = {
                "order_by": "created_at",
                "order_dir": "desc",
            }
            if max_items != -1:
                params["limit"] = max_items

            roms_response = await self._request("GET", "/api/roms", params=params)

            # Handle both list response and paginated response
            if isinstance(roms_response, dict):
                games = roms_response.get("items", roms_response.get("roms", []))
            else:
                games = roms_response

            logger.info(f"ROMM: Fetched {len(games)} ROMs")

            for game in games:
                # Get platform info
                platform_id = game.get("platform_id")
                platform_info = platform_map.get(platform_id, {})
                platform_name = platform_info.get("name", "Unknown")
                platform_slug = platform_info.get("slug", "")

                # Parse date - try multiple fields
                date_str = game.get("created_at") or game.get("updated_at")
                game_date = None

                if date_str:
                    try:
                        # Handle various ISO formats
                        if isinstance(date_str, str) and "T" in date_str:
                            game_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                        elif isinstance(date_str, (int, float)):
                            game_date = datetime.fromtimestamp(date_str)
                    except (ValueError, TypeError) as e:
                        logger.debug(f"ROMM: Could not parse date '{date_str}' for game {game.get('name')}: {e}")

                # If we have a date and it's too old, skip
                if game_date:
                    game_date_naive = game_date.replace(tzinfo=None) if game_date.tzinfo else game_date
                    if game_date_naive < since_date:
                        continue

                # Build cover URL - ROMM API uses path_cover_s/m/l or url_cover
                cover_path = game.get("path_cover_l") or game.get("path_cover_m") or game.get("path_cover_s") or game.get("url_cover")
                cover_url = None
                if cover_path:
                    if cover_path.startswith("http"):
                        cover_url = cover_path
                    else:
                        # Build full URL for cover
                        cover_url = f"{self.url}/api/roms/{game.get('id')}/cover"

                # Build screenshot URL
                screenshots = game.get("url_screenshots") or game.get("path_screenshots") or []
                background_url = None
                if screenshots and len(screenshots) > 0:
                    bg = screenshots[0]
                    if bg and bg.startswith("http"):
                        background_url = bg
                    elif bg:
                        background_url = f"{self.url}{bg}"

                game_item = GameItem(
                    id=game.get("id", 0),
                    name=game.get("name") or game.get("file_name") or "Unknown",
                    slug=game.get("slug", ""),
                    platform=platform_name,
                    platform_slug=platform_slug,
                    file_name=game.get("file_name", ""),
                    cover_url=cover_url,
                    background_url=background_url,
                    summary=game.get("summary"),
                    igdb_id=game.get("igdb_id"),
                    created_at=game_date,
                )
                items.append(game_item)
                logger.debug(f"ROMM: Added game {game_item.name} (platform: {platform_name}, date: {game_date})")

                if max_items != -1 and len(items) >= max_items:
                    logger.info(f"ROMM: Reached max_items limit ({max_items})")
                    return items

        except Exception as e:
            logger.error(f"Failed to fetch ROMM data: {e}", exc_info=True)

        logger.info(f"ROMM: Total games found: {len(items)}")
        return items
