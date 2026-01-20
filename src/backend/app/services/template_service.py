"""Template service for rendering newsletters with Jinja2."""

from datetime import datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from jinja2.sandbox import SandboxedEnvironment

from app.config import settings
from app.core.exceptions import TemplateError
from app.core.logging import get_logger

logger = get_logger(__name__)


class TemplateService:
    """Service for rendering newsletter templates."""

    def __init__(self):
        """Initialize template service with Jinja2 sandboxed environment."""
        self._env: SandboxedEnvironment | None = None

    def _get_env(self) -> SandboxedEnvironment:
        """Get or create Jinja2 sandboxed environment."""
        if self._env is None:
            templates_dir = Path(settings.templates_dir)
            templates_dir.mkdir(parents=True, exist_ok=True)

            self._env = SandboxedEnvironment(
                loader=FileSystemLoader([
                    str(templates_dir),
                    str(Path(__file__).parent.parent.parent.parent / "templates"),
                ]),
                autoescape=select_autoescape(["html", "xml"]),
                trim_blocks=True,
                lstrip_blocks=True,
            )

            # Add custom filters
            self._env.filters["format_date"] = self._filter_format_date
            self._env.filters["format_duration"] = self._filter_format_duration
            self._env.filters["duration"] = self._filter_format_duration
            self._env.filters["truncate_text"] = self._filter_truncate_text
            self._env.filters["format_time"] = self._filter_format_time
            self._env.filters["number_format"] = self._filter_number_format
            self._env.filters["zfill"] = self._filter_zfill
            self._env.filters["unique"] = self._filter_unique

            # Add global functions available in templates
            self._env.globals["len"] = len
            self._env.globals["range"] = range
            self._env.globals["str"] = str
            self._env.globals["int"] = int
            self._env.globals["min"] = min
            self._env.globals["max"] = max
            self._env.globals["abs"] = abs
            self._env.globals["round"] = round
            self._env.globals["sorted"] = sorted
            self._env.globals["enumerate"] = enumerate
            self._env.globals["zip"] = zip
            self._env.globals["list"] = list
            self._env.globals["dict"] = dict
            self._env.globals["bool"] = bool
            self._env.globals["float"] = float

            # Also expose filters as callable functions for templates using func(val) syntax
            self._env.globals["format_duration"] = self._filter_format_duration
            self._env.globals["format_date"] = self._filter_format_date
            self._env.globals["format_time"] = self._filter_format_time
            self._env.globals["truncate_text"] = self._filter_truncate_text
            self._env.globals["number_format"] = self._filter_number_format
            self._env.globals["zfill"] = self._filter_zfill
            self._env.globals["format_cast_list"] = self._format_cast_list

            # Add datetime.now as global (used as {{ now() }} in templates)
            self._env.globals["now"] = datetime.now

        return self._env

    @staticmethod
    def _format_cast_list(cast: list | None, limit: int = 3) -> str:
        """Format a cast list to a comma-separated string."""
        if not cast:
            return ""
        if isinstance(cast, list):
            names = []
            for member in cast[:limit]:
                if isinstance(member, dict):
                    names.append(member.get("name", str(member)))
                else:
                    names.append(str(member))
            return ", ".join(names)
        return str(cast)

    @staticmethod
    def _filter_format_date(value: datetime | str, format: str = "%d %B %Y") -> str:
        """Format a date."""
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return str(value)
        return value.strftime(format)

    @staticmethod
    def _filter_format_duration(seconds: float) -> str:
        """Format duration in seconds to human readable."""
        if seconds < 60:
            return f"{int(seconds)}s"
        minutes = int(seconds // 60)
        if minutes < 60:
            return f"{minutes}min"
        hours = int(minutes // 60)
        remaining_mins = minutes % 60
        return f"{hours}h{remaining_mins:02d}"

    @staticmethod
    def _filter_truncate_text(text: str, length: int = 150) -> str:
        """Truncate text to specified length."""
        if len(text) <= length:
            return text
        return text[:length].rsplit(" ", 1)[0] + "..."

    @staticmethod
    def _filter_format_time(value: datetime | str, format: str = "%H:%M") -> str:
        """Format a time."""
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return str(value)
        return value.strftime(format)

    @staticmethod
    def _filter_number_format(value: int | float, sep: str = " ") -> str:
        """Format a number with thousand separators."""
        return f"{value:,}".replace(",", sep)

    @staticmethod
    def _filter_zfill(value: int | str, width: int = 2) -> str:
        """Pad a number/string with zeros."""
        return str(value).zfill(width)

    @staticmethod
    def _filter_unique(value: list) -> list:
        """Return unique items from a list, preserving order."""
        seen = set()
        result = []
        for item in value:
            # Make hashable for set comparison
            key = item if isinstance(item, (str, int, float, bool, type(None))) else str(item)
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result

    def validate_template(self, template_path: str) -> tuple[bool, str | None]:
        """Validate a template file.

        Returns:
            Tuple of (is_valid, error_message)
        """
        try:
            env = self._get_env()
            template = env.get_template(template_path)

            # Try to render with empty context to check syntax
            template.render({})
            return True, None

        except Exception as e:
            logger.error(f"Template validation failed: {e}")
            return False, str(e)

    def render(
        self,
        template_path: str,
        context: dict[str, Any],
    ) -> str:
        """Render a template with the given context.

        Args:
            template_path: Path to template file (relative to templates dir)
            context: Template variables

        Returns:
            Rendered HTML string

        Raises:
            TemplateError: If template rendering fails
        """
        try:
            env = self._get_env()
            template = env.get_template(template_path)

            # Add date helpers to context
            # now is a function for templates using {{ now().strftime(...) }}
            context["now"] = datetime.now
            now = datetime.now()
            context["date"] = {
                "now": now,
                "year": now.year,
                "month": now.strftime("%B"),
                "month_num": now.month,
                "day": now.day,
                "week": now.isocalendar()[1],
                "weekday": now.strftime("%A"),
                "formatted": now.strftime("%d %B %Y"),
                "iso": now.isoformat(),
            }

            return template.render(context)

        except Exception as e:
            logger.error(f"Template rendering failed: {e}")
            raise TemplateError(
                message=f"Failed to render template: {e}",
                variable=self._extract_variable_from_error(str(e)),
            )

    def _extract_variable_from_error(self, error: str) -> str | None:
        """Extract variable name from Jinja2 error message."""
        if "'" in error:
            parts = error.split("'")
            if len(parts) >= 2:
                return parts[1]
        return None

    def render_title(self, title_template: str) -> str:
        """Render a title template with date variables.

        Args:
            title_template: Title with optional variables like {{date.week}}

        Returns:
            Rendered title string
        """
        try:
            env = self._get_env()
            template = env.from_string(title_template)

            now = datetime.now()
            context = {
                "date": {
                    "now": now,
                    "year": now.year,
                    "month": now.strftime("%B"),
                    "month_num": now.month,
                    "day": now.day,
                    "week": now.isocalendar()[1],
                    "weekday": now.strftime("%A"),
                    "formatted": now.strftime("%d %B %Y"),
                    "range": f"{(now - __import__('datetime').timedelta(days=7)).strftime('%d/%m')} - {now.strftime('%d/%m')}",
                },
            }

            return template.render(context)

        except Exception as e:
            logger.warning(f"Title rendering failed, using original: {e}")
            return title_template

    def get_mock_context(self) -> dict[str, Any]:
        """Get mock context for template preview."""
        return {
            "title": "Newsletter de la semaine 3",
            "generation_date": datetime.now(),
            "language": "fr",
            "movies": [
                {
                    "title": "Inception",
                    "year": 2010,
                    "runtime": 148,
                    "overview": "Un voleur qui s'infiltre dans les rêves des autres pour voler leurs secrets les plus profonds se voit offrir une chance de rédemption.",
                    "poster_url": "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
                    "rating": 8.4,
                    "genres": ["Science-Fiction", "Action", "Aventure"],
                },
                {
                    "title": "The Dark Knight",
                    "year": 2008,
                    "runtime": 152,
                    "overview": "Batman doit accepter l'une des plus grandes épreuves psychologiques de sa capacité à combattre l'injustice.",
                    "poster_url": "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
                    "rating": 9.0,
                    "genres": ["Action", "Crime", "Drame"],
                },
                {
                    "title": "Interstellar",
                    "year": 2014,
                    "runtime": 169,
                    "overview": "Un groupe d'explorateurs utilise une brèche spatiotemporelle pour repousser les limites de l'exploration spatiale.",
                    "poster_url": "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
                    "rating": 8.6,
                    "genres": ["Science-Fiction", "Aventure", "Drame"],
                },
            ],
            "series": [
                {
                    "title": "Breaking Bad",
                    "year": 2008,
                    "season": 5,
                    "episode": 16,
                    "episode_title": "Felina",
                    "overview": "Le dernier épisode de la série épique.",
                    "poster_url": "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
                    "rating": 9.5,
                    "genres": ["Drame", "Crime"],
                },
                {
                    "title": "Game of Thrones",
                    "year": 2011,
                    "season": 1,
                    "episode": 1,
                    "episode_title": "Winter Is Coming",
                    "overview": "Le roi Robert arrive à Winterfell pour demander à Ned Stark d'être sa Main.",
                    "poster_url": "https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
                    "rating": 9.2,
                    "genres": ["Fantaisie", "Drame", "Action"],
                },
            ],
            "games": [
                {
                    "name": "The Legend of Zelda: Breath of the Wild",
                    "platform": "Nintendo Switch",
                    "cover_url": None,
                },
                {
                    "name": "Super Mario Odyssey",
                    "platform": "Nintendo Switch",
                    "cover_url": None,
                },
            ],
            "books": [
                {
                    "name": "Batman: Year One",
                    "series_title": "Batman",
                    "thumbnail": None,
                },
                {
                    "name": "Spider-Man: Blue",
                    "series_title": "Spider-Man",
                    "thumbnail": None,
                },
            ],
            "audiobooks": [
                {
                    "title": "Dune",
                    "author": "Frank Herbert",
                    "narrator": "Scott Brick",
                    "cover": None,
                    "duration": 75600,
                },
            ],
            "programming": [
                {
                    "title": "Film du Vendredi",
                    "channel": "Cinema HD",
                    "start_time": datetime.now().replace(hour=20, minute=30),
                },
            ],
            "statistics": {
                "total_plays": 1256,
                "total_duration": 450000,
                "movies_watched": 42,
                "episodes_watched": 114,
                "unique_users": 8,
                "top_movies": [
                    {"title": "Inception", "plays": 12},
                    {"title": "Interstellar", "plays": 8},
                ],
                "top_shows": [
                    {"title": "Breaking Bad", "plays": 45},
                    {"title": "Game of Thrones", "plays": 32},
                ],
            },
            "maintenance": None,
        }


# Global instance
template_service = TemplateService()
