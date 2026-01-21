"""Newsletter generator service - orchestrates the generation pipeline."""

import asyncio
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import GenerationError, IntegrationError, GenerationCancelledException
from app.core.logging import get_logger
from app.models.history import History, GenerationType, GenerationStatus
from app.models.setting import Setting
from app.models.template import Template
from app.schemas.generation import GenerationConfig, PublicationMode
from app.services.crypto_service import crypto_service
from app.services.progress_tracker import ProgressTracker
from app.services.template_service import template_service
from app.integrations.tautulli import TautulliIntegration, MediaItem
from app.integrations.tmdb import TMDBIntegration
from app.integrations.ghost import GhostIntegration
from app.integrations.romm import ROMMIntegration
from app.integrations.komga import KomgaIntegration
from app.integrations.audiobookshelf import AudiobookshelfIntegration
from app.integrations.tunarr import TunarrIntegration

logger = get_logger(__name__)

# Active generations for cancellation
_active_generations: dict[str, ProgressTracker] = {}


async def get_service_credentials(db: AsyncSession, service: str) -> tuple[str, str]:
    """Get decrypted service credentials."""
    setting = await db.get(Setting, f"services.{service}")
    if not setting:
        return "", ""

    config = setting.value
    url = config.get("url", "")
    api_key_encrypted = config.get("api_key_encrypted", "")
    api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else ""

    return url, api_key


async def get_service_credentials_full(db: AsyncSession, service: str) -> dict[str, str]:
    """Get all decrypted service credentials including username/password."""
    setting = await db.get(Setting, f"services.{service}")
    if not setting:
        return {"url": "", "api_key": "", "username": "", "password": ""}

    config = setting.value
    url = config.get("url", "")
    api_key_encrypted = config.get("api_key_encrypted", "")
    api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else ""
    username = config.get("username", "")
    password_encrypted = config.get("password_encrypted", "")
    password = crypto_service.decrypt(password_encrypted) if password_encrypted else ""

    return {"url": url, "api_key": api_key, "username": username, "password": password}


