"""Overseerr integration for media requests."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

logger = get_logger(__name__)


class OverseerrRequest(BaseModel):
    """A media request from Overseerr."""

    id: int
    media_type: str  # "movie" or "tv"
    title: str
    original_title: str | None = None
    year: int | None = None
    overview: str | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    tmdb_id: int | None = None
    imdb_id: str | None = None
    status: int  # 1=pending, 2=approved, 3=declined, 4=available
    status_label: str = ""
    requested_by: str | None = None
    requested_at: str | None = None
    genres: list[str] = []
    rating: float | None = None
    runtime: int | None = None  # minutes


class OverseerrIntegration(BaseIntegration[OverseerrRequest]):
    """Integration with Overseerr for media requests."""

    SERVICE_NAME = "Overseerr"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "X-Api-Key": self.api_key,
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Overseerr."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/api/v1/status")
            elapsed_ms = int((time.time() - start) * 1000)

            version = response.get("version", "unknown")
            return True, f"Overseerr v{version}", elapsed_ms

        except Exception as e:
            logger.error(f"Overseerr connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(
        self,
        days: int = 30,
        max_items: int = -1,
        **kwargs: Any,
    ) -> list[OverseerrRequest]:
        """Fetch media requests from the defined period."""
        if not self.is_configured:
            return []

        try:
            cutoff = datetime.utcnow() - timedelta(days=days)
            results: list[OverseerrRequest] = []
            page = 1
            page_size = 20

            status_labels = {
                1: "En attente",
                2: "Approuvée",
                3: "Refusée",
                4: "Disponible",
            }

            while True:
                response = await self._request(
                    "GET",
                    "/api/v1/request",
                    params={
                        "take": page_size,
                        "skip": (page - 1) * page_size,
                        "sort": "added",
                        "filter": "all",
                    },
                )

                requests_data = response.get("results", [])
                if not requests_data:
                    break

                stop = False
                for req in requests_data:
                    # Check date
                    created_at = req.get("createdAt", "")
                    if created_at:
                        try:
                            req_date = datetime.fromisoformat(created_at.replace("Z", "+00:00")).replace(tzinfo=None)
                            if req_date < cutoff:
                                stop = True
                                break
                        except (ValueError, TypeError):
                            pass

                    media = req.get("media", {})
                    media_type = req.get("type", media.get("mediaType", "movie"))
                    status = req.get("status", 1)  # Request status: 1=pending, 2=approved, 3=declined
                    media_status = media.get("status")  # Media availability: 3=partial, 4=processed, 5=available

                    # Skip if media is already available on Plex
                    if media_status in (4, 5):
                        continue
                    # Also skip declined requests
                    if status == 3:
                        continue

                    # Get media info from embedded data
                    media_info = media.get("mediaInfo", {})
                    tmdb_id = media.get("tmdbId")

                    # Fetch detailed media info from Overseerr
                    title = ""
                    overview = ""
                    poster_url = None
                    backdrop_url = None
                    year = None
                    genres = []
                    rating = None
                    runtime = None

                    if tmdb_id:
                        try:
                            detail = await self._request(
                                "GET",
                                f"/api/v1/{media_type}/{tmdb_id}",
                            )
                            title = detail.get("title") or detail.get("name", "")
                            overview = detail.get("overview", "")
                            year = None
                            release = detail.get("releaseDate") or detail.get("firstAirDate", "")
                            if release and len(release) >= 4:
                                try:
                                    year = int(release[:4])
                                except ValueError:
                                    pass

                            if detail.get("posterPath"):
                                poster_url = f"https://image.tmdb.org/t/p/w500{detail['posterPath']}"
                            if detail.get("backdropPath"):
                                backdrop_url = f"https://image.tmdb.org/t/p/original{detail['backdropPath']}"

                            genres = [g.get("name", "") for g in detail.get("genres", [])]
                            rating = detail.get("voteAverage")
                            runtime = detail.get("runtime")
                        except Exception as e:
                            logger.debug(f"Failed to fetch Overseerr media detail: {e}")
                            title = f"TMDB #{tmdb_id}"

                    # Get requester info
                    requested_by = None
                    requester = req.get("requestedBy", {})
                    if requester:
                        requested_by = requester.get("displayName") or requester.get("username") or requester.get("email")

                    overseerr_req = OverseerrRequest(
                        id=req.get("id", 0),
                        media_type=media_type,
                        title=title,
                        year=year,
                        overview=overview,
                        poster_url=poster_url,
                        backdrop_url=backdrop_url,
                        tmdb_id=tmdb_id,
                        status=status,
                        status_label=status_labels.get(status, "Inconnu"),
                        requested_by=requested_by,
                        requested_at=created_at,
                        genres=genres,
                        rating=rating,
                        runtime=runtime,
                    )
                    results.append(overseerr_req)

                if stop:
                    break

                # Check if there are more pages
                total = response.get("pageInfo", {}).get("results", 0)
                if page * page_size >= total:
                    break
                page += 1

            if max_items > 0:
                results = results[:max_items]

            logger.info(f"Found {len(results)} requests from Overseerr")
            return results

        except Exception as e:
            logger.error(f"Overseerr fetch failed: {e}")
            raise
