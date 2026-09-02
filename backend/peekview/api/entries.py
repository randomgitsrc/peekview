"""Entry CRUD API routes."""

from __future__ import annotations

import asyncio
import io
import logging
import zipfile

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel import Session, select

from peekview.api._shared import (
    _detect_channel,
    _is_global_api_key_auth,
    _record_read_async,
)
from peekview.api.files import _sanitize_filename
from peekview.api.rate_limit import entries_rate_limit, limiter
from peekview.auth import get_current_user, require_auth
from peekview.exceptions import AuthenticationError, NotFoundError, ParameterValidationError
from peekview.models import (
    CreateEntryRequest,
    Entry,
    EntryShareContext,
    EntryUpdate,
    User,
)
from peekview.services.entry_service import EntryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entries", tags=["entries"])


def _share_cookie_allowed_for_user(request: Request, entry: Entry, current_user: User | None) -> bool:
    """Share-cookie gate: deny team entries to a logged-in non-privileged user.

    A logged-in user who is not the owner, admin, or a team member never gets
    team-entry content through a share cookie — shares serve anonymous external
    visitors (same discrimination as the ?share= query branch, BDD-2). Anonymous
    access and non-team private-entry shares are unaffected.
    """
    if current_user is None or entry.team_id is None:
        return True
    if entry.owner_id == current_user.id or current_user.is_admin:
        return True
    from peekview.services.team_membership import team_membership_exists

    with Session(request.app.state.engine) as session:
        return team_membership_exists(session, current_user.id, entry.team_id)


