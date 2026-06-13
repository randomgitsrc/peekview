"""File download and content API routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlmodel import Session, select

from peekview.auth import get_current_user
from peekview.database import get_engine
from peekview.exceptions import NotFoundError
from peekview.models import API_KEY_PREFIX, Entry, File, User
from peekview.services.entry_service import EntryService, get_entry_service
from peekview.storage import StorageManager

router = APIRouter(prefix="/api/v1/entries", tags=["files"])


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename for Content-Disposition header to prevent injection.

    Removes quotes, semicolons, and newlines that could break the header.
    """
    sanitized = re.sub(r'[";\r\n]', "", filename)
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    return sanitized


def _language_to_content_type(language: str | None) -> str:
    """Map language ID to Content-Type for inline display."""
    _TYPE_MAP = {
        "python": "text/x-python",
        "javascript": "text/javascript",
        "typescript": "text/typescript",
        "html": "text/html",
        "css": "text/css",
        "json": "application/json",
        "yaml": "text/yaml",
        "xml": "text/xml",
        "markdown": "text/markdown",
        "sql": "text/x-sql",
        "bash": "text/x-shellscript",
        "go": "text/x-go",
        "rust": "text/x-rust",
        "java": "text/x-java",
        "cpp": "text/x-c++src",
        "text": "text/plain",
    }
    if language and language in _TYPE_MAP:
        return _TYPE_MAP[language]
    return "text/plain; charset=utf-8"


def _looks_like_jwt(token: str) -> bool:
    """Heuristic: JWTs have 3 base64url-encoded segments separated by dots."""
    return len(token.split(".")) == 3


def _is_global_api_key_auth(request: Request, current_user: User | None) -> bool:
    """Check if request is authenticated via global master API key (no user binding).

    Only returns True for global master key — it bypasses ownership checks.
    User-level API keys (pv_ prefix) have current_user set, treated like JWT.
    """
    if current_user is not None:
        return False

    x_key = request.headers.get("X-API-Key", "")
    if x_key and not x_key.startswith(API_KEY_PREFIX):
        return True

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if not _looks_like_jwt(token) and not token.startswith(API_KEY_PREFIX):
            return True

    return False


def _get_service(request: Request) -> EntryService:
    """Get EntryService from app state."""
    return get_entry_service(request.app)


def _resolve_entry(request: Request, slug: str, current_user: User | None) -> int:
    """Resolve entry with visibility check via EntryService.

    Returns the entry ID on success. Raises NotFoundError if entry
    not found or not visible to the current user.

    Uses EntryService.get_entry() for non-global-API-key requests,
    which centralizes visibility logic (owner, admin, public).
    For global API key auth, fetches entry directly (bypasses visibility).
    """
    config = request.app.state.config
    engine = get_engine(config)
    service = _get_service(request)
    global_key_auth = _is_global_api_key_auth(request, current_user)

    if global_key_auth:
        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")
            return entry.id
    else:
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False
        entry_response = service.get_entry(
            slug, current_user_id=current_user_id, is_admin=is_admin
        )
        return entry_response.id


@router.get("/{slug}/files/{file_id}")
async def download_file(
    slug: str,
    file_id: int,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Download a single file (with Content-Disposition: attachment)."""
    config = request.app.state.config
    engine = get_engine(config)
    storage = StorageManager(config=config)

    entry_id = _resolve_entry(request, slug, current_user)

    with Session(engine) as session:
        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry_id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

        content = storage.read_file(entry_id, file_record.filename, file_record.path)
        safe_name = _sanitize_filename(file_record.filename)
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
        )


@router.get("/{slug}/files/{file_id}/content")
async def get_file_content(
    slug: str,
    file_id: int,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Get file content inline (raw text, no Content-Disposition).

    Returns the file content with an appropriate Content-Type based on
    language. No Content-Disposition header — suitable for inline display.
    """
    config = request.app.state.config
    engine = get_engine(config)
    storage = StorageManager(config=config)

    entry_id = _resolve_entry(request, slug, current_user)

    with Session(engine) as session:
        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry_id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

    content = storage.read_file(entry_id, file_record.filename, file_record.path)

    content_type = _language_to_content_type(file_record.language)
    return Response(
        content=content,
        media_type=content_type,
    )
