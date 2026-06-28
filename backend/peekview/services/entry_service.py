"""Entry business logic — create, get, list, update, delete."""

from __future__ import annotations

import json
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import String, func, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from peekview.config import PeekConfig
from peekview.database import get_engine
from peekview.exceptions import (
    InvalidSlugError,
    NotFoundError,
    PayloadTooLargeError,
    ValidationError,
)
from peekview.language import detect_language, is_binary_content
from peekview.models import (
    CreateEntryResponse,
    Entry,
    EntryListItem,
    EntryListResponse,
    EntryResponse,
    EntryShareContext,
    File,
    FileResponse,
    User,
)
from peekview.services.file_service import (
    decode_base64_content,
    parse_expires_in,
    scan_directory,
    validate_local_path,
)
from peekview.storage import StorageManager

logger = logging.getLogger(__name__)

# Slug format: lowercase alphanumeric, hyphens, underscores
SLUG_PATTERN = re.compile(r"^[a-z0-9_-]+$")


def get_entry_service(app: Any) -> "EntryService":
    """Get or create EntryService from app.state (singleton per app).

    This avoids creating new service instances on every request.

    Args:
        app: FastAPI app instance with .state.

    Returns:
        EntryService instance.
    """
    if not hasattr(app.state, "entry_service"):
        from peekview.config import PeekConfig

        # Use app.state.config if available, otherwise create new config
        config = getattr(app.state, "config", None) or PeekConfig()
        engine = get_engine(config.db_path)
        storage = StorageManager(config=config)
        app.state.entry_service = EntryService(
            engine=engine,
            storage=storage,
            config=config,
        )
    return app.state.entry_service


