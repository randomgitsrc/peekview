"""Entry business logic — create, get, list, update, delete."""

from __future__ import annotations

import contextlib
import logging
import re
import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import exists, func, text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from peekview.config import PeekConfig
from peekview.database import FTS_CONTENT_MAX_PER_ENTRY, FTS_CONTENT_TRUNCATE
from peekview.exceptions import (
    ConflictError,
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
    EntryStar,
    EntryStatus,
    EntryTombstone,
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
from peekview.services.star_service import build_countdown, count_live_stars, find_live_star
from peekview.storage import StorageManager

logger = logging.getLogger(__name__)

# Slug format: lowercase alphanumeric, hyphens, underscores
SLUG_PATTERN = re.compile(r"^[a-z0-9_-]+$")


class EntryService:
    """Business logic for entry operations."""

    def __init__(
        self,
        engine,
        storage: StorageManager,
        config: PeekConfig,
        read_tracking_service=None,
        share_service=None,
    ):
        self.engine = engine
        self.storage = storage
        self.config = config
        self._read_tracking_service = read_tracking_service
        self._share_service = share_service

    def _update_fts_content(self, entry_id: int) -> None:
        """Aggregate text file content for an entry and update FTS content column.

        Called after create_entry and update_entry to keep FTS content in sync.
        """
        from peekview.text_utils import tokenize_for_fts

        with Session(self.engine) as session:
            entry = session.exec(select(Entry).where(Entry.id == entry_id)).first()
            if not entry:
                return

            files = session.exec(
                select(File).where(File.entry_id == entry_id, ~File.is_binary)
            ).all()

            content_parts: list[str] = []
            total_len = 0

            for f in files:
                try:
                    disk_path = self.storage.get_disk_path(entry_id, f.filename, f.path)
                    if disk_path and disk_path.exists():
                        raw = disk_path.read_bytes()
                        text_content = raw.decode("utf-8", errors="replace")[:FTS_CONTENT_TRUNCATE]
                        if total_len + len(text_content) > FTS_CONTENT_MAX_PER_ENTRY:
                            remaining = FTS_CONTENT_MAX_PER_ENTRY - total_len
                            if remaining > 0:
                                content_parts.append(text_content[:remaining])
                            break
                        content_parts.append(text_content)
                        total_len += len(text_content)
                except Exception:
                    continue

            aggregated = " ".join(content_parts)

            session.exec(text("DELETE FROM entries_fts WHERE rowid = :id").bindparams(id=entry_id))

            session.exec(
                text(
                    "INSERT INTO entries_fts(rowid, summary, tags, content) "
                    "VALUES (:id, :summary, :tags, :content)"
                ).bindparams(
                    id=entry_id,
                    summary=tokenize_for_fts(entry.summary),
                    tags=tokenize_for_fts(" ".join(entry.tags or [])),
                    content=tokenize_for_fts(aggregated),
                )
            )

            session.commit()

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
        idempotency_key: str | None = None,
    ) -> tuple[CreateEntryResponse, bool]:
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
            idempotency_key: Optional key for idempotent creation.

        Returns:
            Tuple of (CreateEntryResponse, is_idempotent).
        """
        if idempotency_key:
            existing = self._find_by_idempotency_key(idempotency_key)
            if existing:
                if existing.owner_id != current_user_id:
                    raise ConflictError("idempotency_key already used by another user")
                return existing, True
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
                raise InvalidSlugError(f"Slug must match [a-z0-9_-], got: {slug!r}")
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
            idempotency_key=idempotency_key,
        )

        try:
            with Session(self.engine) as session:
                session.add(entry)
                session.flush()
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
                                line_count = content.decode("utf-8").count("\n") + 1
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
                        with contextlib.suppress(OSError):
                            wp.unlink()
                    session.rollback()
                    raise

        except IntegrityError:
            if idempotency_key:
                existing = self._find_by_idempotency_key(idempotency_key)
                if existing:
                    if existing.owner_id != current_user_id:
                        raise ConflictError(
                            "idempotency_key already used by another user"
                        ) from None
                    return existing, True
            return self._retry_with_slug_suffix(
                summary,
                slug,
                tags,
                files_data,
                dirs_data,
                expires_in,
                is_public,
                current_user_id,
                idempotency_key,
            )

        self._update_fts_content(entry_id)

        return CreateEntryResponse(
            id=entry_id,
            slug=entry_slug,
            url=self.config.build_view_url(entry_slug),
            is_public=entry_is_public,
            owner_id=entry_owner_id,
            expires_at=expires_at,
            created_at=entry_created_at,
            files=file_responses,
        ), False

    def get_entry(
        self,
        slug: str,
        current_user_id: int | None = None,
        is_admin: bool = False,
        include_read_stats: bool = False,
    ) -> EntryResponse:
        """Get entry details by slug.

        Private entries are only visible to their owner (or admin).
        Returns 404 for non-owners of private entries (not 403, to prevent slug enumeration).
        """
        with Session(self.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            if entry.status == EntryStatus.ARCHIVED:
                # 决策 A：archived 可见性仅由「状态 + 星标」组成，与 is_public 解耦
                # （星标用户可读 archived 全文；短路 is_public 前置检查，BLOCKER-1）。
                # BLOCKER-4：显式匿名守卫——ownerless archived（owner_id IS NULL）下
                # 匿名请求必须 404（防 slug 枚举）。
                if not is_admin and current_user_id is None:
                    raise NotFoundError(f"Entry not found: {slug}")
                if (
                    not is_admin
                    and entry.owner_id != current_user_id
                    and not find_live_star(session, entry.id, current_user_id)
                ):
                    raise NotFoundError(f"Entry not found: {slug}")
            else:
                # 非 archived：is_public 可见性模型。N8：收紧 ownerless + 私有 active
                # + 匿名（None == None 短路）的既有可读漏洞。
                if (
                    not entry.is_public
                    and not is_admin
                    and (current_user_id is None or entry.owner_id != current_user_id)
                ):
                    raise NotFoundError(f"Entry not found: {slug}")

            files = session.exec(select(File).where(File.entry_id == entry.id)).all()

            # Resolve username for owner
            username = self._resolve_username(session, entry.owner_id)

            is_starred = (
                find_live_star(session, entry.id, current_user_id) is not None
                if current_user_id is not None
                else False
            )
            return self._build_response(
                entry,
                list(files),
                username,
                include_read_stats=include_read_stats,
                star_count=count_live_stars(session, entry.id),
                is_starred=is_starred,
            )

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
        starred: bool = False,
    ) -> EntryListResponse:
        """List entries with search, filter, pagination, and visibility.

        Anonymous users see only public entries.
        Logged-in users see public entries + their own private entries.
        Admin users see all entries.
        owner="me" filters to only entries owned by current_user_id.
        owner=<username> filters to entries owned by that user (case-insensitive).
        starred=True lists the current user's starred entries (active + archived,
        visibility is_public OR own OR archived — consistent with the read path).
        """
        per_page = min(per_page, self.config.limits.max_per_page)
        page = max(page, 1)
        offset = (page - 1) * per_page

        with Session(self.engine) as session:
            # Build query
            query = select(Entry)
            count_query = select(func.count()).select_from(Entry)

            # Status filter (default: show active, hide archived; owner sees own archived)
            # INFO-4: starred=True 与 status 互斥——starred 时忽略 status（与 owner 同处理）
            if status and not starred:
                query = query.where(Entry.status == status)
                count_query = count_query.where(Entry.status == status)
                if status == EntryStatus.ARCHIVED.value:
                    if is_admin:
                        pass
                    elif current_user_id:
                        query = query.where(Entry.owner_id == current_user_id)
                        count_query = count_query.where(Entry.owner_id == current_user_id)
                    else:
                        return EntryListResponse(
                            items=[],
                            total=0,
                            page=page,
                            per_page=per_page,
                        )
            elif not starred:
                query = query.where(Entry.status != EntryStatus.ARCHIVED)
                count_query = count_query.where(Entry.status != EntryStatus.ARCHIVED)

            # === Phase 1: Resolve owner to user_id ===
            # owner_found tri-state: None (N/A or "me") | True (user exists) | False (user not found)
            owner_found = None
            owner_user_id = None

            # Starred filter is mutually exclusive with owner/status (frontend
            # Starred tab semantics) — skip owner resolution entirely.
            if owner is not None and not starred:
                if owner == "me":
                    if current_user_id is None:
                        return EntryListResponse(
                            items=[],
                            total=0,
                            page=page,
                            per_page=per_page,
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
                            items=[],
                            total=0,
                            page=page,
                            per_page=per_page,
                            owner_found=False,
                        )

            # === Phase 2: Apply owner filter to query ===
            if owner_user_id is not None:
                query = query.where(Entry.owner_id == owner_user_id)
                count_query = count_query.where(Entry.owner_id == owner_user_id)

            # === Phase 3: Apply visibility filter (existing logic, unchanged) ===
            if starred:
                # Starred list requires login; visibility = public OR own OR archived
                # (decision A read criterion), scoped to the user's live stars.
                if current_user_id is None:
                    return EntryListResponse(
                        items=[],
                        total=0,
                        page=page,
                        per_page=per_page,
                        owner_found=owner_found,
                    )
                starred_cond = (
                    Entry.is_public.is_(True)
                    | (Entry.owner_id == current_user_id)
                    | (Entry.status == EntryStatus.ARCHIVED)
                )
                query = query.where(starred_cond)
                count_query = count_query.where(starred_cond)
                live_star = exists(
                    select(1)
                    .select_from(EntryStar)
                    .where(
                        EntryStar.entry_id == Entry.id,
                        EntryStar.user_id == current_user_id,
                        EntryStar.tombstone_id.is_(None),
                    )
                )
                query = query.where(live_star)
                count_query = count_query.where(live_star)
            elif is_admin:
                pass
            elif current_user_id is None:
                query = query.where(Entry.is_public.is_(True))
                count_query = count_query.where(Entry.is_public.is_(True))
            else:
                query = query.where(Entry.is_public.is_(True) | (Entry.owner_id == current_user_id))
                count_query = count_query.where(
                    Entry.is_public.is_(True) | (Entry.owner_id == current_user_id)
                )

            # Tags filter — use json_each for exact match (fixes non-ASCII tag filtering)
            if tags:
                for tag in tags:
                    tag_filter = text(
                        "EXISTS (SELECT 1 FROM json_each(entries.tags) WHERE json_each.value = :tag)"
                    ).bindparams(tag=tag)
                    query = query.where(tag_filter)
                    count_query = count_query.where(tag_filter)

            # FTS5 search
            if q and q.strip():
                from peekview.text_utils import tokenize_query

                tokenized = tokenize_query(q)
                if tokenized:
                    safe_q = tokenized.replace('"', '""').replace("'", "''")
                    try:
                        fts_result = session.exec(
                            text("SELECT rowid FROM entries_fts WHERE entries_fts MATCH :q"),
                            params={"q": safe_q},
                        )
                        fts_ids = [row[0] for row in fts_result]
                        if fts_ids:
                            query = query.where(Entry.id.in_(fts_ids))
                            count_query = count_query.where(Entry.id.in_(fts_ids))
                        else:
                            return EntryListResponse(
                                items=[],
                                total=0,
                                page=page,
                                per_page=per_page,
                                owner_found=owner_found,
                            )
                    except Exception:
                        pass

            # Order by created_at desc
            query = query.order_by(Entry.created_at.desc())

            total = session.exec(count_query).one()
            entries = session.exec(query.offset(offset).limit(per_page)).all()

            # Batch resolve usernames (solve N+1 problem)
            owner_ids = [e.owner_id for e in entries if e.owner_id is not None]
            username_map = {}
            if owner_ids:
                users = session.exec(select(User).where(User.id.in_(set(owner_ids)))).all()
                username_map = {u.id: u.username for u in users}

            # INFO-2/F8: batch star_count + is_starred for the current page
            # (replaces per-row count_live_stars/find_live_star → 3 queries/row)
            entry_ids = [e.id for e in entries]
            star_count_map: dict[int, int] = {}
            starred_ids: set[int] = set()
            if entry_ids:
                star_rows = session.exec(
                    select(EntryStar.entry_id, func.count())
                    .where(
                        EntryStar.entry_id.in_(entry_ids),
                        EntryStar.tombstone_id.is_(None),
                    )
                    .group_by(EntryStar.entry_id)
                ).all()
                star_count_map = dict(star_rows)
                if current_user_id is not None:
                    starred_rows = session.exec(
                        select(EntryStar.entry_id).where(
                            EntryStar.entry_id.in_(entry_ids),
                            EntryStar.user_id == current_user_id,
                            EntryStar.tombstone_id.is_(None),
                        )
                    ).all()
                    starred_ids = set(starred_rows)

            items = []
            for e in entries:
                # Get file count
                file_count = session.exec(
                    select(func.count()).select_from(File).where(File.entry_id == e.id)
                ).one()
                username = username_map.get(e.owner_id) if e.owner_id else None
                is_starred = e.id in starred_ids if current_user_id is not None else False
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
                        archived_at=e.archived_at,
                        created_at=e.created_at,
                        updated_at=e.updated_at,
                        star_count=star_count_map.get(e.id, 0),
                        is_starred=is_starred,
                        countdown=build_countdown(e, is_starred=is_starred),
                    )
                )

        return EntryListResponse(
            items=items,
            total=total,
            page=page,
            per_page=per_page,
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
        expires_in: str | None = None,
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
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            # Global API key bypasses ownership checks
            if not is_api_key_auth:
                # Visibility + ownership check
                if not entry.is_public and not is_admin and entry.owner_id != current_user_id:
                    raise NotFoundError(f"Entry not found: {slug}")
                if not is_admin and entry.owner_id != current_user_id:
                    raise NotFoundError(f"Entry not found: {slug}")

            # Archived access control: non-owner non-admin cannot update archived
            if entry.status == EntryStatus.ARCHIVED:  # noqa: SIM102
                if not is_admin and entry.owner_id != current_user_id:
                    raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id

            was_private = not entry.is_public

            # Handle expires_in (reactivate archived or update active expiry)
            if expires_in is not None:
                delta = parse_expires_in(expires_in)
                if entry.status == EntryStatus.ARCHIVED:
                    entry.status = EntryStatus.ACTIVE
                    entry.archived_at = None
                    entry.archive_delete_at = None  # N2: reactivation clears countdown
                    if delta is not None:
                        entry.expires_at = datetime.now(timezone.utc) + delta
                    else:
                        entry.expires_at = None
                else:
                    if delta is not None:
                        entry.expires_at = datetime.now(timezone.utc) + delta
                    else:
                        entry.expires_at = None

            # Update fields
            if summary is not None:
                entry.summary = summary.strip()
            if status is not None:
                entry.status = status
                if entry.status == EntryStatus.ACTIVE:
                    entry.archive_delete_at = None  # N2: status-param reactivation
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

            self._update_fts_content(entry_id)

            # Get all remaining files
            files = session.exec(select(File).where(File.entry_id == entry.id)).all()

            response = self._build_response(entry, list(files))
            if revoked_shares is not None:
                response.revoked_shares = revoked_shares
            return response

    def delete_entry(
        self,
        slug: str,
        current_user_id: int | None = None,
        is_api_key_auth: bool = False,
        allow_local: bool = False,
        is_admin: bool = False,
    ) -> None:
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
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
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
            actor = session.get(User, current_user_id)
            deleted_by = actor.username if actor else "unknown"
            self._delete_with_tombstone(session, entry, deleted_by)

        self._cleanup_reads(entry_id)
        self.storage.delete_entry_files(entry_id)

    def delete_entry_by_api_key(self, slug: str) -> None:
        """Delete entry via API Key (service-level auth).

        This bypasses owner checks — API Key holders can delete any entry,
        including owner_id=NULL legacy entries.
        """
        with Session(self.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                raise NotFoundError(f"Entry not found: {slug}")

            entry_id = entry.id
            # API-key/cleanup path has no user → snapshot the owner's username
            # (D8: deleted_by = author identity).
            deleted_by = self._resolve_username(session, entry.owner_id) or "unknown"
            self._delete_with_tombstone(session, entry, deleted_by)

        self._cleanup_reads(entry_id)
        self.storage.delete_entry_files(entry_id)

    def _delete_with_tombstone(self, session: Session, entry: Entry, deleted_by: str) -> None:
        """Delete an entry inside the given session (same transaction).

        If the entry has ≥1 live star, create an EntryTombstone (reason
        author_deleted) and bind all live stars to it via tombstone_id before
        deleting the entry row. EntryStar has no relationship to Entry (plain
        integer entry_id) so stars survive the deletion; tombstones stay until
        the last referencing star is removed.
        """
        entry_id = entry.id
        live_stars = session.exec(
            select(EntryStar).where(
                EntryStar.entry_id == entry_id,
                EntryStar.tombstone_id.is_(None),
            )
        ).all()

        if live_stars:
            tombstone = EntryTombstone(
                entry_id=entry_id,
                slug=entry.slug,
                title=entry.summary,
                cover=None,
                deleted_by=deleted_by,
                deleted_at=datetime.now(timezone.utc),
                reason="author_deleted",
            )
            session.add(tombstone)
            session.flush()  # obtain tombstone.id for binding
            for star in live_stars:
                star.tombstone_id = tombstone.id
                session.add(star)

        session.delete(entry)
        session.commit()

    def _cleanup_reads(self, entry_id: int) -> None:
        from peekview.models import EntryRead

        with Session(self.engine) as session:
            for r in session.exec(select(EntryRead).where(EntryRead.entry_id == entry_id)).all():
                session.delete(r)
            session.commit()

    def _find_by_idempotency_key(self, key: str) -> CreateEntryResponse | None:
        with Session(self.engine) as session:
            entry = session.exec(select(Entry).where(Entry.idempotency_key == key)).first()
            if not entry:
                return None
            files = session.exec(select(File).where(File.entry_id == entry.id)).all()
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
                for f in files
            ]
            return CreateEntryResponse(
                id=entry.id,
                slug=entry.slug,
                url=self.config.build_view_url(entry.slug),
                is_public=entry.is_public,
                owner_id=entry.owner_id,
                expires_at=entry.expires_at,
                created_at=entry.created_at,
                files=file_responses,
            )

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
        idempotency_key: str | None = None,
    ) -> tuple[CreateEntryResponse, bool]:
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
                    idempotency_key=idempotency_key,
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
                result.append(
                    {
                        "path": sf.path or sf.filename,
                        "filename": sf.filename,
                        "content_bytes": content,
                        "language": sf.language,
                        "is_binary": sf.is_binary,
                        "size": len(content),
                    }
                )

        return result

    def _process_file_input(self, fd: dict[str, Any]) -> dict[str, Any] | None:
        """Process a single file input dict."""

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

    def _build_response(
        self,
        entry: Entry,
        files: list[File],
        username: str | None = None,
        include_read_stats: bool = False,
        star_count: int = 0,
        is_starred: bool = False,
    ) -> EntryResponse:
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

        read_stats = None
        if include_read_stats:
            tracking_service = self._read_tracking_service
            if tracking_service is None:
                from peekview.services.read_tracking_service import ReadTrackingService

                tracking_service = ReadTrackingService(self.engine)
            read_stats = tracking_service.get_read_stats(entry.id)

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
            archived_at=entry.archived_at,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
            read_stats=read_stats,
            star_count=star_count,
            is_starred=is_starred,
            countdown=build_countdown(entry, is_starred=is_starred),
        )

    def _get_share_service(self):
        if self._share_service is not None:
            return self._share_service
        from peekview.services.share_service import ShareService

        return ShareService(self.engine, self.config)

    def get_entry_with_share(
        self, slug: str, share_token: str, share_service
    ) -> tuple[EntryResponse, Any] | None:
        """Get entry with share token validation.

        Returns (EntryResponse, EntryShare) on success, None on failure.
        For share access, share_context is set in the response.
        """
        with Session(self.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug)).first()
            if not entry:
                return None

            if entry.is_public:
                return None

            now = datetime.now(timezone.utc)
            if entry.expires_at:
                entry_exp = (
                    entry.expires_at.replace(tzinfo=timezone.utc)
                    if entry.expires_at.tzinfo is None
                    else entry.expires_at
                )
                if entry_exp <= now:
                    return None

            entry_share = share_service.verify_share_token(entry.id, share_token)
            if not entry_share:
                return None

            files = session.exec(select(File).where(File.entry_id == entry.id)).all()

            username = self._resolve_username(session, entry.owner_id)
            shared_by = self._resolve_username(session, entry_share.created_by)

            response = self._build_response(entry, list(files), username)
            from peekview.models import EntryShareContext

            response.share_context = EntryShareContext(
                is_share_access=True,
                shared_by=shared_by,
            )
            return response, entry_share

    def get_file_record(self, entry_id: int, file_id: int) -> File | None:
        """Query a file record by entry_id and file_id."""
        with Session(self.engine) as session:
            return session.exec(
                select(File).where(File.id == file_id, File.entry_id == entry_id)
            ).first()

    def read_file_content(self, entry_id: int, filename: str, path: str | None) -> bytes:
        """Read file content from disk via storage."""
        return self.storage.read_file(entry_id, filename, path)

    def get_entry_record(self, entry_id: int) -> Entry | None:
        """Query an entry record by ID."""
        with Session(self.engine) as session:
            return session.exec(select(Entry).where(Entry.id == entry_id)).first()

    def get_entry_by_slug(self, slug: str) -> Entry | None:
        """Query an entry record by slug."""
        with Session(self.engine) as session:
            return session.exec(select(Entry).where(Entry.slug == slug)).first()

    def get_entry_files(self, entry_id: int) -> list[File]:
        """Query all files for an entry."""
        with Session(self.engine) as session:
            return list(session.exec(select(File).where(File.entry_id == entry_id)).all())

    def get_files_by_ids(self, entry_id: int, file_ids: list[int]) -> list[File]:
        """Query files by IDs within an entry."""
        with Session(self.engine) as session:
            return list(
                session.exec(
                    select(File).where(
                        File.id.in_(file_ids),
                        File.entry_id == entry_id,
                    )
                ).all()
            )
