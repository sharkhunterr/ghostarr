"""Tautulli integration for media server statistics."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

logger = get_logger(__name__)


class MediaItem(BaseModel):
    """Media item from Tautulli."""

    title: str
    year: int | None = None
    media_type: str  # "movie" or "episode"
    rating_key: str
    thumb: str | None = None
    art: str | None = None
    added_at: datetime | None = None
    grandparent_title: str | None = None  # Series name for episodes
    parent_media_index: int | None = None  # Season number
    media_index: int | None = None  # Episode number
    tmdb_id: str | None = None
    imdb_id: str | None = None


class MovieStats(BaseModel):
    """Movie statistics with evolution data."""

    title: str = ""
    plays: int = 0
    total_duration: int = 0
    poster_url: str = ""
    year: str = ""
    rating: str = ""
    thumb: str | None = None
    # Evolution data
    evolution_type: str | None = None  # 'new', 'up', 'down', 'stable'
    evolution_value: int = 0
    evolution_percentage: float | None = None


class ShowStats(BaseModel):
    """Show statistics with evolution data."""

    title: str = ""
    plays: int = 0
    total_duration: int = 0
    poster_url: str = ""
    year: str = ""
    rating: str = ""
    thumb: str | None = None
    # Evolution data
    evolution_type: str | None = None
    evolution_value: int = 0
    evolution_percentage: float | None = None


class UserStats(BaseModel):
    """User statistics."""

    username: str = ""
    user_id: int = 0
    friendly_name: str = ""
    plays: int = 0
    watch_time: int = 0  # seconds
    movies_count: int = 0
    shows_count: int = 0
    # Evolution data
    evolution_type: str | None = None
    evolution_value: int = 0


class TautulliStatistics(BaseModel):
    """Full statistics from Tautulli matching template_mixe.html expectations."""

    # General statistics
    total_plays: int = 0
    total_duration: int = 0  # seconds
    total_watch_time: int = 0  # seconds (same as total_duration, for template compatibility)
    movies_plays: int = 0
    series_plays: int = 0
    unique_users: int = 0
    unique_content: int = 0

    # Growth percentages (compared to previous period)
    plays_growth_percentage: float = 0.0
    time_growth_percentage: float = 0.0
    users_growth_percentage: float = 0.0

    # Previous period data for comparison
    previous_total_plays: int = 0
    previous_total_watch_time: int = 0
    previous_unique_users: int = 0

    # Rankings with detailed data
    top_movies_played: list[MovieStats] = []
    top_shows_played: list[ShowStats] = []
    top_users_by_time: list[UserStats] = []

    # Time-based statistics
    plays_by_hour: dict[int, int] = {}  # {hour: count}
    plays_by_weekday: dict[str, int] = {}  # {day_name: count}
    daily_views_by_type: list[dict[str, Any]] = []  # [{day, movies, series, total}]

    # Library totals
    library_total_movies: int = 0
    library_total_shows: int = 0
    library_total_episodes: int = 0

    # Additional data for charts
    content_distribution: dict[str, int] = {}  # {movies: x, series: y}
    top_genres: list[dict[str, Any]] = []

    # Legacy fields for backward compatibility
    top_movies: list[dict[str, Any]] = []
    top_shows: list[dict[str, Any]] = []


class TautulliIntegration(BaseIntegration[MediaItem]):
    """Integration with Tautulli for Plex/Jellyfin statistics."""

    SERVICE_NAME = "Tautulli"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Tautulli."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request(
                "GET",
                "/api/v2",
                params={"apikey": self.api_key, "cmd": "get_server_info"},
            )
            elapsed_ms = int((time.time() - start) * 1000)

            if response.get("response", {}).get("result") == "success":
                server_name = response.get("response", {}).get("data", {}).get("pms_name", "Unknown")
                return True, f"Connected to {server_name}", elapsed_ms

            return False, "Invalid response from Tautulli", elapsed_ms

        except Exception as e:
            logger.error(f"Tautulli connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(self, days: int = 7, max_items: int = -1, **kwargs: Any) -> list[MediaItem]:
        """Fetch recently added media from Tautulli."""
        if not self.is_configured:
            return []

        items: list[MediaItem] = []
        since_date = datetime.now() - timedelta(days=days)
        since_timestamp = int(since_date.timestamp())

        try:
            # Fetch recently added
            response = await self._request(
                "GET",
                "/api/v2",
                params={
                    "apikey": self.api_key,
                    "cmd": "get_recently_added",
                    "count": 100 if max_items == -1 else max_items,
                },
            )

            data = response.get("response", {}).get("data", {})
            recently_added = data.get("recently_added", [])

            for item in recently_added:
                added_at_raw = item.get("added_at", 0)
                # Convert to int if it's a string
                try:
                    added_at = int(added_at_raw) if added_at_raw else 0
                except (ValueError, TypeError):
                    added_at = 0

                if added_at < since_timestamp:
                    continue

                # Parse optional integer fields safely
                def safe_int(val: Any) -> int | None:
                    if val is None or val == "":
                        return None
                    try:
                        return int(val)
                    except (ValueError, TypeError):
                        return None

                media_item = MediaItem(
                    title=item.get("title", "Unknown"),
                    year=safe_int(item.get("year")),
                    media_type="episode" if item.get("media_type") == "episode" else "movie",
                    rating_key=str(item.get("rating_key", "")),
                    thumb=item.get("thumb"),
                    art=item.get("art"),
                    added_at=datetime.fromtimestamp(added_at) if added_at else None,
                    grandparent_title=item.get("grandparent_title"),
                    parent_media_index=safe_int(item.get("parent_media_index")),
                    media_index=safe_int(item.get("media_index")),
                )
                items.append(media_item)

                if max_items != -1 and len(items) >= max_items:
                    break

        except Exception as e:
            logger.error(f"Failed to fetch Tautulli data: {e}")

        return items

    async def fetch_statistics(self, days: int = 7, include_comparison: bool = False) -> TautulliStatistics:
        """Fetch comprehensive viewing statistics from Tautulli.

        Args:
            days: Number of days for statistics
            include_comparison: If True, fetch previous period data and calculate growth
        """
        if not self.is_configured:
            return TautulliStatistics()

        stats = TautulliStatistics()
        previous_stats: TautulliStatistics | None = None

        try:
            # Get home stats (top movies, shows, users)
            await self._fetch_home_stats(stats, days)

            # Get library media info
            await self._fetch_library_stats(stats)

            # Get plays by date for totals
            await self._fetch_plays_by_date(stats, days)

            # Get plays by hour of day
            await self._fetch_plays_by_hour(stats, days)

            # Get plays by day of week
            await self._fetch_plays_by_dayofweek(stats, days)

            # Calculate content distribution
            total = stats.movies_plays + stats.series_plays
            if total > 0:
                stats.content_distribution = {
                    "movies": int((stats.movies_plays / total) * 100),
                    "series": int((stats.series_plays / total) * 100),
                }

            # Fetch previous period stats for comparison
            if include_comparison:
                previous_stats = await self._fetch_previous_period_stats(days)
                previous_rankings = await self._fetch_previous_rankings(days)
                self._calculate_comparison(stats, previous_stats, previous_rankings)

        except Exception as e:
            logger.error(f"Failed to fetch Tautulli statistics: {e}")

        return stats

    async def _fetch_previous_period_stats(self, days: int) -> TautulliStatistics:
        """Fetch statistics from the previous period for comparison."""
        previous_stats = TautulliStatistics()

        try:
            # For previous period, we need to offset the time_range
            # Tautulli doesn't have a direct way to specify a date range,
            # so we fetch 2x the period and calculate the difference

            # Fetch home stats for double the period
            response = await self._request(
                "GET",
                "/api/v2",
                params={
                    "apikey": self.api_key,
                    "cmd": "get_home_stats",
                    "time_range": days * 2,
                    "stats_type": "duration",
                    "stats_count": 10,
                },
            )

            data = response.get("response", {}).get("data", [])

            for stat in data:
                stat_id = stat.get("stat_id", "")
                rows = stat.get("rows", [])

                if stat_id == "top_users":
                    # Total duration for the full 2x period
                    total_2x = sum(self._safe_int(row.get("total_duration", 0)) for row in rows)
                    previous_stats.total_duration = total_2x
                    previous_stats.total_watch_time = total_2x
                    previous_stats.unique_users = len(rows)

            # Fetch plays by date for the double period
            response = await self._request(
                "GET",
                "/api/v2",
                params={
                    "apikey": self.api_key,
                    "cmd": "get_plays_by_date",
                    "time_range": days * 2,
                },
            )

            plays_data = response.get("response", {}).get("data", {})
            series_data = plays_data.get("series", [])

            # Sum plays for the full 2x period
            total_plays_2x = 0
            for serie in series_data:
                data_points = serie.get("data", [])
                total_plays_2x += sum(self._safe_int(dp) for dp in data_points)

            previous_stats.total_plays = total_plays_2x

        except Exception as e:
            logger.warning(f"Failed to fetch previous period stats: {e}")

        return previous_stats

    def _calculate_comparison(
        self,
        current: TautulliStatistics,
        previous_2x: TautulliStatistics,
        previous_rankings: dict[str, dict[str, int]],
    ) -> None:
        """Calculate growth percentages comparing current period to previous period.

        Since we fetched 2x the period, we need to subtract current from 2x to get previous.
        """
        # Previous period values = 2x period - current period
        previous_plays = max(0, previous_2x.total_plays - current.total_plays)
        previous_watch_time = max(0, previous_2x.total_watch_time - current.total_watch_time)
        # For users, we can't easily subtract, so estimate based on proportion
        previous_users = max(1, previous_2x.unique_users)  # Approximate

        # Store previous values
        current.previous_total_plays = previous_plays
        current.previous_total_watch_time = previous_watch_time
        current.previous_unique_users = previous_users

        # Calculate growth percentages
        if previous_plays > 0:
            current.plays_growth_percentage = round(
                ((current.total_plays - previous_plays) / previous_plays) * 100, 1
            )
        elif current.total_plays > 0:
            current.plays_growth_percentage = 100.0  # New activity

        if previous_watch_time > 0:
            current.time_growth_percentage = round(
                ((current.total_watch_time - previous_watch_time) / previous_watch_time) * 100, 1
            )
        elif current.total_watch_time > 0:
            current.time_growth_percentage = 100.0

        if previous_users > 0:
            current.users_growth_percentage = round(
                ((current.unique_users - previous_users) / previous_users) * 100, 1
            )

        # Update evolution types for top movies, shows and users based on ranking changes
        self._update_evolution_types(current, previous_rankings)

        logger.info(
            f"Comparison calculated - Current: plays={current.total_plays}, watch_time={current.total_watch_time}, users={current.unique_users}"
        )
        logger.info(
            f"Comparison calculated - Previous: plays={previous_plays}, watch_time={previous_watch_time}, users={previous_users}"
        )
        logger.info(
            f"Comparison calculated - Growth: plays={current.plays_growth_percentage}%, "
            f"time={current.time_growth_percentage}%, users={current.users_growth_percentage}%"
        )

    async def _fetch_previous_rankings(self, days: int) -> dict[str, dict[str, int]]:
        """Fetch rankings from the previous period to calculate evolution.

        Uses get_history API with after/before date filters to get playback data
        for the previous period, then calculates rankings based on play counts.

        Returns a dict with 'movies', 'shows', 'users' keys, each containing
        a dict mapping title/username to their previous position (1-indexed).
        """
        previous_rankings: dict[str, dict[str, int]] = {
            "movies": {},
            "shows": {},
            "users": {},
        }

        try:
            # Previous period: from (2*days ago) to (days ago)
            end_date = datetime.now() - timedelta(days=days)
            start_date = end_date - timedelta(days=days)

            logger.info(
                f"Fetching previous rankings for period {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')} using get_history"
            )

            # Fetch history for the previous period
            response = await self._request(
                "GET",
                "/api/v2",
                params={
                    "apikey": self.api_key,
                    "cmd": "get_history",
                    "after": start_date.strftime("%Y-%m-%d"),
                    "before": end_date.strftime("%Y-%m-%d"),
                    "length": 5000,  # Get enough records
                },
            )

            result = response.get("response", {}).get("result")
            logger.info(f"Previous rankings get_history result: {result}")

            if result != "success":
                logger.warning("Failed to fetch history for previous period")
                return previous_rankings

            history_data = response.get("response", {}).get("data", {}).get("data", [])
            logger.info(f"Previous period history records: {len(history_data)}")

            # Aggregate play counts by title/user
            movie_plays: dict[str, int] = {}
            show_plays: dict[str, int] = {}
            user_plays: dict[str, int] = {}

            for record in history_data:
                media_type = record.get("media_type", "")
                title = record.get("full_title", "") or record.get("title", "")
                user = record.get("friendly_name", "") or record.get("user", "")

                # For shows, use grandparent_title (series name)
                if media_type == "episode":
                    show_title = record.get("grandparent_title", "") or title
                    if show_title:
                        show_plays[show_title] = show_plays.get(show_title, 0) + 1
                elif media_type == "movie":
                    if title:
                        movie_plays[title] = movie_plays.get(title, 0) + 1

                # Count user plays regardless of media type
                if user:
                    user_plays[user] = user_plays.get(user, 0) + 1

            # Sort by play count and assign rankings
            sorted_movies = sorted(movie_plays.items(), key=lambda x: x[1], reverse=True)
            for position, (title, _) in enumerate(sorted_movies[:10], 1):
                previous_rankings["movies"][title] = position

            sorted_shows = sorted(show_plays.items(), key=lambda x: x[1], reverse=True)
            for position, (title, _) in enumerate(sorted_shows[:10], 1):
                previous_rankings["shows"][title] = position

            sorted_users = sorted(user_plays.items(), key=lambda x: x[1], reverse=True)
            for position, (username, _) in enumerate(sorted_users[:10], 1):
                previous_rankings["users"][username] = position

            logger.info(
                f"Previous rankings calculated from history - movies: {previous_rankings['movies']}, "
                f"shows: {previous_rankings['shows']}, users: {previous_rankings['users']}"
            )

        except Exception as e:
            logger.warning(f"Failed to fetch previous rankings: {e}")

        return previous_rankings

    def _calculate_item_evolution(
        self, current_position: int, previous_position: int | None
    ) -> tuple[str, int]:
        """Calculate evolution type and value for an item.

        Args:
            current_position: Current ranking position (1-indexed)
            previous_position: Previous ranking position (1-indexed) or None if new

        Returns:
            Tuple of (evolution_type, evolution_value)
            - evolution_type: 'new', 'up', 'down', or 'stable'
            - evolution_value: Number of positions changed (positive for up, positive for down display)
        """
        if previous_position is None:
            # New in ranking
            return "new", 0
        elif previous_position > current_position:
            # Moved up (was lower position number = better rank)
            return "up", previous_position - current_position
        elif previous_position < current_position:
            # Moved down
            return "down", current_position - previous_position
        else:
            # Same position
            return "stable", 0

    def _update_evolution_types(
        self, stats: TautulliStatistics, previous_rankings: dict[str, dict[str, int]]
    ) -> None:
        """Update evolution types based on ranking changes.

        Compares current rankings with previous period rankings to determine
        if each item moved up, down, is new, or stayed stable.
        """
        logger.info(f"Updating evolution types with previous rankings: {previous_rankings}")

        # For movies - calculate individual evolution based on ranking change
        for position, movie in enumerate(stats.top_movies_played, 1):
            previous_pos = previous_rankings.get("movies", {}).get(movie.title)
            evolution_type, evolution_value = self._calculate_item_evolution(
                position, previous_pos
            )
            logger.info(
                f"Movie '{movie.title}': current_pos={position}, previous_pos={previous_pos} "
                f"-> {evolution_type} ({evolution_value})"
            )
            movie.evolution_type = evolution_type
            movie.evolution_value = evolution_value
            movie.evolution_percentage = None  # Not used for ranking evolution

        # For shows - calculate individual evolution based on ranking change
        for position, show in enumerate(stats.top_shows_played, 1):
            previous_pos = previous_rankings.get("shows", {}).get(show.title)
            evolution_type, evolution_value = self._calculate_item_evolution(
                position, previous_pos
            )
            logger.info(
                f"Show '{show.title}': current_pos={position}, previous_pos={previous_pos} "
                f"-> {evolution_type} ({evolution_value})"
            )
            show.evolution_type = evolution_type
            show.evolution_value = evolution_value
            show.evolution_percentage = None

        # For users - calculate individual evolution based on ranking change
        for position, user in enumerate(stats.top_users_by_time, 1):
            # Try friendly_name first, then username
            username = user.friendly_name or user.username
            previous_pos = previous_rankings.get("users", {}).get(username)
            evolution_type, evolution_value = self._calculate_item_evolution(
                position, previous_pos
            )
            logger.info(
                f"User '{username}': current_pos={position}, previous_pos={previous_pos} "
                f"-> {evolution_type} ({evolution_value})"
            )
            user.evolution_type = evolution_type
            user.evolution_value = evolution_value

    async def _fetch_home_stats(self, stats: TautulliStatistics, days: int) -> None:
        """Fetch home stats (top movies, shows, users)."""
        response = await self._request(
            "GET",
            "/api/v2",
            params={
                "apikey": self.api_key,
                "cmd": "get_home_stats",
                "time_range": days,
                "stats_type": "duration",
                "stats_count": 10,
            },
        )

        data = response.get("response", {}).get("data", [])

        for stat in data:
            stat_id = stat.get("stat_id", "")
            rows = stat.get("rows", [])

            if stat_id == "top_movies":
                stats.top_movies = rows[:5]
                stats.top_movies_played = [
                    MovieStats(
                        title=row.get("title", ""),
                        plays=self._safe_int(row.get("total_plays", 0)),
                        total_duration=self._safe_int(row.get("total_duration", 0)),
                        thumb=row.get("thumb"),
                        year=str(row.get("year", "")),
                        rating=str(row.get("rating", "")),
                        evolution_type="stable",  # Will be updated by _update_evolution_types if comparison enabled
                    )
                    for row in rows[:5]
                ]
            elif stat_id == "top_tv":
                stats.top_shows = rows[:5]
                stats.top_shows_played = [
                    ShowStats(
                        title=row.get("title", ""),
                        plays=self._safe_int(row.get("total_plays", 0)),
                        total_duration=self._safe_int(row.get("total_duration", 0)),
                        thumb=row.get("thumb"),
                        year=str(row.get("year", "")),
                        rating=str(row.get("rating", "")),
                        evolution_type="stable",
                    )
                    for row in rows[:5]
                ]
            elif stat_id == "top_users":
                stats.unique_users = len(rows)
                stats.top_users_by_time = [
                    UserStats(
                        username=row.get("user", ""),
                        user_id=self._safe_int(row.get("user_id", 0)),
                        friendly_name=row.get("friendly_name", row.get("user", "")),
                        plays=self._safe_int(row.get("total_plays", 0)),
                        watch_time=self._safe_int(row.get("total_duration", 0)),
                        evolution_type="stable",
                    )
                    for row in rows[:5]
                ]
                # Calculate total watch time from all users (not just top 5)
                stats.total_duration = sum(self._safe_int(row.get("total_duration", 0)) for row in rows)
                stats.total_watch_time = stats.total_duration

    async def _fetch_library_stats(self, stats: TautulliStatistics) -> None:
        """Fetch library media counts."""
        response = await self._request(
            "GET",
            "/api/v2",
            params={
                "apikey": self.api_key,
                "cmd": "get_libraries",
            },
        )

        libraries = response.get("response", {}).get("data", [])

        for lib in libraries:
            section_type = lib.get("section_type", "")
            count = self._safe_int(lib.get("count", 0))

            if section_type == "movie":
                stats.library_total_movies += count
            elif section_type == "show":
                stats.library_total_shows += count
                # Child count is typically episodes
                stats.library_total_episodes += self._safe_int(lib.get("child_count", 0))

    def _safe_int(self, value: Any) -> int:
        """Safely convert a value to int, handling strings and None."""
        if value is None:
            return 0
        try:
            return int(value)
        except (ValueError, TypeError):
            return 0

    async def _fetch_plays_by_date(self, stats: TautulliStatistics, days: int) -> None:
        """Fetch plays by date for totals and daily breakdown."""
        response = await self._request(
            "GET",
            "/api/v2",
            params={
                "apikey": self.api_key,
                "cmd": "get_plays_by_date",
                "time_range": days,
            },
        )

        plays_data = response.get("response", {}).get("data", {})
        categories = plays_data.get("categories", [])
        series_data = plays_data.get("series", [])

        logger.debug(f"Plays by date - categories: {len(categories)}, series: {len(series_data)}")
        for serie in series_data:
            logger.debug(f"  Serie: {serie.get('name')} with {len(serie.get('data', []))} data points")

        daily_views: list[dict[str, Any]] = []

        # Process series data (TV and Movies)
        # Tautulli returns library names, so we check for common patterns
        for day_idx, day_label in enumerate(categories):
            day_data = {"day": day_label, "movies": 0, "series": 0, "total": 0}

            for serie in series_data:
                serie_name = serie.get("name", "").lower()
                data_points = serie.get("data", [])

                if day_idx < len(data_points):
                    count = self._safe_int(data_points[day_idx])
                    # Check for movie libraries (Movies, Films, etc.)
                    if any(keyword in serie_name for keyword in ["movie", "film", "movies", "films"]):
                        day_data["movies"] += count
                        stats.movies_plays += count
                    # Check for TV libraries (TV, Shows, Series, etc.)
                    elif any(keyword in serie_name for keyword in ["tv", "show", "serie", "séries", "series"]):
                        day_data["series"] += count
                        stats.series_plays += count
                    else:
                        # Unknown library type, add to total anyway
                        logger.debug(f"Unknown library type: {serie_name}")
                    day_data["total"] += count
                    stats.total_plays += count

            daily_views.append(day_data)

        stats.daily_views_by_type = daily_views
        logger.debug(f"Total plays calculated: {stats.total_plays}, movies: {stats.movies_plays}, series: {stats.series_plays}")

    async def _fetch_plays_by_hour(self, stats: TautulliStatistics, days: int) -> None:
        """Fetch plays by hour of day."""
        response = await self._request(
            "GET",
            "/api/v2",
            params={
                "apikey": self.api_key,
                "cmd": "get_plays_by_hourofday",
                "time_range": days,
            },
        )

        plays_data = response.get("response", {}).get("data", {})
        categories = plays_data.get("categories", [])
        series_data = plays_data.get("series", [])

        plays_by_hour: dict[int, int] = {}

        # Sum all series (Movies + TV) for each hour
        for hour_idx, hour_label in enumerate(categories):
            try:
                hour = int(hour_label)
            except ValueError:
                hour = hour_idx

            total_for_hour = 0
            for serie in series_data:
                data_points = serie.get("data", [])
                if hour_idx < len(data_points):
                    total_for_hour += self._safe_int(data_points[hour_idx])

            plays_by_hour[hour] = total_for_hour

        stats.plays_by_hour = plays_by_hour

    async def _fetch_plays_by_dayofweek(self, stats: TautulliStatistics, days: int) -> None:
        """Fetch plays by day of week."""
        response = await self._request(
            "GET",
            "/api/v2",
            params={
                "apikey": self.api_key,
                "cmd": "get_plays_by_dayofweek",
                "time_range": days,
            },
        )

        plays_data = response.get("response", {}).get("data", {})
        categories = plays_data.get("categories", [])
        series_data = plays_data.get("series", [])

        plays_by_weekday: dict[str, int] = {}

        # French day names for template
        day_names = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

        for day_idx, day_label in enumerate(categories):
            # Try to map to French day name
            day_name = day_names[day_idx] if day_idx < len(day_names) else day_label

            total_for_day = 0
            for serie in series_data:
                data_points = serie.get("data", [])
                if day_idx < len(data_points):
                    total_for_day += self._safe_int(data_points[day_idx])

            plays_by_weekday[day_name] = total_for_day

        stats.plays_by_weekday = plays_by_weekday
