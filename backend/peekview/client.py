"""HTTP client for remote PeekView server.

Provides PeekClient class for CLI to operate in remote mode,
calling HTTP API instead of local SQLite database.
"""

from __future__ import annotations

from collections import namedtuple
from datetime import datetime
from typing import Any

import requests

from peekview.exceptions import NotFoundError, PeekError

RemoteEntry = namedtuple(
    "RemoteEntry",
    ["id", "slug", "url", "summary", "status", "tags", "files", "expires_at", "created_at", "updated_at"]
)

RemoteFile = namedtuple(
    "RemoteFile",
    ["id", "path", "filename", "language", "is_binary", "size", "line_count"]
)


class PeekClient:
    """HTTP client for remote PeekView server.

    Mirrors EntryService interface, returns RemoteEntry/RemoteFile
    namedtuples for attribute-compatible access with SQLModel objects.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str = "",
        token: str = "",
        timeout: int = 30,
        verify_ssl: bool = True
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.verify = verify_ssl
        self.headers: dict[str, str] = {}
        # JWT token takes priority over API Key
        if token:
            self.headers["Authorization"] = f"Bearer {token}"
        elif api_key:
            self.headers["X-API-Key"] = api_key
            # Backward compat: also send as Bearer for older servers
            self.headers["Authorization"] = f"Bearer {api_key}"

    def _parse_entry(self, data: dict[str, Any]) -> RemoteEntry:
        """Convert API JSON dict to RemoteEntry."""
        # Validate required fields
        slug = data.get("slug", "")
        if not slug:
            raise PeekError("Invalid API response: missing 'slug' field")

        # Parse files
        files = [
            RemoteFile(
                id=f.get("id"),
                path=f.get("path"),
                filename=f.get("filename", ""),
                language=f.get("language"),
                is_binary=f.get("is_binary", False),
                size=f.get("size", 0),
                line_count=f.get("line_count"),
            )
            for f in data.get("files", [])
        ]

        # Parse datetime fields
        def _parse_dt(key: str) -> datetime | None:
            v = data.get(key)
            return datetime.fromisoformat(v) if v else None

        # Build URL: prefer server-returned, fallback to client construction
        url = data.get("url") or f"{self.base_url}/{slug}"

        return RemoteEntry(
            id=data.get("id"),
            slug=slug,
            url=url,
            summary=data.get("summary", ""),
            status=data.get("status", "active"),
            tags=data.get("tags", []),
            files=files,
            expires_at=_parse_dt("expires_at"),
            created_at=_parse_dt("created_at"),
            updated_at=_parse_dt("updated_at"),
        )

    def _handle_error(self, resp: requests.Response) -> None:
        """Handle HTTP error responses with friendly messages."""
        status_map = {
            400: "Bad request",
            401: "Authentication failed: check remote.api_key",
            403: "Permission denied",
            404: "Entry not found",
            409: "Entry already exists",
            413: "File too large",
            422: "Validation failed",
            429: "Rate limited: please retry later",
        }

        if resp.status_code == 404:
            raise NotFoundError("Entry not found")

        message = status_map.get(resp.status_code, f"Server error ({resp.status_code})")

        # Try to get detailed error from response
        try:
            error_data = resp.json()
            if isinstance(error_data, dict) and "error" in error_data:
                detail = error_data["error"].get("message", "")
                if detail:
                    message = f"{message}: {detail}"
        except Exception:
            pass

        raise PeekError(message)

    def create_entry(
        self,
        summary: str,
        slug: str | None = None,
        tags: list[str] | None = None,
        files_data: list[dict[str, Any]] | None = None,
        dirs_data: list[dict[str, str]] | None = None,
        expires_in: str | None = None,
        is_public: bool = True,
    ) -> RemoteEntry:
        """POST /api/v1/entries — Create a new entry."""
        payload: dict[str, Any] = {
            "summary": summary,
            "slug": slug,
            "tags": tags or [],
            "is_public": is_public,
            "files": files_data or [],
            "dirs": dirs_data or [],
            "expires_in": expires_in,
        }

        resp = requests.post(
            f"{self.base_url}/api/v1/entries",
            json=payload,
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 201:
            self._handle_error(resp)

        return self._parse_entry(resp.json())

    def list_entries(
        self,
        q: str | None = None,
        tags: list[str] | None = None,
        status: str | None = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict[str, Any]:
        """GET /api/v1/entries — List entries with pagination.

        Returns dict with items, total, page, per_page.
        """
        params: dict[str, Any] = {
            "page": page,
            "per_page": per_page,
        }
        if q:
            params["q"] = q
        if tags:
            params["tags"] = ",".join(tags)
        if status:
            params["status"] = status

        resp = requests.get(
            f"{self.base_url}/api/v1/entries",
            params=params,
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return resp.json()

    def get_entry(self, slug: str) -> RemoteEntry:
        """GET /api/v1/entries/{slug} — Get entry details."""
        resp = requests.get(
            f"{self.base_url}/api/v1/entries/{slug}",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return self._parse_entry(resp.json())

    def delete_entry(self, slug: str) -> dict[str, bool]:
        """DELETE /api/v1/entries/{slug} — Delete an entry."""
        resp = requests.delete(
            f"{self.base_url}/api/v1/entries/{slug}",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code not in (200, 204):
            self._handle_error(resp)

        return {"ok": True}

    def login(self, username: str, password: str) -> dict[str, Any]:
        """POST /api/v1/auth/login — Login and get JWT token."""
        resp = requests.post(
            f"{self.base_url}/api/v1/auth/login",
            json={"username": username, "password": password},
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return resp.json()

    # --- API Key management (remote only) ---

    def create_api_key(self, name: str, expires_in: str | None = None) -> dict[str, Any]:
        """POST /api/v1/apikeys — Create a new API key."""
        payload: dict[str, Any] = {"name": name}
        if expires_in:
            payload["expires_in"] = expires_in

        resp = requests.post(
            f"{self.base_url}/api/v1/apikeys",
            json=payload,
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 201:
            self._handle_error(resp)

        return resp.json()

    def list_api_keys(self) -> dict[str, Any]:
        """GET /api/v1/apikeys — List API keys."""
        resp = requests.get(
            f"{self.base_url}/api/v1/apikeys",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return resp.json()

    def revoke_api_key(self, key_id: int) -> dict[str, Any]:
        """DELETE /api/v1/apikeys/{key_id} — Revoke an API key."""
        resp = requests.delete(
            f"{self.base_url}/api/v1/apikeys/{key_id}",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return resp.json()

    def cleanup_expired_keys(self) -> dict[str, Any]:
        """DELETE /api/v1/apikeys/expired — Cleanup expired API keys."""
        resp = requests.delete(
            f"{self.base_url}/api/v1/apikeys/expired",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return resp.json()

    def admin_stats(self) -> dict[str, Any]:
        """GET /api/v1/admin/stats — Get system statistics."""
        resp = requests.get(
            f"{self.base_url}/api/v1/admin/stats",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return resp.json()

    def admin_cleanup(self) -> dict[str, Any]:
        """POST /api/v1/admin/cleanup — Cleanup expired entries."""
        resp = requests.post(
            f"{self.base_url}/api/v1/admin/cleanup",
            headers=self.headers,
            timeout=self.timeout,
            verify=self.verify,
        )

        if resp.status_code != 200:
            self._handle_error(resp)

        return resp.json()
