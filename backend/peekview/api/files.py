"""File download and content API routes."""

from __future__ import annotations

import asyncio
import logging
import mimetypes
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlmodel import Session, select

from peekview.api._shared import (
    _detect_channel,
    _is_global_api_key_auth,
    _record_read_async,
)
from peekview.auth import get_current_user
from peekview.exceptions import NotFoundError
from peekview.language import detect_language
from peekview.models import Entry, EntryRawResponse, File, RawFileItem, Team, TeamRef, User
from peekview.services.html_render_service import (
    SiblingFileData,
    inject_resources,
    parse_inject_ids,
)
from peekview.storage import StorageManager

logger = logging.getLogger(__name__)


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


def _build_content_disposition(filename: str) -> str:
    safe = _sanitize_filename(filename)
    if safe.isascii():
        return f'attachment; filename="{safe}"'
    fallback = "".join(c if ord(c) < 128 else "_" for c in safe)
    encoded = quote(safe, safe="")
    return f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{encoded}'


def _language_to_content_type(language: str | None) -> str:
    """Map language ID to Content-Type for inline display."""
    _TYPE_MAP = {  # noqa: N806
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


def _determine_content_type(file_record: File) -> str:
    """Determine Content-Type for /content endpoint.

    Text files: use _language_to_content_type (existing behavior).
    Binary files or language-less files: three-level fallback.
    """
    if file_record.language and not file_record.is_binary:
        return _language_to_content_type(file_record.language)

    if file_record.language:
        mime = _LANGUAGE_TO_MIME.get(file_record.language)
        if mime:
            return mime

    actual_path = file_record.path or file_record.filename
    guessed, _ = mimetypes.guess_type(actual_path)
    if guessed:
        return guessed

    return "application/octet-stream"


def _resolve_entry(request: Request, slug: str, current_user: User | None) -> int:
    """Resolve entry with visibility check via EntryService.

    Returns the entry ID on success. Raises NotFoundError if entry
    not found or not visible to the current user.

    Uses EntryService.get_entry() for non-global-API-key requests,
    which centralizes visibility logic (owner, admin, public).
    For global API key auth, fetches entry directly (bypasses visibility).
    Also checks share cookie for sub-resource access when user is
    not the owner/admin.
    """
    service = request.app.state.entry_service
    global_key_auth = _is_global_api_key_auth(request, current_user)

    if global_key_auth:
        entry = service.get_entry_by_slug(slug)
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")
        return entry.id
    else:
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False

        # First try normal access (public entry, owner, admin)
        try:
            entry_response = service.get_entry(
                slug, current_user_id=current_user_id, is_admin=is_admin
            )
            return entry_response.id
        except NotFoundError:
            pass

        # Check share cookie for sub-resource access
        entry = service.get_entry_by_slug(slug)
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

        cookie_name = f"peekview_share_{slug}"
        cookie_value = request.cookies.get(cookie_name)
        if cookie_value:
            from peekview.api.entries import _share_cookie_allowed_for_user

            share_service = request.app.state.share_service
            share = share_service.verify_share_cookie(entry.id, cookie_value)
            # Anti-enumeration (BDD-2): deny team entries to logged-in
            # non-privileged users through the cookie channel as well.
            if share and _share_cookie_allowed_for_user(request, entry, current_user):
                return entry.id

        raise NotFoundError(f"Entry not found: {slug}")


@router.get("/{slug}/files/{file_id}")
async def download_file(
    slug: str,
    file_id: int,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Download a single file (with Content-Disposition: attachment)."""
    service = request.app.state.entry_service

    entry_id = _resolve_entry(request, slug, current_user)

    file_record = service.get_file_record(entry_id, file_id)
    if not file_record:
        raise NotFoundError(f"File not found: {file_id}")

    content = service.read_file_content(entry_id, file_record.filename, file_record.path)

    entry_record = service.get_entry_record(entry_id)
    channel = _detect_channel(request, slug=slug)
    current_user_id_dl = current_user.id if current_user else None
    asyncio.create_task(
        _record_read_async(
            request.app.state,
            entry_id=entry_id,
            entry_owner_id=entry_record.owner_id if entry_record else None,
            action="download",
            channel=channel,
            reader_id=current_user_id_dl,
            reader_ip=request.client.host if request.client else None,
            request=request,
        )
    )

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": _build_content_disposition(file_record.filename)},
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
    service = request.app.state.entry_service

    entry_id = _resolve_entry(request, slug, current_user)

    file_record = service.get_file_record(entry_id, file_id)
    if not file_record:
        raise NotFoundError(f"File not found: {file_id}")

    content = service.read_file_content(entry_id, file_record.filename, file_record.path)

    entry_record = service.get_entry_record(entry_id)
    channel = _detect_channel(request, slug=slug)
    current_user_id_fc = current_user.id if current_user else None
    asyncio.create_task(
        _record_read_async(
            request.app.state,
            entry_id=entry_id,
            entry_owner_id=entry_record.owner_id if entry_record else None,
            action="read",
            channel=channel,
            reader_id=current_user_id_fc,
            reader_ip=request.client.host if request.client else None,
            request=request,
        )
    )

    content_type = _determine_content_type(file_record)
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
    service = request.app.state.entry_service
    storage = service.storage

    entry_id = _resolve_entry(request, slug, current_user)

    file_record = service.get_file_record(entry_id, file_id)
    if not file_record:
        raise NotFoundError(f"File not found: {file_id}")

    detected = file_record.language or detect_language(file_record.path or file_record.filename)
    if detected != "html":
        raise NotFoundError("Render endpoint only available for HTML files")

    inject_ids = parse_inject_ids(inject, file_id)

    siblings: list[SiblingFileData] = []
    if inject_ids:
        sibling_records = service.get_files_by_ids(entry_id, inject_ids)
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


async def resolve_entry_raw(
    request: Request, slug: str, share: str | None = None, purify: bool = False
) -> Response:
    import json as _json

    service = request.app.state.entry_service
    storage = service.storage
    current_user = get_current_user(request)

    entry_owner_id: int | None = None
    if share:
        from peekview.services.share_service import ShareService

        share_service: ShareService = request.app.state.share_service
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False

        with Session(request.app.state.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            from peekview.services.team_membership import (
                team_membership_exists,
                team_owner_exists,
            )

            is_team_member = (
                team_membership_exists(session, current_user_id, entry.team_id)
                if entry.team_id is not None and current_user_id is not None
                else False
            )
            is_team_owner = (
                team_owner_exists(session, current_user_id, entry.team_id)
                if entry.team_id is not None and current_user_id is not None
                else False
            )
            if entry.is_public or (
                current_user_id is not None
                and (
                    is_admin
                    or entry.owner_id == current_user_id
                    or is_team_member
                    or is_team_owner
                )
            ):
                entry_resp = service.get_entry(
                    slug,
                    current_user_id=current_user_id,
                    is_admin=is_admin,
                    include_read_stats=(
                        current_user_id is not None
                        and (is_admin or entry.owner_id == current_user_id)
                    ),
                )
                entry_team_ref = entry_resp.team
            else:
                # Anti-enumeration: a logged-in non-member probing a team entry
                # via a share param must not receive content (BDD-2).
                if entry.team_id is not None and current_user_id is not None:
                    raise NotFoundError(f"Entry not found: {slug}")
                result = service.get_entry_with_share(slug, share, share_service)
                if result is None:
                    raise NotFoundError(f"Entry not found: {slug}")
                entry_resp, _entry_share = result
                entry_team_ref = None

        entry_id = entry_resp.id
        entry_slug = entry_resp.slug
        entry_summary = entry_resp.summary
        entry_tags = entry_resp.tags
        entry_created_at = entry_resp.created_at
        entry_owner_id = entry_resp.owner_id
    else:
        global_key_auth = _is_global_api_key_auth(request, current_user)
        if global_key_auth:
            entry_record = service.get_entry_by_slug(slug)
            if not entry_record:
                raise NotFoundError(f"Entry not found: {slug}")
            entry_id = entry_record.id
            entry_slug = entry_record.slug
            entry_summary = entry_record.summary
            entry_tags = entry_record.tags or []
            entry_created_at = entry_record.created_at
            entry_owner_id = entry_record.owner_id
            entry_team_ref = None
            if entry_record.team_id is not None:
                with Session(request.app.state.engine) as session:
                    team_row = session.get(Team, entry_record.team_id)
                if team_row is not None:
                    entry_team_ref = TeamRef(slug=team_row.slug, name=team_row.name)
        else:
            current_user_id = current_user.id if current_user else None
            is_admin = current_user.is_admin if current_user else False
            try:
                entry_resp = service.get_entry(
                    slug, current_user_id=current_user_id, is_admin=is_admin
                )
            except NotFoundError:
                from peekview.api.entries import _check_share_cookie

                cookie_result = _check_share_cookie(request, slug, service, current_user)
                if cookie_result is None:
                    raise
                entry_resp = cookie_result
            entry_id = entry_resp.id
            entry_slug = entry_resp.slug
            entry_summary = entry_resp.summary
            entry_tags = entry_resp.tags
            entry_created_at = entry_resp.created_at
            entry_owner_id = entry_resp.owner_id
            # Cookie share access has team nulled in _check_share_cookie.
            entry_team_ref = entry_resp.team

    base = str(request.base_url).rstrip("/")
    raw_url = f"{base}/api/v1/entries/{entry_slug}/raw"

    db_files = service.get_entry_files(entry_id)

    raw_files: list[RawFileItem] = []
    for f in db_files:
        if f.is_binary:
            raw_files.append(
                RawFileItem(
                    id=f.id,
                    filename=f.filename,
                    path=f.path,
                    language=f.language,
                    is_binary=True,
                    size=f.size,
                    content=None,
                    content_encoding=None,
                    file_url=f"{base}/api/v1/entries/{entry_slug}/files/{f.id}/content",
                )
            )
        else:
            raw_bytes = storage.read_file(entry_id, f.filename, f.path)
            content_str = raw_bytes.decode("utf-8", errors="replace")
            raw_files.append(
                RawFileItem(
                    id=f.id,
                    filename=f.filename,
                    path=f.path,
                    language=f.language,
                    is_binary=False,
                    size=f.size,
                    content=content_str,
                    content_encoding="utf-8",
                    file_url=None,
                )
            )

    if purify:
        from peekview.services.purify import purify_content

        for item in raw_files:
            if not item.is_binary and item.content is not None:
                item.content = purify_content(item.content)

    result = EntryRawResponse(
        slug=entry_slug,
        summary=entry_summary,
        tags=entry_tags,
        created_at=entry_created_at,
        files=raw_files,
        raw_url=raw_url,
        team=entry_team_ref,
    )

    serialized = _json.dumps(
        result.model_dump(mode="json"),
        ensure_ascii=False,
        default=str,
    ).replace("</", "<\\/")

    current_user_id_raw = current_user.id if current_user else None
    channel = _detect_channel(request, slug=entry_slug)
    reader_ip = request.client.host if request.client else None
    asyncio.create_task(
        _record_read_async(
            request.app.state,
            entry_id=entry_id,
            entry_owner_id=entry_owner_id,
            action="raw",
            channel=channel,
            reader_id=current_user_id_raw,
            reader_ip=reader_ip,
            request=request,
        )
    )

    return Response(
        content=serialized,
        media_type="application/json; charset=utf-8",
    )


@router.get("/{slug}/raw", response_class=Response)
async def get_entry_raw(
    slug: str,
    request: Request,
    share: str | None = Query(None, max_length=64),
    purify: bool | None = Query(None),
    current_user: User | None = Depends(get_current_user),
):
    return await resolve_entry_raw(request, slug, share=share, purify=bool(purify))