class EntryService:
    """Business logic for entry operations."""

    def __init__(self, engine, storage: StorageManager, config: PeekConfig):
        self.engine = engine
        self.storage = storage
        self.config = config

    def create_entry(
        self,
        summary: str,
        slug: str | None = None,
        tags: list[str] | None = None,
        files_data: list[dict[str, Any]] | None = None,
        dirs_data: list[dict[str, str]] | None = None,
        expires_in: str | None = None,
        is_public: bool = True,
        current_user_id: int | None = None,
    ) -> CreateEntryResponse:
        """Create a new entry with files.

        All DB + file operations are wrapped in a transaction. If any file write
        fails, the DB entry is rolled back.

        Args:
            summary: Entry description.
            slug: Custom URL slug (auto-generated if None).
            tags: List of tags.
            files_data: List of file dicts with keys: path, content, content_base64, local_path.
            dirs_data: List of dir dicts with key: path.
            expires_in: Duration string like "7d".

        Returns:
            CreateEntryResponse with URL.
        """
        # Validate summary
        if not summary or not summary.strip():
            raise ValidationError("Summary is required")
        if len(summary) > self.config.limits.max_summary_length:
            raise ValidationError(
                f"Summary exceeds max length ({self.config.limits.max_summary_length})"
            )

        # Validate/generate slug
        if slug:
            if not SLUG_PATTERN.match(slug):
                raise InvalidSlugError(
                    f"Slug must match [a-z0-9_-], got: {slug!r}"
                )
            if len(slug) > self.config.limits.max_slug_length:
                raise InvalidSlugError(
                    f"Slug exceeds max length ({self.config.limits.max_slug_length})"
                )
        else:
            # Generate random 6-character slug
            slug = secrets.token_urlsafe(8)[:6].lower().replace("_", "").replace("-", "")
            while len(slug) < 6:
                slug += secrets.choice("abcdefghijklmnopqrstuvwxyz0123456789")

        # Parse expiry
        expires_at = None
        if expires_in and expires_in.strip():
            delta = parse_expires_in(expires_in)
            if delta is not None:
                expires_at = datetime.now(timezone.utc) + delta
        else:
            default_expires = self.config.limits.default_expires_in
            delta = parse_expires_in(default_expires)
            if delta is not None:
                expires_at = datetime.now(timezone.utc) + delta

        # Collect all files
        files_info = self._collect_files(files_data or [], dirs_data or [])

        # Validate limits
        self._validate_limits(files_info)

        # Visibility: anonymous users cannot create private entries (service-layer enforcement)
        if current_user_id is None:
            is_public = True

        # Create entry in DB + write files (transaction with rollback)
        entry = Entry(
            slug=slug,
            summary=summary.strip(),
            tags=tags or [],
            is_public=is_public,
            owner_id=current_user_id,
            expires_at=expires_at,
        )

        try:
            with Session(self.engine) as session:
                session.add(entry)
                session.commit()
                session.refresh(entry)
                entry_id = entry.id
                entry_slug = entry.slug
                entry_is_public = entry.is_public
                entry_owner_id = entry.owner_id
                entry_created_at = entry.created_at

                # Write files to disk + create File records
                file_records = []
                written_paths: list[Any] = []
                try:
                    for fi in files_info:
                        content = fi.get("content_bytes", b"")
                        file_path = fi.get("path")
                        filename = fi["filename"]
                        is_binary = fi.get("is_binary", False)
                        lang = fi.get("language")

                        disk_path = self.storage.write_file(
                            entry_id=entry_id,
                            filename=filename,
                            content=content,
                            file_path=file_path,
                        )
                        written_paths.append(disk_path)

                        # Compute line count for text files
                        line_count = None
                        if content and not is_binary:
                            try:
                                line_count = content.decode('utf-8').count('\n') + 1
                            except (UnicodeDecodeError, AttributeError):
                                line_count = None

                        file_record = File(
                            entry_id=entry_id,
                            path=file_path,
                            filename=filename,
                            language=lang,
                            is_binary=is_binary,
                            size=len(content),
                            sha256=self.storage.compute_sha256(content) if content else None,
                            line_count=line_count,
                        )
                        session.add(file_record)
                        file_records.append(file_record)

                    session.commit()

                    # Refresh to get file IDs
                    for fr in file_records:
                        session.refresh(fr)

                    # Build file responses
                    file_responses = [
                        FileResponse(
                            id=f.id,
                            path=f.path,
                            filename=f.filename,
                            language=f.language,
                            is_binary=f.is_binary,
                            size=f.size,
                            line_count=f.line_count,
                        )
                        for f in file_records
                    ]
                except Exception:
                    # Rollback: delete any written files
                    for wp in written_paths:
                        try:
                            wp.unlink()
                        except OSError:
                            pass
                    session.rollback()
                    raise

        except IntegrityError:
            # Slug conflict — TOCTOU protection: retry with suffix
            return self._retry_with_slug_suffix(
                summary, slug, tags, files_data, dirs_data, expires_in, is_public, current_user_id
            )

        return CreateEntryResponse(
            id=entry_id,
            slug=entry_slug,
            url=self.config.build_view_url(entry_slug),
            is_public=entry_is_public,
            owner_id=entry_owner_id,
            expires_at=expires_at,
            created_at=entry_created_at,
            files=file_responses,
        )

    def get_entry(self, slug: str, current_user_id: int | None = None, is_admin: bool = False) -> EntryResponse:
        """Get entry details by slug.

        Private entries are only visible to their owner (or admin).
        Returns 404 for non-owners of private entries (not 403, to prevent slug enumeration).
        """
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            # Visibility check: private entries only visible to owner or admin
            if not entry.is_public and not is_admin and entry.owner_id != current_user_id:
                raise NotFoundError(f"Entry not found: {slug}")

            files = session.exec(
                select(File).where(File.entry_id == entry.id)
            ).all()

            # Resolve username for owner
            username = self._resolve_username(session, entry.owner_id)

            return self._build_response(entry, list(files), username)

    def list_entries(
        self,
        q: str | None = None,
        tags: list[str] | None = None,
        status: str | None = None,
        page: int = 1,
        per_page: int = 20,
        current_user_id: int | None = None,
        is_admin: bool = False,
        owner: str | None = None,
    ) -> EntryListResponse:
        """List entries with search, filter, pagination, and visibility.

        Anonymous users see only public entries.
        Logged-in users see public entries + their own private entries.
        Admin users see all entries.
        owner="me" filters to only entries owned by current_user_id.
        owner=<username> filters to entries owned by that user (case-insensitive).
        """
        per_page = min(per_page, self.config.limits.max_per_page)
        page = max(page, 1)
        offset = (page - 1) * per_page

        with Session(self.engine) as session:
            # Build query
            query = select(Entry)
            count_query = select(func.count()).select_from(Entry)

            # Status filter (default: show active + published, hide archived)
            if status:
                query = query.where(Entry.status == status)
                count_query = count_query.where(Entry.status == status)
            else:
                query = query.where(Entry.status != "archived")
                count_query = count_query.where(Entry.status != "archived")

            # === Phase 1: Resolve owner to user_id ===
            # owner_found tri-state: None (N/A or "me") | True (user exists) | False (user not found)
            owner_found = None
            owner_user_id = None

            if owner is not None:
                if owner == "me":
                    if current_user_id is None:
                        return EntryListResponse(
                            items=[], total=0, page=page, per_page=per_page,
                            owner_found=None,
                        )
                    owner_user_id = current_user_id
                    # owner_found stays None for "me" (not applicable)
                else:
                    # Real username: case-insensitive lookup
                    user = session.exec(
                        select(User).where(func.lower(User.username) == owner.lower())
                    ).first()
                    if user:
                        owner_user_id = user.id
                        owner_found = True
                    else:
                        return EntryListResponse(
                            items=[], total=0, page=page, per_page=per_page,
                            owner_found=False,
                        )

            # === Phase 2: Apply owner filter to query ===
            if owner_user_id is not None:
                query = query.where(Entry.owner_id == owner_user_id)
                count_query = count_query.where(Entry.owner_id == owner_user_id)

            # === Phase 3: Apply visibility filter (existing logic, unchanged) ===
            if is_admin:
                pass
            elif current_user_id is None:
                query = query.where(Entry.is_public == True)
                count_query = count_query.where(Entry.is_public == True)
            else:
                query = query.where(
                    (Entry.is_public == True) | (Entry.owner_id == current_user_id)
                )
                count_query = count_query.where(
                    (Entry.is_public == True) | (Entry.owner_id == current_user_id)
                )

            # Tags filter (JSON array — use LIKE for SQLite JSON compatibility)
            if tags:
                for tag in tags:
                    quoted = f'"{tag}"'
                    query = query.where(Entry.tags.cast(String).like(f"%{quoted}%"))
                    count_query = count_query.where(Entry.tags.cast(String).like(f"%{quoted}%"))

            # FTS5 search
            if q and q.strip():
                try:
                    fts_result = session.exec(
                        text("SELECT rowid FROM entries_fts WHERE entries_fts MATCH :q"),
                        params={"q": q.strip()},
                    )
                    fts_ids = [row[0] for row in fts_result]
                    if fts_ids:
                        query = query.where(Entry.id.in_(fts_ids))
                        count_query = count_query.where(Entry.id.in_(fts_ids))
                    else:
                        return EntryListResponse(
                            items=[], total=0, page=page, per_page=per_page,
                            owner_found=owner_found,
                        )
                except Exception:
                    # FTS might not be available
                    pass

            # Order by created_at desc
            query = query.order_by(Entry.created_at.desc())

            total = session.exec(count_query).one()
            entries = session.exec(query.offset(offset).limit(per_page)).all()

            # Batch resolve usernames (solve N+1 problem)
            owner_ids = [e.owner_id for e in entries if e.owner_id is not None]
            username_map = {}
            if owner_ids:
                users = session.exec(
                    select(User).where(User.id.in_(set(owner_ids)))
                ).all()
                username_map = {u.id: u.username for u in users}

            items = []
            for e in entries:
                # Get file count
                file_count = session.exec(
                    select(func.count()).select_from(File).where(File.entry_id == e.id)
                ).one()
                username = username_map.get(e.owner_id) if e.owner_id else None
                items.append(
                    EntryListItem(
                        id=e.id,
                        slug=e.slug,
                        summary=e.summary,
                        tags=e.tags,
                        status=e.status,
                        file_count=file_count,
                        is_public=e.is_public,
                        owner_id=e.owner_id,
                        username=username,
                        expires_at=e.expires_at,
                        created_at=e.created_at,
                        updated_at=e.updated_at,
                    )
                )

        return EntryListResponse(
            items=items, total=total, page=page, per_page=per_page,
            owner_found=owner_found,
        )

    def update_entry(
        self,
        slug: str,
        summary: str | None = None,
        status: str | None = None,
        tags: list[str] | None = None,
        is_public: bool | None = None,
        add_files: list[dict[str, Any]] | None = None,
        remove_file_ids: list[int] | None = None,
        add_dirs: list[dict[str, str]] | None = None,
        current_user_id: int | None = None,
        is_admin: bool = False,
        is_api_key_auth: bool = False,
    ) -> EntryResponse:
        """Update an entry.

        Only the owner or admin can update an entry. Non-owners get 404 (not 403).
        When files are removed via remove_file_ids, their disk files are also deleted.
        Global API key auth bypasses ownership checks.
        """
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            # Global API key bypasses ownership checks
            if not is_api_key_auth:
                # Visibility + ownership check
                if not entry.is_public and not is_admin and entry.owner_id != current_user_id:
                    raise NotFoundError(f"Entry not found: {slug}")
                if not is_admin and entry.owner_id != current_user_id:
                    raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id

            was_private = not entry.is_public

            # Update fields
            if summary is not None:
                entry.summary = summary.strip()
            if status is not None:
                entry.status = status
            if tags is not None:
                entry.tags = tags
            if is_public is not None:
                entry.is_public = is_public
            entry.updated_at = datetime.now(timezone.utc)
            session.add(entry)

            # Private→public: auto-revoke all active shares
            revoked_shares = None
            if is_public is True and was_private:
                share_service = self._get_share_service()
                revoked_shares = share_service.revoke_all_for_entry(entry_id, session=session)

            # Remove files (DB records + disk)
            if remove_file_ids:
                for fid in remove_file_ids:
                    file_record = session.exec(
                        select(File).where(File.id == fid, File.entry_id == entry_id)
                    ).first()
                    if file_record:
                        # Delete from disk
                        try:
                            disk_path = self.storage.get_disk_path(
                                entry_id, file_record.filename, file_record.path
                            )
                            if disk_path.exists():
                                disk_path.unlink()
                                logger.info("Deleted disk file: %s", disk_path)
                        except Exception as e:
                            logger.warning("Failed to delete disk file: %s", e)
                        session.delete(file_record)

            # Add new files
            if add_files:
                for fd in add_files:
                    file_info = self._process_file_input(fd)
                    if file_info:
                        content = file_info.get("content_bytes", b"")
                        file_path = file_info.get("path")
                        filename = file_info["filename"]
                        is_binary = file_info.get("is_binary", False)
                        lang = file_info.get("language")

                        self.storage.write_file(
                            entry_id=entry_id,
                            filename=filename,
                            content=content,
                            file_path=file_path,
                        )

                        file_record = File(
                            entry_id=entry_id,
                            path=file_path,
                            filename=filename,
                            language=lang,
                            is_binary=is_binary,
                            size=len(content),
                            sha256=self.storage.compute_sha256(content) if content else None,
                        )
                        session.add(file_record)

            # Add directories
            if add_dirs:
                for dd in add_dirs:
                    scanned = scan_directory(
                        dd["path"],
                        allowed_dirs=self.config.allowed_dirs,
                        ignored_dirs=self.config.ignored_dirs,
                    )
                    for sf in scanned:
                        from pathlib import Path

                        content = Path(sf.local_path).read_bytes()
                        self.storage.write_file(
                            entry_id=entry_id,
                            filename=sf.filename,
                            content=content,
                            file_path=sf.path,
                        )
                        file_record = File(
                            entry_id=entry_id,
                            path=sf.path or sf.filename,
                            filename=sf.filename,
                            language=sf.language,
                            is_binary=sf.is_binary,
                            size=len(content),
                            sha256=self.storage.compute_sha256(content) if content else None,
                        )
                        session.add(file_record)

            session.commit()
            session.refresh(entry)

            # Get all remaining files
            files = session.exec(
                select(File).where(File.entry_id == entry.id)
            ).all()

            response = self._build_response(entry, list(files))
            if revoked_shares is not None:
                response.revoked_shares = revoked_shares
            return response

    def delete_entry(self, slug: str, current_user_id: int | None = None, is_api_key_auth: bool = False, allow_local: bool = False, is_admin: bool = False) -> None:
        """Delete entry and all associated files.

        Only the owner or admin can delete an entry. Admin can also delete
        owner_id=NULL entries. Anonymous users cannot delete any entries.

        Args:
            slug: Entry slug.
            current_user_id: JWT user ID (None for anonymous/API Key).
            is_api_key_auth: True if authenticated via API Key (service-level).
            allow_local: True for local/CLI mode (no auth, backward compat).
            is_admin: True if user has admin role.
        """
        # Local mode: bypass all auth checks (CLI operates directly on DB)
        if allow_local:
            return self.delete_entry_by_api_key(slug)

        # API Key auth bypasses owner checks
        if is_api_key_auth:
            return self.delete_entry_by_api_key(slug)

        # No auth at all — cannot delete
        if current_user_id is None:
            raise NotFoundError(f"Entry not found: {slug}")

        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            # Visibility check for private entries
            if not entry.is_public and not is_admin and entry.owner_id != current_user_id:
                raise NotFoundError(f"Entry not found: {slug}")

            # Ownership check: only owner or admin can delete
            # owner_id=NULL entries can be deleted by admin only
            if entry.owner_id is None and not is_admin:
                raise NotFoundError(f"Entry not found: {slug}")
            if entry.owner_id is not None and not is_admin and entry.owner_id != current_user_id:
                raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id
            session.delete(entry)
            session.commit()

        # Delete files (best-effort after DB commit)
        self.storage.delete_entry_files(entry_id)

    def delete_entry_by_api_key(self, slug: str) -> None:
        """Delete entry via API Key (service-level auth).

        This bypasses owner checks — API Key holders can delete any entry,
        including owner_id=NULL legacy entries.
        """
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id
            session.delete(entry)
            session.commit()

        # Delete files (best-effort after DB commit)
        self.storage.delete_entry_files(entry_id)

    def delete_entry_by_api_key(self, slug: str) -> None:
        """Delete entry via API Key (service-level auth).

        This bypasses owner checks — API Key holders can delete any entry,
        including owner_id=NULL legacy entries.
        """
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id
            session.delete(entry)
            session.commit()

        # Delete files (best-effort after DB commit)
        self.storage.delete_entry_files(entry_id)

    def _retry_with_slug_suffix(
        self,
        summary: str,
        original_slug: str,
        tags: list[str] | None,
        files_data: list[dict[str, Any]] | None,
        dirs_data: list[dict[str, str]] | None,
        expires_in: str | None,
        is_public: bool = True,
        current_user_id: int | None = None,
    ) -> CreateEntryResponse:
        """Retry entry creation with slug-N suffix on IntegrityError (TOCTOU protection)."""
        for n in range(2, 100):
            new_slug = f"{original_slug}-{n}"
            try:
                return self.create_entry(
                    summary=summary,
                    slug=new_slug,
                    tags=tags,
                    files_data=files_data,
                    dirs_data=dirs_data,
                    expires_in=expires_in,
                    is_public=is_public,
                    current_user_id=current_user_id,
                )
            except IntegrityError:
                continue
        raise ValidationError(f"Could not resolve slug conflict for: {original_slug}")

    def _collect_files(
        self,
        files_data: list[dict[str, Any]],
        dirs_data: list[dict[str, str]],
    ) -> list[dict[str, Any]]:
        """Collect and process file data from inline content, local_path, and dirs."""
        result = []

        for fd in files_data:
            file_info = self._process_file_input(fd)
            if file_info:
                result.append(file_info)

        for dd in dirs_data:
            scanned = scan_directory(
                dd["path"],
                allowed_dirs=self.config.allowed_dirs,
                ignored_dirs=self.config.ignored_dirs,
            )
            for sf in scanned:
                from pathlib import Path

                content = Path(sf.local_path).read_bytes()
                result.append({
                    "path": sf.path or sf.filename,
                    "filename": sf.filename,
                    "content_bytes": content,
                    "language": sf.language,
                    "is_binary": sf.is_binary,
                    "size": len(content),
                })

        return result

    def _process_file_input(self, fd: dict[str, Any]) -> dict[str, Any] | None:
        """Process a single file input dict."""
        from pathlib import Path

        path = fd.get("path")
        filename = fd.get("filename") or "untitled"

        # Content inline
        if "content" in fd and fd["content"] is not None:
            content = fd["content"]
            content_bytes = content.encode("utf-8") if isinstance(content, str) else content
            binary = is_binary_content(content_bytes)
            return {
                "path": path,
                "filename": filename,
                "content_bytes": content_bytes,
                "language": detect_language(filename) if not binary else None,
                "is_binary": binary,
                "size": len(content_bytes),
            }

        # Base64 content
        if "content_base64" in fd and fd["content_base64"] is not None:
            content_bytes = decode_base64_content(fd["content_base64"])
            return {
                "path": path,
                "filename": filename,
                "content_bytes": content_bytes,
                "language": None,
                "is_binary": True,
                "size": len(content_bytes),
            }

        # Local path reference
        if "local_path" in fd and fd["local_path"] is not None:
            resolved = validate_local_path(
                fd["local_path"],
                allowed_dirs=self.config.allowed_dirs,
                data_dir=self.config.data_dir,
            )
            content_bytes = resolved.read_bytes()
            binary = is_binary_content(content_bytes)
            return {
                "path": path,
                "filename": resolved.name if not path else filename,
                "content_bytes": content_bytes,
                "language": detect_language(resolved.name) if not binary else None,
                "is_binary": binary,
                "size": len(content_bytes),
            }

        return None

    def _validate_limits(self, files_info: list[dict[str, Any]]) -> None:
        """Validate resource limits before creating entry."""
        if len(files_info) > self.config.limits.max_entry_files:
            raise PayloadTooLargeError(
                f"Too many files: {len(files_info)} > {self.config.limits.max_entry_files}"
            )

        total_size = sum(f.get("size", 0) for f in files_info)
        if total_size > self.config.limits.max_entry_size:
            raise PayloadTooLargeError(
                f"Entry total size exceeded: {total_size} > {self.config.limits.max_entry_size}"
            )

        for f in files_info:
            if f.get("size", 0) > self.config.limits.max_file_size:
                raise PayloadTooLargeError(
                    f"File too large: {f['filename']} ({f['size']} > {self.config.limits.max_file_size})"
                )

    def _resolve_username(self, session: Session, owner_id: int | None) -> str | None:
        """Resolve username for an owner_id. Returns None for anonymous entries."""
        if owner_id is None:
            return None
        user = session.exec(select(User).where(User.id == owner_id)).first()
        return user.username if user else None

    def _build_response(self, entry: Entry, files: list[File], username: str | None = None) -> EntryResponse:
        """Build EntryResponse from Entry + File records."""
        file_responses = []
        for f in files:
            file_responses.append(
                FileResponse(
                    id=f.id,
                    path=f.path,
                    filename=f.filename,
                    language=f.language,
                    is_binary=f.is_binary,
                    size=f.size,
                    line_count=f.line_count,
                )
            )

        return EntryResponse(
            id=entry.id,
            slug=entry.slug,
            summary=entry.summary,
            status=entry.status,
            tags=entry.tags,
            files=file_responses,
            is_public=entry.is_public,
            owner_id=entry.owner_id,
            username=username,
            expires_at=entry.expires_at,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )

    def _get_share_service(self):
        from peekview.services.share_service import ShareService
        return ShareService(engine=self.engine, config=self.config)

    def get_entry_with_share(self, slug: str, share_token: str, share_service) -> tuple[EntryResponse, Any] | None:
        """Get entry with share token validation.

        Returns (EntryResponse, EntryShare) on success, None on failure.
        For share access, share_context is set in the response.
        """
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                return None

            if entry.is_public:
                return None

            now = datetime.now(timezone.utc)
            if entry.expires_at:
                entry_exp = entry.expires_at.replace(tzinfo=timezone.utc) if entry.expires_at.tzinfo is None else entry.expires_at
                if entry_exp <= now:
                    return None

            entry_share = share_service.verify_share_token(entry.id, share_token)
            if not entry_share:
                return None

            files = session.exec(
                select(File).where(File.entry_id == entry.id)
            ).all()

            username = self._resolve_username(session, entry.owner_id)
            shared_by = self._resolve_username(session, entry_share.created_by)

            response = self._build_response(entry, list(files), username)
            from peekview.models import EntryShareContext
            response.share_context = EntryShareContext(
                is_share_access=True,
                shared_by=shared_by,
            )
            return response, entry_share
