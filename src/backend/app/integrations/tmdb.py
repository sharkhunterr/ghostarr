"""TMDB integration for movie/TV metadata enrichment."""

import time
from typing import Any

from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

logger = get_logger(__name__)


class TMDBMetadata(BaseModel):
    """Metadata from TMDB."""

    tmdb_id: int
    title: str
    original_title: str | None = None
    overview: str | None = None
    poster_path: str | None = None
    backdrop_path: str | None = None
    release_date: str | None = None
    vote_average: float | None = None
    vote_count: int | None = None
    genres: list[str] = []
    runtime: int | None = None
    media_type: str = "movie"

    @property
    def poster_url(self) -> str | None:
        """Get full poster URL."""
        if self.poster_path:
            return f"https://image.tmdb.org/t/p/w500{self.poster_path}"
        return None

    @property
    def backdrop_url(self) -> str | None:
        """Get full backdrop URL."""
        if self.backdrop_path:
            return f"https://image.tmdb.org/t/p/original{self.backdrop_path}"
        return None


class TMDBIntegration(BaseIntegration[TMDBMetadata]):
    """Integration with The Movie Database (TMDB)."""

    SERVICE_NAME = "TMDB"
    BASE_URL = "https://api.themoviedb.org/3"

    def __init__(self, url: str = "", api_key: str = ""):
        """Initialize TMDB integration."""
        super().__init__(url=self.BASE_URL, api_key=api_key)

    @property
    def is_configured(self) -> bool:
        """Check if TMDB API key is configured."""
        return bool(self.api_key)

    @property
    def _is_bearer_token(self) -> bool:
        """Check if the API key is a Bearer token (Read Access Token) vs API Key v3."""
        # Bearer tokens are longer (200+ chars) and start with "ey"
        return len(self.api_key) > 100 and self.api_key.startswith("ey")

    def _get_default_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "Ghostarr/1.0",
        }
        # Use Bearer auth for Read Access Token, query param for API Key v3
        if self._is_bearer_token:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _add_api_key_param(self, params: dict[str, Any] | None) -> dict[str, Any]:
        """Add API key to params if using v3 API key (not Bearer token)."""
        params = params or {}
        if not self._is_bearer_token:
            params["api_key"] = self.api_key
        return params

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to TMDB."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request(
                "GET",
                "/configuration",
                params=self._add_api_key_param(None),
            )
            elapsed_ms = int((time.time() - start) * 1000)

            if "images" in response:
                return True, "Connected to TMDB", elapsed_ms

            return False, "Invalid response from TMDB", elapsed_ms

        except Exception as e:
            logger.error(f"TMDB connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(self, **kwargs: Any) -> list[TMDBMetadata]:
        """Not used directly - use enrich_media instead."""
        return []

    async def search_movie(self, title: str, year: int | None = None) -> TMDBMetadata | None:
        """Search for a movie by title."""
        if not self.is_configured:
            return None

        try:
            params: dict[str, Any] = {"query": title, "language": "fr-FR"}
            if year:
                params["year"] = year

            response = await self._request("GET", "/search/movie", params=self._add_api_key_param(params))
            results = response.get("results", [])

            if results:
                movie = results[0]
                return await self.get_movie_details(movie["id"])

        except Exception as e:
            logger.error(f"TMDB movie search failed: {e}")

        return None

    async def search_tv(self, title: str, year: int | None = None) -> TMDBMetadata | None:
        """Search for a TV show by title."""
        if not self.is_configured:
            return None

        try:
            params: dict[str, Any] = {"query": title, "language": "fr-FR"}
            if year:
                params["first_air_date_year"] = year

            response = await self._request("GET", "/search/tv", params=self._add_api_key_param(params))
            results = response.get("results", [])

            if results:
                show = results[0]
                return await self.get_tv_details(show["id"])

        except Exception as e:
            logger.error(f"TMDB TV search failed: {e}")

        return None

    async def get_movie_details(self, tmdb_id: int) -> TMDBMetadata | None:
        """Get detailed movie information."""
        if not self.is_configured:
            return None

        try:
            response = await self._request(
                "GET",
                f"/movie/{tmdb_id}",
                params=self._add_api_key_param({"language": "fr-FR"}),
            )

            genres = [g["name"] for g in response.get("genres", [])]

            return TMDBMetadata(
                tmdb_id=response["id"],
                title=response.get("title", ""),
                original_title=response.get("original_title"),
                overview=response.get("overview"),
                poster_path=response.get("poster_path"),
                backdrop_path=response.get("backdrop_path"),
                release_date=response.get("release_date"),
                vote_average=response.get("vote_average"),
                vote_count=response.get("vote_count"),
                genres=genres,
                runtime=response.get("runtime"),
                media_type="movie",
            )

        except Exception as e:
            logger.error(f"Failed to get TMDB movie details: {e}")

        return None

    async def get_tv_details(self, tmdb_id: int) -> TMDBMetadata | None:
        """Get detailed TV show information."""
        if not self.is_configured:
            return None

        try:
            response = await self._request(
                "GET",
                f"/tv/{tmdb_id}",
                params=self._add_api_key_param({"language": "fr-FR"}),
            )

            genres = [g["name"] for g in response.get("genres", [])]
            episode_runtime = response.get("episode_run_time", [])

            return TMDBMetadata(
                tmdb_id=response["id"],
                title=response.get("name", ""),
                original_title=response.get("original_name"),
                overview=response.get("overview"),
                poster_path=response.get("poster_path"),
                backdrop_path=response.get("backdrop_path"),
                release_date=response.get("first_air_date"),
                vote_average=response.get("vote_average"),
                vote_count=response.get("vote_count"),
                genres=genres,
                runtime=episode_runtime[0] if episode_runtime else None,
                media_type="tv",
            )

        except Exception as e:
            logger.error(f"Failed to get TMDB TV details: {e}")

        return None

    async def enrich_media(
        self,
        title: str,
        media_type: str,
        year: int | None = None,
        tmdb_id: int | None = None,
    ) -> TMDBMetadata | None:
        """Enrich media item with TMDB metadata."""
        if not self.is_configured:
            return None

        # If we have TMDB ID, fetch directly
        if tmdb_id:
            if media_type == "movie":
                return await self.get_movie_details(tmdb_id)
            else:
                return await self.get_tv_details(tmdb_id)

        # Otherwise search by title
        if media_type == "movie":
            return await self.search_movie(title, year)
        else:
            return await self.search_tv(title, year)
