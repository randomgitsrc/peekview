"""File download and content API routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlmodel import Session, select

from peekview.auth import get_current_user
from peekview.database import get_engine
from peekview.exceptions import NotFoundError
from peekview.language import detect_language
from peekview.models import API_KEY_PREFIX, Entry, EntryRawResponse, File, RawFileItem, User
from peekview.services.entry_service import EntryService, get_entry_service
from peekview.services.html_render_service import (
    SiblingFileData,
    inject_resources,
    parse_inject_ids,
)
from peekview.storage import StorageManager

RENDER_CSP = (
    "default-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; "
    "script-src 'unsafe-inline' 'unsafe-eval' blob: data: https:; "
    "style-src 'unsafe-inline' blob: data: https:; "
    "img-src blob: data: https:; "
    "media-src blob: data: https:; "
    "font-src blob: data: https:; "
    "connect-src blob: data: https:; "
    "worker-src blob:; "
    "frame-src 'none'; "
    "frame-ancestors 'self'; "
    "form-action 'none';"
)

_BINARY_SIZE_LIMIT = 768 * 1024

_LANGUAGE_TO_MIME = {
    "css": "text/css",
    "javascript": "text/javascript",
    "json": "application/json",
    "html": "text/html",
    "xml": "text/xml",
    "yaml": "text/yaml",
    "text": "text/plain",
    "markdown": "text/markdown",
}

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


def _build_sibling_data(file_record: File, storage: StorageManager) -> SiblingFileData | None:
    """Read a sibling file and build SiblingFileData; None if skipped (oversized binary)."""
    if file_record.is_binary and file_record.size > _BINARY_SIZE_LIMIT:
        return None
    actual_path = file_record.path or file_record.filename
    raw = storage.read_file(file_record.entry_id, actual_path, file_record.path)
    if file_record.is_binary:
        import base64
        import mimetypes

        mime = file_record.language and _LANGUAGE_TO_MIME.get(file_record.language)
        if not mime:
            mime, _ = mimetypes.guess_type(actual_path)
        if not mime:
            mime = "application/octet-stream"
        return SiblingFileData(
            filename=actual_path,
            path=file_record.path,
            content=base64.b64encode(raw).decode("ascii"),
            language=file_record.language,
            is_binary=True,
            mime_type=mime,
        )
    return SiblingFileData(
        filename=actual_path,
        path=file_record.path,
        content=raw.decode("utf-8", errors="replace"),
        language=file_record.language,
        is_binary=False,
        mime_type=None,
    )


@router.get("/{slug}/files/{file_id}/render")
async def render_html_file(
    slug: str,
    file_id: int,
    request: Request,
    inject: str | None = Query(None),
    current_user: User | None = Depends(get_current_user),
):
    """Render an HTML file with optional sibling resource injection.

    Returns the HTML with a permissive-but-bounded CSP allowing inline
    scripts/styles and https/blob/data resources, plus `frame-ancestors 'self'`
    so the result can be embedded in a same-origin iframe.
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

        detected = file_record.language or detect_language(file_record.path or file_record.filename)
        if detected != "html":
            raise NotFoundError("Render endpoint only available for HTML files")

        inject_ids = parse_inject_ids(inject, file_id)

        siblings: list[SiblingFileData] = []
        if inject_ids:
            sibling_records = session.exec(
                select(File).where(
                    File.id.in_(inject_ids),
                    File.entry_id == entry_id,
                )
            ).all()
            for f in sibling_records:
                data = _build_sibling_data(f, storage)
                if data is not None:
                    siblings.append(data)

    html_bytes = storage.read_file(entry_id, file_record.filename, file_record.path)
    html = html_bytes.decode("utf-8", errors="replace")

    if siblings:
        html = inject_resources(html, siblings)

    return Response(
        content=html.encode("utf-8"),
        media_type="text/html; charset=utf-8",
        headers={
            "Content-Security-Policy": RENDER_CSP,
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Referrer-Policy": "no-referrer",
        },
    )


@router.get("/{slug}/raw", response_class=Response)
async def get_entry_raw(
    slug: str,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Get entry raw content as structured JSON.

    Returns all file contents in a single response.
    Text files: content field contains UTF-8 string.
    Binary files: content=null, file_url points to /files/{id}/content.

    Public entries require no auth. Private entries require API Key.
    """
    import json as _json

    config = request.app.state.config
    engine = get_engine(config)
    storage = StorageManager(config=config)
    service = _get_service(request)

    # Auth + visibility — reuse existing logic (returns 404 for private/missing)
    global_key_auth = _is_global_api_key_auth(request, current_user)
    if global_key_auth:
        with Session(engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")
            entry_id = entry.id
            entry_slug = entry.slug
            entry_summary = entry.summary
            entry_tags = entry.tags or []
            entry_created_at = entry.created_at
    else:
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False
        entry_resp = service.get_entry(slug, current_user_id=current_user_id, is_admin=is_admin)
        entry_id = entry_resp.id
        entry_slug = entry_resp.slug
        entry_summary = entry_resp.summary
        entry_tags = entry_resp.tags
        entry_created_at = entry_resp.created_at

    # Build base URL for file_url and raw_url
    base = str(request.base_url).rstrip("/")
    raw_url = f"{base}/api/v1/entries/{entry_slug}/raw"

    # Read all files
    with Session(engine) as session:
        db_files = session.exec(
            select(File).where(File.entry_id == entry_id)
        ).all()

    raw_files: list[RawFileItem] = []
    for f in db_files:
        if f.is_binary:
            raw_files.append(RawFileItem(
                id=f.id,
                filename=f.filename,
                path=f.path,
                language=f.language,
                is_binary=True,
                size=f.size,
                content=None,
                content_encoding=None,
                file_url=f"{base}/api/v1/entries/{entry_slug}/files/{f.id}/content",
            ))
        else:
            raw_bytes = storage.read_file(entry_id, f.filename, f.path)
            # Decode with replace to avoid crashing on edge-case byte sequences
            content_str = raw_bytes.decode("utf-8", errors="replace")
            raw_files.append(RawFileItem(
                id=f.id,
                filename=f.filename,
                path=f.path,
                language=f.language,
                is_binary=False,
                size=f.size,
                content=content_str,
                content_encoding="utf-8",
                file_url=None,
            ))

    result = EntryRawResponse(
        slug=entry_slug,
        summary=entry_summary,
        tags=entry_tags,
        created_at=entry_created_at,
        files=raw_files,
        raw_url=raw_url,
    )

    # Serialize with </script> defense to prevent XSS if response is ever embedded in HTML
    serialized = _json.dumps(
        result.model_dump(mode="json"),
        ensure_ascii=False,
        default=str,
    ).replace("</", "<\\/")

    return Response(
        content=serialized,
        media_type="application/json; charset=utf-8",
    )
