"""Radarr integration for upcoming movies."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

logger = get_logger(__name__)


class RadarrMovie(BaseModel):
    """A movie from Radarr."""

    id: int
    title: str
    original_title: str | None = None
    year: int | None = None
    overview: str | None = None
    poster_url: str | None = None
    fanart_url: str | None = None
    imdb_id: str | None = None
    tmdb_id: int | None = None
    runtime: int | None = None  # minutes
    genres: list[str] = []
    rating: float | None = None
    studio: str | None = None
    status: str | None = None  # announced, inCinemas, released, deleted
    digital_release: str | None = None
    physical_release: str | None = None
    in_cinemas: str | None = None
    has_file: bool = False
    monitored: bool = True


class RadarrIntegration(BaseIntegration[RadarrMovie]):
    """Integration with Radarr for upcoming movies."""

    SERVICE_NAME = "Radarr"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "X-Api-Key": self.api_key,
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Radarr."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/api/v3/system/status")
            elapsed_ms = int((time.time() - start) * 1000)

            version = response.get("version", "unknown")
            return True, f"Radarr v{version}", elapsed_ms

        except Exception as e:
            logger.error(f"Radarr connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(
        self,
        days: int = 30,
        max_items: int = -1,
        **kwargs: Any,
    ) -> list[RadarrMovie]:
        """Fetch upcoming movies with digital/physical releases in the period.

        Only returns movies that are available for download (have digital or
        physical release dates), not cinema-only releases.
        """
        if not self.is_configured:
            return []

        try:
            # Fetch all movies from Radarr
            movies_data = await self._request("GET", "/api/v3/movie")

            now = datetime.utcnow()
            cutoff = now + timedelta(days=days)

            results: list[RadarrMovie] = []

            for movie in movies_data:
                if not movie.get("monitored", True):
                    continue

                # Skip movies already downloaded
                if movie.get("hasFile", False):
                    continue

                # Check for digital or physical release within period
                digital = movie.get("digitalRelease")
                physical = movie.get("physicalRelease")

                release_date = None
                if digital:
                    try:
                        release_date = datetime.fromisoformat(digital.replace("Z", "+00:00")).replace(tzinfo=None)
                    except (ValueError, TypeError):
                        pass

                if not release_date and physical:
                    try:
                        release_date = datetime.fromisoformat(physical.replace("Z", "+00:00")).replace(tzinfo=None)
                    except (ValueError, TypeError):
                        pass

                if not release_date:
                    continue

                # Only future releases (from today onwards, within the window)
                if release_date < now or release_date > cutoff:
                    continue

                # Build poster/fanart URLs
                poster_url = None
                fanart_url = None
                for image in movie.get("images", []):
                    if image.get("coverType") == "poster" and image.get("remoteUrl"):
                        poster_url = image["remoteUrl"]
                    elif image.get("coverType") == "fanart" and image.get("remoteUrl"):
                        fanart_url = image["remoteUrl"]

                radarr_movie = RadarrMovie(
                    id=movie["id"],
                    title=movie.get("title", ""),
                    original_title=movie.get("originalTitle"),
                    year=movie.get("year"),
                    overview=movie.get("overview"),
                    poster_url=poster_url,
                    fanart_url=fanart_url,
                    imdb_id=movie.get("imdbId"),
                    tmdb_id=movie.get("tmdbId"),
                    runtime=movie.get("runtime"),
                    genres=[g.lower() for g in movie.get("genres", [])],
                    rating=movie.get("ratings", {}).get("tmdb", {}).get("value"),
                    studio=movie.get("studio"),
                    status=movie.get("status"),
                    digital_release=digital,
                    physical_release=physical,
                    in_cinemas=movie.get("inCinemas"),
                    has_file=movie.get("hasFile", False),
                    monitored=movie.get("monitored", True),
                )
                results.append(radarr_movie)

            # Sort by release date (most recent first)
            results.sort(
                key=lambda m: m.digital_release or m.physical_release or "",
                reverse=True,
            )

            if max_items > 0:
                results = results[:max_items]

            logger.info(f"Found {len(results)} upcoming movies from Radarr")
            return results

        except Exception as e:
            logger.error(f"Radarr fetch failed: {e}")
            raise
