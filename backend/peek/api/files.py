"""File download and content API routes."""

from __future__ import annotations

import re

from fastapi import APIRouter, Request
from fastapi.responses import Response
from sqlmodel import Session, select

from peek.database import get_engine
from peek.exceptions import NotFoundError
from peek.models import Entry, File
from peek.storage import StorageManager

router = APIRouter(prefix="/api/v1/entries", tags=["files"])


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename for Content-Disposition header to prevent injection.

    Removes quotes, semicolons, and newlines that could break the header.
    """
    # Remove characters that could inject additional headers
    sanitized = re.sub(r'[";\r\n]', "", filename)
    # Limit length
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


@router.get("/{slug}/files/{file_id}")
async def download_file(slug: str, file_id: int, request: Request):
    """Download a single file (with Content-Disposition: attachment)."""
    config = request.app.state.config
    engine = get_engine(config)
    storage = StorageManager(config=config)

    with Session(engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry.id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

        content = storage.read_file(entry.id, file_record.filename, file_record.path)
        safe_name = _sanitize_filename(file_record.filename)
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
        )


@router.get("/{slug}/files/{file_id}/content")
async def get_file_content(slug: str, file_id: int, request: Request):
    """Get file content inline (raw text, no Content-Disposition).

    Returns the file content with an appropriate Content-Type based on
    language. No Content-Disposition header — suitable for inline display.
    """
    config = request.app.state.config
    engine = get_engine(config)
    storage = StorageManager(config=config)

    with Session(engine) as session:
        entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
        if not entry:
            raise NotFoundError(f"Entry not found: {slug}")

        file_record = session.exec(
            select(File).where(File.id == file_id, File.entry_id == entry.id)
        ).first()
        if not file_record:
            raise NotFoundError(f"File not found: {file_id}")

    content = storage.read_file(entry.id, file_record.filename, file_record.path)

    # Determine Content-Type from language
    content_type = _language_to_content_type(file_record.language)
    return Response(
        content=content,
        media_type=content_type,
        # No Content-Disposition — inline display
    )
