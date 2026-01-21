"""Base integration class for external services."""

import time
from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

import httpx

from app.core.exceptions import IntegrationError
from app.core.logging import get_logger

T = TypeVar("T")

logger = get_logger(__name__)


class BaseIntegration(ABC, Generic[T]):
    """Abstract base class for external service integrations."""

    SERVICE_NAME: str = "unknown"
    DEFAULT_TIMEOUT: int = 30
    MAX_RETRIES: int = 3
    RETRY_DELAY: float = 1.0

    def __init__(self, url: str, api_key: str):
        """Initialize integration with URL and API key."""
        self.url = url.rstrip("/") if url else ""
        self.api_key = api_key or ""
        self._client: httpx.AsyncClient | None = None

    @property
    def is_configured(self) -> bool:
        """Check if integration has required configuration."""
        return bool(self.url and self.api_key)

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=self.url,
                timeout=httpx.Timeout(self.DEFAULT_TIMEOUT),
                headers=self._get_default_headers(),
            )
        return self._client

    def _get_default_headers(self) -> dict[str, str]:
        """Get default headers for requests. Override in subclasses."""
        return {
            "Accept": "application/json",
            "User-Agent": "Ghostarr/1.0",
        }

    async def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Make HTTP request with retry logic."""
        client = await self._get_client()
        last_error: Exception | None = None

        for attempt in range(self.MAX_RETRIES):
            try:
                start_time = time.time()
                response = await client.request(
                    method=method,
                    url=path,
                    params=params,
                    json=json,
                    **kwargs,
                )
                elapsed_ms = int((time.time() - start_time) * 1000)

                logger.debug(
                    f"{self.SERVICE_NAME} {method} {path} -> {response.status_code} ({elapsed_ms}ms)"
                )

                response.raise_for_status()
                return response.json() if response.content else {}

            except httpx.HTTPStatusError as e:
                last_error = e
                logger.warning(
                    f"{self.SERVICE_NAME} HTTP error {e.response.status_code}: {e.response.text}"
                )
                # Don't retry client errors (4xx)
                if 400 <= e.response.status_code < 500:
                    break

            except httpx.RequestError as e:
                last_error = e
                logger.warning(f"{self.SERVICE_NAME} request error: {e}")

            # Exponential backoff
            if attempt < self.MAX_RETRIES - 1:
                delay = self.RETRY_DELAY * (2**attempt)
                logger.debug(f"Retrying in {delay}s (attempt {attempt + 2}/{self.MAX_RETRIES})")
                await self._sleep(delay)

        raise IntegrationError(
            service=self.SERVICE_NAME,
            message=str(last_error) if last_error else "Request failed",
        )

    async def _sleep(self, seconds: float) -> None:
        """Sleep for given seconds (overridable for testing)."""
        import asyncio

        await asyncio.sleep(seconds)

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def fetch_image_as_base64(self, image_url: str) -> str | None:
        """Fetch an image and return it as a base64 data URL.

        Args:
            image_url: Full URL to the image

        Returns:
            Base64 data URL (e.g., data:image/jpeg;base64,...) or None if failed
        """
        import base64

        if not image_url:
            return None

        try:
            client = await self._get_client()
            # Override Accept header for image requests
            headers = {
                "Accept": "image/webp,image/png,image/jpeg,image/*,*/*",
            }
            response = await client.get(image_url, headers=headers)
            response.raise_for_status()

            # Determine content type
            content_type = response.headers.get("content-type", "image/jpeg")
            if ";" in content_type:
                content_type = content_type.split(";")[0].strip()

            # Encode to base64
            image_data = base64.b64encode(response.content).decode("utf-8")
            return f"data:{content_type};base64,{image_data}"

        except Exception as e:
            logger.warning(f"Failed to fetch image {image_url}: {e}")
            return None

    @abstractmethod
    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to the service.

        Returns:
            Tuple of (success, message, response_time_ms)
        """
        pass

    @abstractmethod
    async def fetch_data(self, **kwargs: Any) -> list[T]:
        """Fetch data from the service.

        Returns:
            List of items from the service
        """
        pass