class NewsletterGenerator:
    """Orchestrates newsletter generation pipeline."""

    def __init__(self, db: AsyncSession, config: GenerationConfig):
        self.db = db
        self.config = config
        self.generation_id = str(uuid4())
        self.tracker: ProgressTracker | None = None
        self.history: History | None = None

        # Collected data
        self.movies: list[dict[str, Any]] = []
        self.series: list[dict[str, Any]] = []
        self.games: list[dict[str, Any]] = []
        self.books: list[dict[str, Any]] = []
        self.audiobooks: list[dict[str, Any]] = []
        self.tv_programs: list[dict[str, Any]] = []
        self.statistics: dict[str, Any] = {}

        # Service URLs (populated during fetch)
        self._tautulli_url: str = ""

    async def create_history_entry(
        self,
        generation_type: GenerationType = GenerationType.MANUAL,
        schedule_id: str | None = None,
    ) -> History:
        """Create the history entry and initialize tracker. Returns immediately."""
        # Determine enabled steps based on config
        enabled_steps = self._get_enabled_steps()

        # Create progress tracker
        self.tracker = ProgressTracker(self.generation_id, enabled_steps)
        _active_generations[self.generation_id] = self.tracker

        # Store for later use
        self._generation_type = generation_type
        self._schedule_id = schedule_id

        # Create history entry
        self.history = History(
            id=self.generation_id,
            type=generation_type,
            schedule_id=schedule_id,
            template_id=self.config.template_id,
            status=GenerationStatus.RUNNING,
            generation_config=self.config.model_dump(),
            started_at=datetime.utcnow(),
        )
        self.db.add(self.history)
        await self.db.commit()

        return self.history

    async def run_pipeline(self) -> History:
        """Execute the pipeline steps. Call after create_history_entry."""
        try:
            return await self._execute_pipeline()
        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}")
            if self.history:
                self.history.status = GenerationStatus.FAILED
                self.history.error_message = str(e)
                await self.db.commit()
            raise

    async def generate(
        self,
        generation_type: GenerationType = GenerationType.MANUAL,
        schedule_id: str | None = None,
    ) -> History:
        """Execute the full generation pipeline (legacy method)."""
        await self.create_history_entry(generation_type, schedule_id)
        return await self.run_pipeline()

    async def _execute_pipeline(self) -> History:
        """Internal method to execute all pipeline steps."""
        try:
            # Broadcast generation started with enabled steps
            await self.tracker.broadcast_started()

            # Execute pipeline steps with cancellation checks
            await self._fetch_tautulli()
            if self._is_cancelled():
                return await self._handle_cancellation()

            await self._enrich_tmdb()
            if self._is_cancelled():
                return await self._handle_cancellation()

            await self._fetch_romm()
            if self._is_cancelled():
                return await self._handle_cancellation()

            await self._fetch_komga()
            if self._is_cancelled():
                return await self._handle_cancellation()

            await self._fetch_audiobookshelf()
            if self._is_cancelled():
                return await self._handle_cancellation()

            await self._fetch_tunarr()
            if self._is_cancelled():
                return await self._handle_cancellation()

            await self._fetch_statistics()
            if self._is_cancelled():
                return await self._handle_cancellation()

            # Check if we should skip due to no content
            total_items = self._get_total_items()
            if self.config.skip_if_empty and total_items == 0:
                self.history.status = GenerationStatus.SUCCESS
                self.history.error_message = "Skipped: no new content"
                self.history.items_count = 0
                await self.tracker.complete_generation("Skipped: no new content")
                return await self._finalize()

            # Render template
            html = await self._render_template()
            if self._is_cancelled():
                return await self._handle_cancellation()

            # Publish to Ghost
            ghost_url = await self._publish_ghost(html)

            # Mark as complete
            self.history.status = GenerationStatus.SUCCESS
            self.history.ghost_post_url = ghost_url
            self.history.items_count = total_items

            await self.tracker.complete_generation(
                message="Newsletter generated successfully",
                ghost_post_url=ghost_url,
            )

        except GenerationCancelledException:
            return await self._handle_cancellation()

        except Exception as e:
            logger.exception(f"Generation failed: {e}")
            self.history.status = GenerationStatus.FAILED
            self.history.error_message = str(e)

            if self.tracker.current_step:
                await self.tracker.fail_step(self.tracker.current_step, str(e))

        finally:
            _active_generations.pop(self.generation_id, None)

        return await self._finalize()

    def _get_enabled_steps(self) -> list[str]:
        """Determine which steps are enabled based on config."""
        steps = []

        if self.config.tautulli.enabled:
            steps.append("fetch_tautulli")
            steps.append("enrich_tmdb")  # Only if tautulli enabled

        if self.config.romm.enabled:
            steps.append("fetch_romm")

        if self.config.komga.enabled:
            steps.append("fetch_komga")

        if self.config.audiobookshelf.enabled:
            steps.append("fetch_audiobookshelf")

        if self.config.tunarr.enabled:
            steps.append("fetch_tunarr")

        if self.config.statistics.enabled:
            steps.append("fetch_statistics")

        steps.append("render_template")
        steps.append("publish_ghost")

        return steps

    def _get_total_items(self) -> int:
        """Get total collected items."""
        return (
            len(self.movies)
            + len(self.series)
            + len(self.games)
            + len(self.books)
            + len(self.audiobooks)
            + len(self.tv_programs)
        )

    def _is_cancelled(self) -> bool:
        """Check if this generation has been cancelled."""
        return self.tracker is not None and self.tracker.is_cancelled

    async def _handle_cancellation(self) -> History:
        """Handle generation cancellation with cleanup."""
        logger.info(f"Generation {self.generation_id} cancelled, cleaning up...")

        self.history.status = GenerationStatus.CANCELLED
        self.history.error_message = "Cancelled by user"

        await self.tracker.cancel_generation("Generation cancelled by user")

        return await self._finalize()

    async def _fetch_tautulli(self) -> None:
        """Fetch media from Tautulli."""
        if not self.config.tautulli.enabled:
            await self.tracker.skip_step("fetch_tautulli", "Disabled")
            return

        await self.tracker.start_step("fetch_tautulli", "Fetching media from Tautulli...")

        try:
            url, api_key = await get_service_credentials(self.db, "tautulli")
            if not url or not api_key:
                await self.tracker.skip_step("fetch_tautulli", "Not configured")
                return

            # Store URL for image proxy
            self._tautulli_url = url.rstrip("/")

            integration = TautulliIntegration(url=url, api_key=api_key)
            items = await integration.fetch_data(
                days=self.config.tautulli.days,
                max_items=self.config.tautulli.max_items,
            )
            await integration.close()

            # Separate movies and series
            for item in items:
                if item.media_type == "movie":
                    self.movies.append(item.model_dump())
                else:
                    self.series.append(item.model_dump())

            await self.tracker.complete_step(
                "fetch_tautulli",
                f"Found {len(self.movies)} movies, {len(self.series)} episodes",
                len(items),
            )

        except Exception as e:
            logger.error(f"Tautulli fetch failed: {e}")
            await self.tracker.fail_step("fetch_tautulli", str(e))
            raise GenerationError("fetch_tautulli", str(e))

    async def _enrich_tmdb(self) -> None:
        """Enrich media with TMDB metadata."""
        if not self.config.tautulli.enabled or (not self.movies and not self.series):
            await self.tracker.skip_step("enrich_tmdb", "No media to enrich")
            return

        await self.tracker.start_step("enrich_tmdb", "Enriching with TMDB metadata...")

        try:
            url, api_key = await get_service_credentials(self.db, "tmdb")
            if not api_key:
                await self.tracker.skip_step("enrich_tmdb", "TMDB not configured")
                return

            integration = TMDBIntegration(api_key=api_key)
            enriched_count = 0

            # Enrich movies
            for movie in self.movies:
                metadata = await integration.enrich_media(
                    title=movie["title"],
                    media_type="movie",
                    year=movie.get("year"),
                )
                if metadata:
                    movie.update({
                        "tmdb_id": metadata.tmdb_id,
                        "overview": metadata.overview,
                        "poster_url": metadata.poster_url,
                        "backdrop_url": metadata.backdrop_url,
                        "vote_average": metadata.vote_average,
                        "genres": metadata.genres,
                        "runtime": metadata.runtime,
                    })
                    enriched_count += 1

            # Enrich series (by show name)
            seen_shows = set()
            for episode in self.series:
                show_name = episode.get("grandparent_title", episode["title"])
                if show_name in seen_shows:
                    continue
                seen_shows.add(show_name)

                metadata = await integration.enrich_media(
                    title=show_name,
                    media_type="tv",
                )
                if metadata:
                    episode.update({
                        "show_overview": metadata.overview,
                        "show_poster_url": metadata.poster_url,
                        "show_backdrop_url": metadata.backdrop_url,
                        "show_vote_average": metadata.vote_average,
                        "show_genres": metadata.genres,
                    })
                    enriched_count += 1

            await integration.close()

            await self.tracker.complete_step(
                "enrich_tmdb",
                f"Enriched {enriched_count} items",
                enriched_count,
            )

        except Exception as e:
            logger.error(f"TMDB enrichment failed: {e}")
            # Non-fatal, continue without enrichment
            await self.tracker.complete_step("enrich_tmdb", "Enrichment failed, continuing", 0)

    async def _fetch_romm(self) -> None:
        """Fetch games from ROMM."""
        if not self.config.romm.enabled:
            await self.tracker.skip_step("fetch_romm", "Disabled")
            return

        await self.tracker.start_step("fetch_romm", "Fetching games from ROMM...")

        try:
            creds = await get_service_credentials_full(self.db, "romm")
            url = creds["url"]
            api_key = creds["api_key"]
            username = creds["username"]
            password = creds["password"]

            # ROMM can use either username/password or api_key
            has_auth = bool(username and password) or bool(api_key)
            if not url or not has_auth:
                await self.tracker.skip_step("fetch_romm", "Not configured")
                return

            integration = ROMMIntegration(url=url, api_key=api_key, username=username, password=password)
            items = await integration.fetch_data(
                days=self.config.romm.days,
                max_items=self.config.romm.max_items,
            )
            await integration.close()

            self.games = [item.model_dump() for item in items]

            await self.tracker.complete_step(
                "fetch_romm",
                f"Found {len(self.games)} games",
                len(self.games),
            )

        except Exception as e:
            logger.error(f"ROMM fetch failed: {e}")
            await self.tracker.complete_step("fetch_romm", "Fetch failed, continuing", 0)

    async def _fetch_komga(self) -> None:
        """Fetch books from Komga."""
        if not self.config.komga.enabled:
            await self.tracker.skip_step("fetch_komga", "Disabled")
            return

        await self.tracker.start_step("fetch_komga", "Fetching books from Komga...")

        try:
            url, api_key = await get_service_credentials(self.db, "komga")
            if not url or not api_key:
                await self.tracker.skip_step("fetch_komga", "Not configured")
                return

            integration = KomgaIntegration(url=url, api_key=api_key)
            items = await integration.fetch_data(
                days=self.config.komga.days,
                max_items=self.config.komga.max_items,
            )

            # Convert items and fetch images as base64 for external accessibility
            self.books = []
            for item in items:
                book_dict = item.model_dump()
                # Convert thumbnail URL to base64
                if book_dict.get("thumbnail_url"):
                    base64_image = await integration.fetch_image_as_base64(book_dict["thumbnail_url"])
                    if base64_image:
                        book_dict["thumbnail_url"] = base64_image
                self.books.append(book_dict)

            await integration.close()

            await self.tracker.complete_step(
                "fetch_komga",
                f"Found {len(self.books)} books",
                len(self.books),
            )

        except Exception as e:
            logger.error(f"Komga fetch failed: {e}")
            await self.tracker.complete_step("fetch_komga", "Fetch failed, continuing", 0)

    async def _fetch_audiobookshelf(self) -> None:
        """Fetch audiobooks from Audiobookshelf."""
        if not self.config.audiobookshelf.enabled:
            await self.tracker.skip_step("fetch_audiobookshelf", "Disabled")
            return

        await self.tracker.start_step("fetch_audiobookshelf", "Fetching audiobooks...")

        try:
            url, api_key = await get_service_credentials(self.db, "audiobookshelf")
            if not url or not api_key:
                await self.tracker.skip_step("fetch_audiobookshelf", "Not configured")
                return

            integration = AudiobookshelfIntegration(url=url, api_key=api_key)
            items = await integration.fetch_data(
                days=self.config.audiobookshelf.days,
                max_items=self.config.audiobookshelf.max_items,
            )

            # Convert items and fetch images as base64 for external accessibility
            self.audiobooks = []
            for item in items:
                audiobook_dict = item.model_dump()
                # Convert cover URL to base64
                if audiobook_dict.get("cover_url"):
                    base64_image = await integration.fetch_image_as_base64(audiobook_dict["cover_url"])
                    if base64_image:
                        audiobook_dict["cover_url"] = base64_image
                self.audiobooks.append(audiobook_dict)

            await integration.close()

            await self.tracker.complete_step(
                "fetch_audiobookshelf",
                f"Found {len(self.audiobooks)} audiobooks",
                len(self.audiobooks),
            )

        except Exception as e:
            logger.error(f"Audiobookshelf fetch failed: {e}")
            await self.tracker.complete_step("fetch_audiobookshelf", "Fetch failed, continuing", 0)

    async def _fetch_tunarr(self) -> None:
        """Fetch TV programming from Tunarr."""
        if not self.config.tunarr.enabled:
            await self.tracker.skip_step("fetch_tunarr", "Disabled")
            return

        await self.tracker.start_step("fetch_tunarr", "Fetching TV programming...")

        try:
            url, api_key = await get_service_credentials(self.db, "tunarr")
            if not url or not api_key:
                await self.tracker.skip_step("fetch_tunarr", "Not configured")
                return

            integration = TunarrIntegration(url=url, api_key=api_key)
            items = await integration.fetch_data(
                days=self.config.tunarr.days,
                channels=self.config.tunarr.channels or None,
                max_items=self.config.tunarr.max_items,
            )
            await integration.close()

            self.tv_programs = [item.model_dump() for item in items]

            await self.tracker.complete_step(
                "fetch_tunarr",
                f"Found {len(self.tv_programs)} programs",
                len(self.tv_programs),
            )

        except Exception as e:
            logger.error(f"Tunarr fetch failed: {e}")
            await self.tracker.complete_step("fetch_tunarr", "Fetch failed, continuing", 0)

    async def _fetch_statistics(self) -> None:
        """Fetch statistics from Tautulli."""
        if not self.config.statistics.enabled:
            await self.tracker.skip_step("fetch_statistics", "Disabled")
            return

        await self.tracker.start_step("fetch_statistics", "Fetching statistics...")

        try:
            url, api_key = await get_service_credentials(self.db, "tautulli")
            if not url or not api_key:
                await self.tracker.skip_step("fetch_statistics", "Tautulli not configured")
                return

            integration = TautulliIntegration(url=url, api_key=api_key)
            stats = await integration.fetch_statistics(
                days=self.config.statistics.days,
                include_comparison=self.config.statistics.include_comparison,
            )
            await integration.close()

            self.statistics = stats.model_dump()

            # Enrich statistics with TMDB data (posters, ratings, etc.)
            await self._enrich_statistics_tmdb()

            await self.tracker.complete_step(
                "fetch_statistics",
                f"Total plays: {stats.total_plays}",
                1,
            )

        except Exception as e:
            logger.error(f"Statistics fetch failed: {e}")
            await self.tracker.complete_step("fetch_statistics", "Fetch failed, continuing", 0)

    async def _enrich_statistics_tmdb(self) -> None:
        """Enrich statistics top movies and shows with TMDB data."""
        if not self.statistics:
            return

        try:
            _, api_key = await get_service_credentials(self.db, "tmdb")
            if not api_key:
                logger.debug("TMDB not configured, skipping statistics enrichment")
                return

            integration = TMDBIntegration(api_key=api_key)

            # Enrich top movies
            if self.statistics.get("top_movies_played"):
                for movie in self.statistics["top_movies_played"]:
                    if isinstance(movie, dict):
                        metadata = await integration.enrich_media(
                            title=movie.get("title", ""),
                            media_type="movie",
                        )
                        if metadata:
                            movie["poster_url"] = metadata.poster_url or ""
                            movie["backdrop_url"] = metadata.backdrop_url or ""
                            movie["rating"] = str(metadata.vote_average or "")
                            movie["year"] = (metadata.release_date or "")[:4] if metadata.release_date else ""

            # Enrich top shows
            if self.statistics.get("top_shows_played"):
                for show in self.statistics["top_shows_played"]:
                    if isinstance(show, dict):
                        metadata = await integration.enrich_media(
                            title=show.get("title", ""),
                            media_type="tv",
                        )
                        if metadata:
                            show["poster_url"] = metadata.poster_url or ""
                            show["backdrop_url"] = metadata.backdrop_url or ""
                            show["rating"] = str(metadata.vote_average or "")
                            show["year"] = (metadata.release_date or "")[:4] if metadata.release_date else ""

            await integration.close()
            logger.debug("Statistics enriched with TMDB data")

        except Exception as e:
            logger.warning(f"Failed to enrich statistics with TMDB: {e}")

    def _build_plex_image_url(self, thumb_path: str | None) -> str:
        """Build a full Plex image URL from a relative thumb path via Tautulli proxy."""
        if not thumb_path or not self._tautulli_url:
            return ""
        # If it's already a full URL, return as-is
        if thumb_path.startswith("http"):
            return thumb_path
        # Build Plex image URL using Tautulli proxy
        # thumb_path looks like /library/metadata/867753/thumb/1768900434
        from urllib.parse import quote
        return f"{self._tautulli_url}/pms_image_proxy?img={quote(thumb_path)}&width=300&height=450&fallback=poster"

    def _normalize_movie(self, movie: dict[str, Any]) -> dict[str, Any]:
        """Normalize movie data for template compatibility."""
        # Build poster URL - prefer TMDB, fallback to Plex via Tautulli
        poster_url = movie.get("poster_url")
        if not poster_url:
            poster_url = self._build_plex_image_url(movie.get("thumb"))

        # Build backdrop URL - prefer TMDB, fallback to Plex art
        backdrop_url = movie.get("backdrop_url")
        if not backdrop_url:
            backdrop_url = self._build_plex_image_url(movie.get("art"))

        return {
            **movie,
            # Map runtime to duration (in minutes, convert to seconds for format_duration)
            "duration": (movie.get("runtime") or 0) * 60,
            # Map overview to summary
            "summary": movie.get("overview") or movie.get("summary") or "",
            # Poster URL (TMDB or Plex via Tautulli)
            "poster_url": poster_url,
            # Backdrop URL for featured movie background
            "backdrop_url": backdrop_url,
            # Map vote_average to rating
            "rating": movie.get("vote_average") or movie.get("rating"),
            # Ensure genres is a list
            "genres": movie.get("genres") or [],
            # Ensure other fields exist with defaults
            "tagline": movie.get("tagline") or "",
            "director": movie.get("director") or "",
            "cast": movie.get("cast") or [],
            "content_rating": movie.get("content_rating") or "",
            "year": movie.get("year") or "",
        }

    def _normalize_episode(self, episode: dict[str, Any]) -> dict[str, Any]:
        """Normalize episode data for template compatibility."""
        # Build poster URL - prefer TMDB, fallback to Plex via Tautulli
        poster_url = episode.get("show_poster_url") or episode.get("poster_url")
        if not poster_url:
            poster_url = self._build_plex_image_url(episode.get("thumb"))

        # Build backdrop URL - prefer TMDB show backdrop, fallback to Plex art
        backdrop_url = episode.get("show_backdrop_url") or episode.get("backdrop_url")
        if not backdrop_url:
            backdrop_url = self._build_plex_image_url(episode.get("art"))

        return {
            **episode,
            # Map season/episode numbers
            "season_number": episode.get("parent_media_index") or episode.get("season_number") or 0,
            "episode_number": episode.get("media_index") or episode.get("episode_number") or 0,
            # Poster URL (TMDB or Plex via Tautulli)
            "poster_url": poster_url,
            # Backdrop URL for series background
            "backdrop_url": backdrop_url,
            # Map genres from show
            "genres": episode.get("show_genres") or episode.get("genres") or [],
            # Map summary
            "summary": episode.get("show_overview") or episode.get("overview") or episode.get("summary") or "",
            # Map rating
            "rating": episode.get("show_vote_average") or episode.get("vote_average") or episode.get("rating"),
            "content_rating": episode.get("content_rating") or "",
            "year": episode.get("year") or episode.get("show_year") or "",
            # Series title for display
            "series_title": episode.get("grandparent_title") or episode.get("series_title") or "",
        }

    def _group_episodes_by_show(self, episodes: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
        """Group episodes by show name."""
        grouped: dict[str, list[dict[str, Any]]] = {}
        for episode in episodes:
            show_name = episode.get("grandparent_title") or episode.get("title") or "Unknown"
            if show_name not in grouped:
                grouped[show_name] = []
            grouped[show_name].append(episode)
        return grouped

    async def _render_template(self) -> str:
        """Render the newsletter template."""
        await self.tracker.start_step("render_template", "Rendering newsletter...")

        try:
            # Get template
            template = await self.db.get(Template, self.config.template_id)
            if not template:
                raise GenerationError("render_template", "Template not found")

            # Normalize movies and series for template compatibility
            normalized_movies = [self._normalize_movie(m) for m in self.movies]
            normalized_series = [self._normalize_episode(e) for e in self.series]

            logger.info(f"Context preparation: {len(self.movies)} raw movies, {len(normalized_movies)} normalized movies")
            logger.info(f"Context preparation: {len(self.series)} raw series, {len(normalized_series)} normalized series")

            # Group episodes by show
            shows_grouped = self._group_episodes_by_show(normalized_series)

            # Prepare featured movie (first movie with good data)
            featured_movie = None
            show_featured_movie = False
            if normalized_movies:
                featured_movie = normalized_movies[0]
                show_featured_movie = bool(featured_movie.get("poster_url"))

            # Prepare real_stats from statistics - pass full statistics object
            # The TautulliStatistics model now has all the fields expected by template_mixe.html
            real_stats = None
            if self.statistics:
                # Start with all statistics data
                real_stats = dict(self.statistics)

                # Build poster URLs for top_movies_played
                if real_stats.get("top_movies_played"):
                    updated_movies = []
                    for movie_stat in real_stats["top_movies_played"]:
                        if isinstance(movie_stat, dict):
                            movie_dict = dict(movie_stat)
                        else:
                            movie_dict = movie_stat.model_dump() if hasattr(movie_stat, "model_dump") else dict(movie_stat)
                        if movie_dict.get("thumb") and not movie_dict.get("poster_url"):
                            movie_dict["poster_url"] = self._build_plex_image_url(movie_dict.get("thumb"))
                        updated_movies.append(movie_dict)
                    real_stats["top_movies_played"] = updated_movies

                # Build poster URLs for top_shows_played
                if real_stats.get("top_shows_played"):
                    updated_shows = []
                    for show_stat in real_stats["top_shows_played"]:
                        if isinstance(show_stat, dict):
                            show_dict = dict(show_stat)
                        else:
                            show_dict = show_stat.model_dump() if hasattr(show_stat, "model_dump") else dict(show_stat)
                        if show_dict.get("thumb") and not show_dict.get("poster_url"):
                            show_dict["poster_url"] = self._build_plex_image_url(show_dict.get("thumb"))
                        updated_shows.append(show_dict)
                    real_stats["top_shows_played"] = updated_shows

                # Convert top_users_by_time to dicts
                if real_stats.get("top_users_by_time"):
                    updated_users = []
                    for user_stat in real_stats["top_users_by_time"]:
                        if isinstance(user_stat, dict):
                            updated_users.append(user_stat)
                        else:
                            updated_users.append(user_stat.model_dump() if hasattr(user_stat, "model_dump") else dict(user_stat))
                    real_stats["top_users_by_time"] = updated_users

            # Build context
            context = {
                "title": template_service.render_title(self.config.title),
                # New normalized data
                "movies": normalized_movies,
                "shows": normalized_series,
                "shows_grouped": shows_grouped,
                "featured_movie": featured_movie,
                "show_featured_movie": show_featured_movie,
                "real_stats": real_stats,
                # Original data (for templates that use these names)
                "series": normalized_series,
                "statistics": self.statistics if self.config.statistics.enabled else None,
                # Other data
                "games": self.games,
                "books": self.books,
                "audiobooks": self.audiobooks,
                "tv_programs": self.tv_programs,
                "maintenance": self.config.maintenance.model_dump() if self.config.maintenance.enabled else None,
                "config": {
                    "tunarr_display_format": self.config.tunarr.display_format,
                    "include_statistics_comparison": self.config.statistics.include_comparison,
                },
            }

            html = template_service.render(template.file_path, context)

            # Debug: Log HTML length and snippet
            logger.info(f"Rendered HTML length: {len(html)} characters")
            if len(html) < 500:
                logger.warning(f"HTML content seems too short: {html}")
            else:
                logger.debug(f"HTML preview (first 500 chars): {html[:500]}")

            await self.tracker.complete_step(
                "render_template",
                "Template rendered successfully",
                1,
            )

            return html

        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            await self.tracker.fail_step("render_template", str(e))
            raise GenerationError("render_template", str(e))

    async def _publish_ghost(self, html: str) -> str | None:
        """Publish newsletter to Ghost."""
        await self.tracker.start_step("publish_ghost", "Publishing to Ghost...")

        try:
            url, api_key = await get_service_credentials(self.db, "ghost")
            if not url or not api_key:
                await self.tracker.skip_step("publish_ghost", "Ghost not configured")
                return None

            integration = GhostIntegration(url=url, api_key=api_key)

            # Determine status and email settings
            status = "draft"
            send_email = False

            if self.config.publication_mode == PublicationMode.PUBLISH:
                status = "published"
            elif self.config.publication_mode == PublicationMode.EMAIL:
                status = "published"
                send_email = True
            elif self.config.publication_mode == PublicationMode.EMAIL_PUBLISH:
                status = "published"
                send_email = True

            title = template_service.render_title(self.config.title)

            # Debug: Log what we're sending to Ghost
            logger.info(f"Publishing to Ghost: title='{title}', html_length={len(html)}, status={status}, send_email={send_email}")

            post = await integration.create_post(
                title=title,
                html=html,
                status=status,
                newsletter_id=self.config.ghost_newsletter_id,
                send_email=send_email,
            )
            await integration.close()

            if post:
                self.history.ghost_post_id = post.id

                await self.tracker.complete_step(
                    "publish_ghost",
                    f"Published as {status}",
                    1,
                )
                return post.url

            await self.tracker.complete_step("publish_ghost", "Published", 1)
            return None

        except Exception as e:
            logger.error(f"Ghost publish failed: {e}")
            await self.tracker.fail_step("publish_ghost", str(e))
            raise GenerationError("publish_ghost", str(e))

    async def _finalize(self) -> History:
        """Finalize the history entry."""
        self.history.completed_at = datetime.utcnow()
        self.history.duration_seconds = self.tracker.get_total_duration() if self.tracker else 0
        self.history.progress_log = self.tracker.get_progress_log() if self.tracker else []

        await self.db.commit()
        await self.db.refresh(self.history)

        return self.history


async def cancel_generation(generation_id: str) -> bool:
    """Cancel an active generation."""
    tracker = _active_generations.get(generation_id)
    if tracker:
        await tracker.cancel_generation()
        return True
    return False


def is_generation_active(generation_id: str) -> bool:
    """Check if a generation is currently active."""
    return generation_id in _active_generations
