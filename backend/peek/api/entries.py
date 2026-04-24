"""Entry CRUD API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from peek.models import CreateEntryRequest, EntryUpdate
from peek.services.entry_service import EntryService, get_entry_service

router = APIRouter(prefix="/api/v1/entries", tags=["entries"])


def _get_service(request: Request) -> EntryService:
    """Get EntryService from app state."""
    return get_entry_service(request.app)


@router.post("", status_code=201)
async def create_entry(
    data: CreateEntryRequest,
    request: Request,
    service: EntryService = Depends(_get_service),
):
    """Create a new entry. Returns 201 Created."""
    # Convert files and dirs to dicts
    files_data = []
    for f in data.files:
        file_dict = {}
        if f.path is not None:
            file_dict["path"] = f.path
        if f.content is not None:
            file_dict["content"] = f.content
        if f.local_path is not None:
            file_dict["local_path"] = f.local_path
        files_data.append(file_dict)

    dirs_data = []
    for d in data.dirs:
        dirs_data.append({"path": d.path})

    return service.create_entry(
        summary=data.summary,
        slug=data.slug,
        tags=data.tags,
        files_data=files_data if files_data else None,
        dirs_data=dirs_data if dirs_data else None,
        expires_in=data.expires_in,
    )


@router.get("")
async def list_entries(
    request: Request,
    q: str | None = Query(None),
    tags: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    service: EntryService = Depends(_get_service),
):
    """List entries with search, filter, and pagination."""
    tag_list = tags.split(",") if tags else None
    return service.list_entries(q=q, tags=tag_list, status=status, page=page, per_page=per_page)


@router.get("/{slug}")
async def get_entry(
    slug: str,
    request: Request,
    service: EntryService = Depends(_get_service),
):
    """Get entry details by slug."""
    return service.get_entry(slug)


@router.patch("/{slug}")
async def update_entry(
    slug: str,
    data: EntryUpdate,
    request: Request,
    service: EntryService = Depends(_get_service),
):
    """Update an entry."""
    # Convert add_files to dicts
    add_files = None
    if data.add_files:
        add_files = []
        for f in data.add_files:
            file_dict = {}
            if f.path is not None:
                file_dict["path"] = f.path
            if f.content is not None:
                file_dict["content"] = f.content
            if f.local_path is not None:
                file_dict["local_path"] = f.local_path
            add_files.append(file_dict)

    # Convert add_dirs to dicts
    add_dirs = None
    if data.add_dirs:
        add_dirs = [{"path": d.path} for d in data.add_dirs]

    return service.update_entry(
        slug=slug,
        summary=data.summary,
        status=data.status,
        tags=data.tags,
        add_files=add_files,
        remove_file_ids=data.remove_file_ids,
        add_dirs=add_dirs,
    )


@router.delete("/{slug}")
async def delete_entry(
    slug: str,
    request: Request,
    service: EntryService = Depends(_get_service),
):
    """Delete entry by slug."""
    service.delete_entry(slug)
    return {"ok": True}
