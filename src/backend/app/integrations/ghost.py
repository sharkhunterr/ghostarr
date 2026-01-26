"""Ghost CMS integration for newsletter publishing."""

import json
import time
from typing import Any

import jwt
from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

logger = get_logger(__name__)


class GhostNewsletter(BaseModel):
    """Newsletter/tier from Ghost."""

    id: str
    name: str
    slug: str
    description: str | None = None
    status: str = "active"


class GhostPost(BaseModel):
    """Post created in Ghost."""

    id: str
    uuid: str
    title: str
    slug: str
    url: str
    status: str  # draft, published, scheduled
    created_at: str
    updated_at: str
    published_at: str | None = None


class GhostIntegration(BaseIntegration[GhostNewsletter]):
    """Integration with Ghost CMS for newsletter publishing."""

    SERVICE_NAME = "Ghost"
    TOKEN_EXPIRY = 300  # 5 minutes

    def __init__(self, url: str = "", api_key: str = ""):
        """Initialize Ghost integration."""
        super().__init__(url=url, api_key=api_key)
        self._jwt_token: str | None = None
        self._token_expires: float = 0

    def _generate_jwt(self) -> str:
        """Generate JWT for Ghost Admin API authentication."""
        if not self.api_key or ":" not in self.api_key:
            raise ValueError("Invalid Ghost Admin API key format. Expected 'id:secret'")

        key_id, secret = self.api_key.split(":")
        secret_bytes = bytes.fromhex(secret)

        now = int(time.time())
        payload = {
            "iat": now,
            "exp": now + self.TOKEN_EXPIRY,
            "aud": "/admin/",
        }

        return jwt.encode(
            payload,
            secret_bytes,
            algorithm="HS256",
            headers={"alg": "HS256", "typ": "JWT", "kid": key_id},
        )

    def _get_auth_token(self) -> str:
        """Get or refresh JWT token."""
        now = time.time()
        if not self._jwt_token or now >= self._token_expires:
            self._jwt_token = self._generate_jwt()
            self._token_expires = now + self.TOKEN_EXPIRY - 60  # Refresh 1 min early
        return self._jwt_token

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Ghost {self._get_auth_token()}",
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
        """Override to refresh auth header on each request."""
        # Update authorization header
        client = await self._get_client()
        client.headers["Authorization"] = f"Ghost {self._get_auth_token()}"
        return await super()._request(method, path, params, json, **kwargs)

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Ghost."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/ghost/api/admin/site/")
            elapsed_ms = int((time.time() - start) * 1000)

            site = response.get("site", {})
            title = site.get("title", "Unknown")
            return True, f"Connected to {title}", elapsed_ms

        except Exception as e:
            logger.error(f"Ghost connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(self, **kwargs: Any) -> list[GhostNewsletter]:
        """Fetch newsletters/tiers from Ghost."""
        return await self.get_newsletters()

    async def get_newsletters(self) -> list[GhostNewsletter]:
        """Get available newsletters from Ghost."""
        if not self.is_configured:
            return []

        try:
            response = await self._request("GET", "/ghost/api/admin/newsletters/")
            newsletters = response.get("newsletters", [])

            return [
                GhostNewsletter(
                    id=n["id"],
                    name=n["name"],
                    slug=n["slug"],
                    description=n.get("description"),
                    status=n.get("status", "active"),
                )
                for n in newsletters
                if n.get("status") == "active"
            ]

        except Exception as e:
            logger.error(f"Failed to fetch Ghost newsletters: {e}")
            return []

    def _html_to_mobiledoc(self, html: str) -> str:
        """Convert HTML to Ghost MobileDoc format.

        Ghost uses MobileDoc as its internal format. We wrap the entire HTML
        in a single HTML card within the MobileDoc structure.
        """
        mobiledoc = {
            "version": "0.3.1",
            "atoms": [],
            "cards": [["html", {"html": html}]],
            "markups": [],
            "sections": [
                [1, "p", [[0, [], 0, ""]]],
                [10, 0],
            ],
        }
        return json.dumps(mobiledoc)

    async def create_post(
        self,
        title: str,
        html: str,
        status: str = "draft",
        newsletter_id: str | None = None,
        send_email: bool = False,
    ) -> GhostPost | None:
        """Create a new post in Ghost."""
        if not self.is_configured:
            return None

        try:
            # Convert HTML to MobileDoc format (Ghost's internal format)
            mobiledoc = self._html_to_mobiledoc(html)

            post_data: dict[str, Any] = {
                "title": title,
                "mobiledoc": mobiledoc,
                "status": status,
            }

            # Add newsletter settings for email
            if newsletter_id and send_email:
                post_data["newsletter_id"] = newsletter_id
                post_data["email_segment"] = "all"

            logger.info(f"Creating Ghost post with data: title={post_data.get('title')}, status={post_data.get('status')}, mobiledoc_length={len(mobiledoc)}")
            logger.debug(f"Post data keys: {list(post_data.keys())}")

            response = await self._request(
                "POST",
                "/ghost/api/admin/posts/",
                json={"posts": [post_data]},
            )

            logger.info("Ghost response: post created successfully")

            posts = response.get("posts", [])
            if posts:
                p = posts[0]
                return GhostPost(
                    id=p["id"],
                    uuid=p["uuid"],
                    title=p["title"],
                    slug=p["slug"],
                    url=p["url"],
                    status=p["status"],
                    created_at=p["created_at"],
                    updated_at=p["updated_at"],
                    published_at=p.get("published_at"),
                )

        except Exception as e:
            logger.error(f"Failed to create Ghost post: {e}")

        return None

    async def update_post(
        self,
        post_id: str,
        title: str | None = None,
        html: str | None = None,
        status: str | None = None,
    ) -> GhostPost | None:
        """Update an existing post in Ghost."""
        if not self.is_configured:
            return None

        try:
            # First get current post to get updated_at
            response = await self._request("GET", f"/ghost/api/admin/posts/{post_id}/")
            current_post = response.get("posts", [{}])[0]

            update_data: dict[str, Any] = {
                "updated_at": current_post["updated_at"],
            }

            if title:
                update_data["title"] = title
            if html:
                update_data["html"] = html
            if status:
                update_data["status"] = status

            response = await self._request(
                "PUT",
                f"/ghost/api/admin/posts/{post_id}/",
                json={"posts": [update_data]},
            )

            posts = response.get("posts", [])
            if posts:
                p = posts[0]
                return GhostPost(
                    id=p["id"],
                    uuid=p["uuid"],
                    title=p["title"],
                    slug=p["slug"],
                    url=p["url"],
                    status=p["status"],
                    created_at=p["created_at"],
                    updated_at=p["updated_at"],
                    published_at=p.get("published_at"),
                )

        except Exception as e:
            logger.error(f"Failed to update Ghost post: {e}")

        return None

    async def delete_post(self, post_id: str) -> bool:
        """Delete a post from Ghost."""
        if not self.is_configured:
            return False

        try:
            await self._request("DELETE", f"/ghost/api/admin/posts/{post_id}/")
            return True

        except Exception as e:
            logger.error(f"Failed to delete Ghost post: {e}")
            return False


# Global instance
ghost_client = GhostIntegration()