def _check_share_cookie(
    request: Request,
    slug: str,
    service: EntryService,
    current_user: User | None = None,
):
    from peekview.models import File
    from peekview.services.share_service import ShareService

    share_service: ShareService = request.app.state.share_service

    with Session(request.app.state.engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            return None

        if entry.is_public:
            return None

        cookie_name = f"peekview_share_{slug}"
        cookie_value = request.cookies.get(cookie_name)
        if not cookie_value:
            return None

        share = share_service.verify_share_cookie(entry.id, cookie_value)
        if not share:
            return None

        # Anti-enumeration (BDD-2): see _share_cookie_allowed_for_user.
        if not _share_cookie_allowed_for_user(request, entry, current_user):
            return None

        files = session.exec(select(File).where(File.entry_id == entry.id)).all()
        username = service._resolve_username(session, entry.owner_id)
        response = service._build_response(entry, list(files), username)
        # Share access never discloses team membership (shared contract).
        response.team_id = None
        response.team = None
        response.share_context = EntryShareContext(
            is_share_access=True,
            shared_by=service._resolve_username(session, share.created_by),
        )
        return response


@router.post("", status_code=201)
@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)
async def create_entry(
    data: CreateEntryRequest,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Create a new entry. Returns 201 Created."""
    service = request.app.state.entry_service
    global_key_auth = _is_global_api_key_auth(request, current_user)

    # Check anonymous create permission
    if current_user is None and not global_key_auth:  # noqa: SIM102
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

    result, is_idempotent = service.create_entry(
        summary=data.summary,
        slug=data.slug,
        tags=data.tags,
        files_data=files_data if files_data else None,
        dirs_data=dirs_data if dirs_data else None,
        expires_in=data.expires_in,
        is_public=is_public,
        current_user_id=current_user_id,
        idempotency_key=data.idempotency_key,
        team_id=data.team_id,
    )
    if is_idempotent:
        return JSONResponse(status_code=200, content=result.model_dump(mode="json"))
    return result


@router.get("")
async def list_entries(
    request: Request,
    q: str | None = Query(None),
    tags: str | None = Query(None),
    status: str | None = Query(None),
    owner: str | None = Query(None, description="Filter: 'me' for own entries"),
    starred: bool = Query(False, description="List the current user's starred entries"),
    team: str | None = Query(
        None,
        description="Filter: 'me' for my team entries, or a team slug. Unknown/non-member teams return an empty list.",
    ),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_current_user),
):
    """List entries with search, filter, and pagination."""
    service = request.app.state.entry_service
    valid_status_values = {"active", "archived", "published"}
    if status is not None and status not in valid_status_values:
        raise ParameterValidationError(
            f"Invalid status value: {status}. Must be one of: {', '.join(sorted(valid_status_values))}"
        )
    if starred and current_user is None:
        raise AuthenticationError("Authentication required to list starred entries")
    tag_list = tags.split(",") if tags else None
    current_user_id = current_user.id if current_user else None
    is_admin = current_user.is_admin if current_user else False
    result = service.list_entries(
        q=q,
        tags=tag_list,
        status=status,
        page=page,
        per_page=per_page,
        current_user_id=current_user_id,
        is_admin=is_admin,
        owner=owner,
        starred=starred,
        team=team,
    )

    channel = _detect_channel(request)
    reader_ip = request.client.host if request.client else None
    asyncio.create_task(
        _record_read_async(
            request.app.state,
            entry_id=None,
            entry_owner_id=None,
            action="discover",
            channel=channel,
            reader_id=current_user_id,
            reader_ip=reader_ip,
            request=request,
        )
    )

    return result


@router.get("/{slug}")
async def get_entry(
    slug: str,
    share: str | None = Query(default=None, max_length=64),
    request: Request = None,  # injected by FastAPI
    current_user: User | None = Depends(get_current_user),
):
    """Get entry details by slug.

    Supports ?share={token} query param for share link access.
    If share token is valid, sets a share cookie and returns entry
    with share_context. Cookie enables subsequent sub-resource access.
    """
    service = request.app.state.entry_service
    current_user_id = current_user.id if current_user else None
    is_admin = current_user.is_admin if current_user else False

    if share:
        from peekview.services.share_service import ShareService
        from peekview.services.team_membership import team_membership_exists, team_owner_exists

        share_service: ShareService = request.app.state.share_service

        with Session(request.app.state.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            # Normal access takes priority: public entry, admin, owner, or a
            # team member / team owner of a team entry (share param on a
            # readable entry is ignored). The team owner counts as a team-scope
            # reader even without a membership row (方案 A, mirrors can_read).
            is_team_member = (
                team_membership_exists(session, current_user_id, entry.team_id)
                if entry.team_id is not None
                else False
            )
            is_team_owner = (
                team_owner_exists(session, current_user_id, entry.team_id)
                if entry.team_id is not None
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
                resp = service.get_entry(
                    slug,
                    current_user_id=current_user_id,
                    is_admin=is_admin,
                    include_read_stats=(
                        current_user_id is not None
                        and (is_admin or entry.owner_id == current_user_id)
                    ),
                )
                asyncio.create_task(
                    _record_read_async(
                        request.app.state,
                        entry_id=entry.id,
                        entry_owner_id=entry.owner_id,
                        action="read",
                        channel="share",
                        reader_id=current_user_id,
                        reader_ip=request.client.host if request.client else None,
                        request=request,
                    )
                )
                return resp

            # Anti-enumeration (BDD-2): a logged-in user who is not the owner,
            # admin, or a team member never gets team-entry content through a
            # share token/cookie — shares are for anonymous external visitors.
            if entry.team_id is not None and current_user_id is not None:
                raise NotFoundError(f"Entry not found: {slug}")

        result = service.get_entry_with_share(slug, share, share_service)
        if result is None:
            raise NotFoundError(f"Entry not found: {slug}")

        entry_response, entry_share = result

        is_secure = request.url.scheme == "https"
        cookie_params = share_service.build_share_cookie_params(
            slug=slug,
            token_prefix=entry_share.token_prefix,
            expires_at=entry_share.expires_at,
            is_secure=is_secure,
        )

        asyncio.create_task(
            _record_read_async(
                request.app.state,
                entry_id=entry_response.id,
                entry_owner_id=entry_response.owner_id,
                action="read",
                channel="share",
                reader_id=current_user_id,
                reader_ip=request.client.host if request.client else None,
                request=request,
            )
        )

        content = entry_response.model_dump(mode="json")
        response = JSONResponse(content=content)
        response.set_cookie(**cookie_params)
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    cookie_result = _check_share_cookie(request, slug, service, current_user)
    if cookie_result is not None:
        with Session(request.app.state.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if entry:
                asyncio.create_task(
                    _record_read_async(
                        request.app.state,
                        entry_id=entry.id,
                        entry_owner_id=entry.owner_id,
                        action="read",
                        channel="share",
                        reader_id=current_user_id,
                        reader_ip=request.client.host if request.client else None,
                        request=request,
                    )
                )
        return cookie_result

    with Session(request.app.state.engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

    include_stats = current_user_id is not None and (is_admin or entry.owner_id == current_user_id)
    resp = service.get_entry(
        slug, current_user_id=current_user_id, is_admin=is_admin, include_read_stats=include_stats
    )

    channel = _detect_channel(request, slug=slug)
    asyncio.create_task(
        _record_read_async(
            request.app.state,
            entry_id=entry.id,
            entry_owner_id=entry.owner_id,
            action="read",
            channel=channel,
            reader_id=current_user_id,
            reader_ip=request.client.host if request.client else None,
            request=request,
        )
    )

    return resp


@router.get("/{slug}/reads")
async def get_entry_reads(
    slug: str,
    request: Request,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_auth),
):
    with Session(request.app.state.engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

    is_admin = current_user.is_admin
    if not is_admin and entry.owner_id != current_user.id:
        raise NotFoundError(f"Entry not found: {slug}")

    return request.app.state.read_tracking_service.get_read_events(
        entry_id=entry.id,
        page=page,
        per_page=per_page,
    )


@router.patch("/{slug}")
@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)
async def update_entry(
    slug: str,
    data: EntryUpdate,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Update an entry."""
    service = request.app.state.entry_service
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

    team_id = data.team_id
    team_id_set = "team_id" in (data.model_fields_set or set())

    return service.update_entry(
        slug=slug,
        summary=data.summary,
        status=data.status,
        tags=data.tags,
        is_public=data.is_public,
        expires_in=data.expires_in,
        add_files=add_files,
        remove_file_ids=data.remove_file_ids,
        add_dirs=add_dirs,
        current_user_id=current_user_id,
        is_api_key_auth=global_key_auth,
        is_admin=is_admin,
        team_id=team_id,
        team_id_set=team_id_set,
    )


@router.delete("/{slug}")
@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)
async def delete_entry(
    slug: str,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Delete entry by slug."""
    service = request.app.state.entry_service
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


@router.post("/{slug}/star")
@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)
async def star_entry(
    slug: str,
    request: Request,
    current_user: User = Depends(require_auth),
):
    """Star an entry. Requires readability (BLOCKER-2): unreadable entries
    (private non-owner, archived non-star, unknown slug) return 404 and the
    star is refused — preventing self-authorization and slug probing.
    """
    service = request.app.state.entry_service
    star_service = request.app.state.star_service
    entry = service.get_entry(
        slug, current_user_id=current_user.id, is_admin=current_user.is_admin
    )
    return star_service.star(entry.id, current_user.id)


@router.delete("/{slug}/star")
@limiter.shared_limit(entries_rate_limit, scope="entries_write", override_defaults=False)
async def unstar_entry(
    slug: str,
    request: Request,
    current_user: User = Depends(require_auth),
):
    """Unstar an entry.

    F2：已有星标（活或墓碑绑定）→ 直接 unstar（N9：转私有/archived 后取消星标
    仍 200，无读权限门槛）；无星标 → 回退 get_entry 可读性校验，不可读 → 404，
    消除 DELETE /star 的 slug 存在性 oracle（未知/不可读 slug 不再 200）。
    """
    service = request.app.state.entry_service
    star_service = request.app.state.star_service
    entry = service.get_entry_by_slug(slug)
    if not entry:
        raise NotFoundError(f"Entry not found: {slug}")
    if not star_service.has_star(entry.id, current_user.id):
        service.get_entry(
            slug, current_user_id=current_user.id, is_admin=current_user.is_admin
        )
    return star_service.unstar(entry.id, current_user.id)


@router.get("/{slug}/download")
async def download_entry_files(
    slug: str,
    request: Request,
    current_user: User | None = Depends(get_current_user),
):
    """Download all entry files as a zip archive."""
    service = request.app.state.entry_service
    global_key_auth = _is_global_api_key_auth(request, current_user)

    if global_key_auth:
        entry = service.get_entry_by_api_key(slug)
    else:
        current_user_id = current_user.id if current_user else None
        is_admin = current_user.is_admin if current_user else False

        try:
            entry = service.get_entry(
                slug,
                current_user_id=current_user_id,
                is_admin=is_admin,
            )
        except NotFoundError:
            cookie_result = _check_share_cookie(request, slug, service, current_user)
            if cookie_result is None:
                raise
            entry = cookie_result

    # Create zip in memory (empty zip when the entry has no files — a download
    # of an accessible entry is always 200; clients decide how to handle an
    # empty archive).
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_record in entry.files:
            # Get the actual disk path
            disk_path = service.storage.get_disk_path(
                entry.id, file_record.path or file_record.filename
            )
            if disk_path.exists():
                # Use stored path or filename for zip entry
                arcname = file_record.path or file_record.filename
                zf.write(disk_path, arcname=arcname)

    zip_buffer.seek(0)

    filename = _sanitize_filename(f"{entry.slug}.zip")

    channel = _detect_channel(request, slug=slug)
    current_user_id_dl = current_user.id if current_user else None
    asyncio.create_task(
        _record_read_async(
            request.app.state,
            entry_id=entry.id,
            entry_owner_id=entry.owner_id,
            action="download",
            channel=channel,
            reader_id=current_user_id_dl,
            reader_ip=request.client.host if request.client else None,
            request=request,
        )
    )

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
