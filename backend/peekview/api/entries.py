"""Entry CRUD API routes."""

from __future__ import annotations

import io
import zipfile

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from peekview.auth import get_current_user
from peekview.api.files import _sanitize_filename
from peekview.exceptions import AuthenticationError, NotFoundError
from peekview.models import API_KEY_PREFIX, CreateEntryRequest, Entry, EntryShareContext, EntryUpdate, User
from peekview.services.entry_service import EntryService, get_entry_service
from sqlmodel import Session, select

router = APIRouter(prefix="/api/v1/entries", tags=["entries"])


def _get_service(request: Request) -> EntryService:
    """Get EntryService from app state."""
    return get_entry_service(request.app)


def _check_share_cookie(request: Request, slug: str, service: EntryService):
    from peekview.services.share_service import ShareService
    from peekview.models import File

    share_service: ShareService = request.app.state.share_service

    with Session(request.app.state.engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            return None

        if entry.is_public:
            return None

        cookie_name = f"peekview_share_{entry.id}"
        cookie_value = request.cookies.get(cookie_name)
        if not cookie_value:
            return None

        share = share_service.verify_share_cookie(entry.id, cookie_value)
        if not share:
            return None

        files = session.exec(select(File).where(File.entry_id == entry.id)).all()
        username = service._resolve_username(session, entry.owner_id)
        response = service._build_response(entry, list(files), username)
        response.share_context = EntryShareContext(
            is_share_access=True,
            shared_by=service._resolve_username(session, share.created_by),
        )
        return response


def _looks_like_jwt(token: str) -> bool:
    """Heuristic: JWTs have 3 base64url-encoded segments separated by dots."""
    parts = token.split(".")
    return len(parts) == 3


def _is_global_api_key_auth(request: Request, current_user: User | None) -> bool:
    """Check if request is authenticated via global master API key (no user binding).

    Only returns True for global master key — it bypasses ownership checks.
    User-level API keys (pv_ prefix) have current_user set, treated like JWT.
    """
    if current_user is not None:
        return False  # Has user = JWT or user-level key, not global key

    # No user: check if request used X-API-Key or Bearer (non-JWT, non-pv_)
    x_key = request.headers.get("X-API-Key", "")
    if x_key and not x_key.startswith(API_KEY_PREFIX):
        return True  # Global master key

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if not _looks_like_jwt(token) and not token.startswith(API_KEY_PREFIX):
            return True  # Global master key (Bearer backward compat)

    return False


@router.post("", status_code=201)
async def create_entry(
    data: CreateEntryRequest,
    request: Request,
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
    """Create a new entry. Returns 201 Created."""
    global_key_auth = _is_global_api_key_auth(request, current_user)

    # Check anonymous create permission
    if current_user is None and not global_key_auth:
        if not request.app.state.config.auth.allow_anonymous_create:
            raise AuthenticationError("Authentication required to create entries")

    # Convert files and dirs to dicts
    files_data = []
    for f in data.files:
        file_dict = {}
        if f.path is not None:
            file_dict["path"] = f.path
        if f.filename is not None:
            file_dict["filename"] = f.filename
        if f.content is not None:
            file_dict["content"] = f.content
        if f.content_base64 is not None:
            file_dict["content_base64"] = f.content_base64
        if f.local_path is not None:
            file_dict["local_path"] = f.local_path
        files_data.append(file_dict)

    dirs_data = []
    for d in data.dirs:
        dirs_data.append({"path": d.path})

    # Anonymous users forced to is_public=True (API-layer enforcement)
    is_public = data.is_public
    if current_user is None:
        is_public = True

    current_user_id = current_user.id if current_user else None

    return service.create_entry(
        summary=data.summary,
        slug=data.slug,
        tags=data.tags,
        files_data=files_data if files_data else None,
        dirs_data=dirs_data if dirs_data else None,
        expires_in=data.expires_in,
        is_public=is_public,
        current_user_id=current_user_id,
    )


@router.get("")
async def list_entries(
    request: Request,
    q: str | None = Query(None),
    tags: str | None = Query(None),
    status: str | None = Query(None),
    owner: str | None = Query(None, description="Filter: 'me' for own entries"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
    """List entries with search, filter, and pagination."""
    tag_list = tags.split(",") if tags else None
    current_user_id = current_user.id if current_user else None
    is_admin = current_user.is_admin if current_user else False
    return service.list_entries(
        q=q, tags=tag_list, status=status, page=page, per_page=per_page,
        current_user_id=current_user_id, is_admin=is_admin, owner=owner,
    )


@router.get("/{slug}")
async def get_entry(
    slug: str,
    share: str | None = Query(default=None, max_length=64),
    request: Request = None,  # injected by FastAPI
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
    """Get entry details by slug.

    Supports ?share={token} query param for share link access.
    If share token is valid, sets a share cookie and returns entry
    with share_context. Cookie enables subsequent sub-resource access.
    """
    current_user_id = current_user.id if current_user else None
    is_admin = current_user.is_admin if current_user else False

    if share:
        from peekview.services.share_service import ShareService

        share_service: ShareService = request.app.state.share_service

        with Session(request.app.state.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            if entry.is_public or (current_user_id is not None and (is_admin or entry.owner_id == current_user_id)):
                return service.get_entry(slug, current_user_id=current_user_id, is_admin=is_admin)

        result = service.get_entry_with_share(slug, share, share_service)
        if result is None:
            raise NotFoundError(f"Entry not found: {slug}")

        entry_response, entry_share = result

        is_secure = request.url.scheme == "https"
        cookie_params = share_service.build_share_cookie_params(
            entry_id=entry_response.id,
            token_prefix=entry_share.token_prefix,
            expires_at=entry_share.expires_at,
            is_secure=is_secure,
        )

        content = entry_response.model_dump(mode="json")
        response = JSONResponse(content=content)
        response.set_cookie(**cookie_params)
        return response

    cookie_result = _check_share_cookie(request, slug, service)
    if cookie_result is not None:
        return cookie_result

    return service.get_entry(slug, current_user_id=current_user_id, is_admin=is_admin)


@router.patch("/{slug}")
async def update_entry(
    slug: str,
    data: EntryUpdate,
    request: Request,
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
    """Update an entry."""
    global_key_auth = _is_global_api_key_auth(request, current_user)

    # Convert add_files to dicts
    add_files = None
    if data.add_files:
        add_files = []
        for f in data.add_files:
            file_dict = {}
            if f.path is not None:
                file_dict["path"] = f.path
            if f.filename is not None:
                file_dict["filename"] = f.filename
            if f.content is not None:
                file_dict["content"] = f.content
            if f.content_base64 is not None:
                file_dict["content_base64"] = f.content_base64
            if f.local_path is not None:
                file_dict["local_path"] = f.local_path
            add_files.append(file_dict)

    # Convert add_dirs to dicts
    add_dirs = None
    if data.add_dirs:
        add_dirs = [{"path": d.path} for d in data.add_dirs]

    current_user_id = current_user.id if current_user else None
    is_admin = current_user.is_admin if current_user else False

    return service.update_entry(
        slug=slug,
        summary=data.summary,
        status=data.status,
        tags=data.tags,
        is_public=data.is_public,
        add_files=add_files,
        remove_file_ids=data.remove_file_ids,
        add_dirs=add_dirs,
        current_user_id=current_user_id,
        is_api_key_auth=global_key_auth,
        is_admin=is_admin,
    )


@router.delete("/{slug}")
async def delete_entry(
    slug: str,
    request: Request,
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
    """Delete entry by slug."""
    global_key_auth = _is_global_api_key_auth(request, current_user)

    if global_key_auth:
        # Global master key: bypass ownership checks
        service.delete_entry_by_api_key(slug)
    else:
        # JWT or user-level API key: normal ownership checks
        no_server_auth = not request.app.state.config.server.api_key
        allow_local = no_server_auth and current_user is None
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False

        service.delete_entry(
            slug,
            current_user_id=current_user_id,
            allow_local=allow_local,
            is_admin=is_admin,
        )
    return {"ok": True}


@router.get("/{slug}/download")
async def download_entry_files(
    slug: str,
    request: Request,
    service: EntryService = Depends(_get_service),
    current_user: User | None = Depends(get_current_user),
):
    """Download all entry files as a zip archive."""
    global_key_auth = _is_global_api_key_auth(request, current_user)

    if global_key_auth:
        entry = service.get_entry_by_api_key(slug)
    else:
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False

        entry = service.get_entry(
            slug,
            current_user_id=current_user_id,
            is_admin=is_admin,
        )

    if not entry.files:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "NO_FILES", "message": "Entry has no files to download"}},
        )

    # Create zip in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_record in entry.files:
            # Get the actual disk path
            disk_path = service.storage.get_disk_path(entry.id, file_record.path or file_record.filename)
            if disk_path.exists():
                # Use stored path or filename for zip entry
                arcname = file_record.path or file_record.filename
                zf.write(disk_path, arcname=arcname)

    zip_buffer.seek(0)

    filename = _sanitize_filename(f"{entry.slug}.zip")
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
