"""Sonarr integration for upcoming series."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

logger = get_logger(__name__)


class SonarrEpisode(BaseModel):
    """An upcoming episode from Sonarr."""

    id: int
    series_id: int
    series_title: str
    season_number: int
    episode_number: int
    title: str | None = None
    overview: str | None = None
    air_date: str | None = None
    has_file: bool = False


class SonarrSeries(BaseModel):
    """A series with upcoming episodes from Sonarr."""

    id: int
    title: str
    original_title: str | None = None
    year: int | None = None
    overview: str | None = None
    poster_url: str | None = None
    fanart_url: str | None = None
    imdb_id: str | None = None
    tvdb_id: int | None = None
    genres: list[str] = []
    rating: float | None = None
    network: str | None = None
    status: str | None = None  # continuing, ended, upcoming, deleted
    runtime: int | None = None  # episode runtime in minutes
    upcoming_episodes: list[SonarrEpisode] = []
    next_air_date: str | None = None
    episode_count: int = 0


class SonarrIntegration(BaseIntegration[SonarrSeries]):
    """Integration with Sonarr for upcoming series episodes."""

    SERVICE_NAME = "Sonarr"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "X-Api-Key": self.api_key,
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Sonarr."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/api/v3/system/status")
            elapsed_ms = int((time.time() - start) * 1000)

            version = response.get("version", "unknown")
            return True, f"Sonarr v{version}", elapsed_ms

        except Exception as e:
            logger.error(f"Sonarr connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(
        self,
        days: int = 30,
        max_items: int = -1,
        **kwargs: Any,
    ) -> list[SonarrSeries]:
        """Fetch series with upcoming episodes in the defined period.

        Uses the Sonarr calendar endpoint to get episodes airing within
        the specified number of days, then groups by series.
        """
        if not self.is_configured:
            return []

        try:
            now = datetime.utcnow()
            end_date = now + timedelta(days=days)

            # Fetch calendar entries — only future episodes (from today)
            calendar = await self._request(
                "GET",
                "/api/v3/calendar",
                params={
                    "start": now.strftime("%Y-%m-%d"),
                    "end": end_date.strftime("%Y-%m-%d"),
                    "includeSeries": "true",
                    "includeEpisodeFile": "false",
                },
            )

            # Group episodes by series
            series_map: dict[int, dict] = {}
            episodes_by_series: dict[int, list[SonarrEpisode]] = {}

            for entry in calendar:
                # Skip already downloaded episodes
                if entry.get("hasFile", False):
                    continue

                series_data = entry.get("series", {})
                series_id = series_data.get("id") or entry.get("seriesId")
                if not series_id:
                    continue

                # Store series data
                if series_id not in series_map:
                    series_map[series_id] = series_data
                    episodes_by_series[series_id] = []

                episode = SonarrEpisode(
                    id=entry.get("id", 0),
                    series_id=series_id,
                    series_title=series_data.get("title", ""),
                    season_number=entry.get("seasonNumber", 0),
                    episode_number=entry.get("episodeNumber", 0),
                    title=entry.get("title"),
                    overview=entry.get("overview"),
                    air_date=entry.get("airDateUtc") or entry.get("airDate"),
                    has_file=entry.get("hasFile", False),
                )
                episodes_by_series[series_id].append(episode)

            # Build series list
            results: list[SonarrSeries] = []
            for series_id, series_data in series_map.items():
                episodes = episodes_by_series.get(series_id, [])

                # Build poster/fanart URLs
                poster_url = None
                fanart_url = None
                for image in series_data.get("images", []):
                    if image.get("coverType") == "poster" and image.get("remoteUrl"):
                        poster_url = image["remoteUrl"]
                    elif image.get("coverType") == "fanart" and image.get("remoteUrl"):
                        fanart_url = image["remoteUrl"]

                # Find next air date
                air_dates = [e.air_date for e in episodes if e.air_date]
                next_air = min(air_dates) if air_dates else None

                series = SonarrSeries(
                    id=series_id,
                    title=series_data.get("title", ""),
                    original_title=series_data.get("originalTitle"),
                    year=series_data.get("year"),
                    overview=series_data.get("overview"),
                    poster_url=poster_url,
                    fanart_url=fanart_url,
                    imdb_id=series_data.get("imdbId"),
                    tvdb_id=series_data.get("tvdbId"),
                    genres=[g.lower() for g in series_data.get("genres", [])],
                    rating=series_data.get("ratings", {}).get("value"),
                    network=series_data.get("network"),
                    status=series_data.get("status"),
                    runtime=series_data.get("runtime"),
                    upcoming_episodes=episodes,
                    next_air_date=next_air,
                    episode_count=len(episodes),
                )
                results.append(series)

            # Sort by next air date
            results.sort(
                key=lambda s: s.next_air_date or "",
                reverse=True,
            )

            if max_items > 0:
                results = results[:max_items]

            logger.info(f"Found {len(results)} series with upcoming episodes from Sonarr")
            return results

        except Exception as e:
            logger.error(f"Sonarr fetch failed: {e}")
            raise
