"""Admin service — system statistics, cleanup, backup, export, and restore operations."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import tarfile
import tempfile
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from packaging.version import Version
from sqlalchemy import case, func, text
from sqlmodel import Session, select

from peekview.auth import SECRET_KEY_FILE, _load_or_generate_secret_key, hash_password
from peekview.config import CONFIG_FILE, PeekConfig
from peekview.database import init_db, rebuild_fts_index
from peekview.exceptions import NotFoundError
from peekview.models import (
    AdminCleanupResponse,
    AdminStatsResponse,
    ApiKey,
    ApiKeyStats,
    BackupMetadata,
    ConflictInfo,
    Entry,
    EntryRead,
    EntryShare,
    EntryStats,
    File,
    RestorePreview,
    RestoreResult,
    StorageStats,
    User,
    UserResponse,
)
from peekview.services.entry_service import EntryService
from peekview.storage import StorageManager


def _get_dir_size(path: Path) -> int:
    total = 0
    try:
        for entry in os.scandir(path):
            if entry.is_file(follow_symlinks=False):
                total += entry.stat(follow_symlinks=False).st_size
            elif entry.is_dir(follow_symlinks=False):
                total += _get_dir_size(entry.path)
    except OSError:
        pass
    return total


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _check_no_symlinks(directory: Path) -> None:
    for root, dirs, files in os.walk(directory, followlinks=False):
        for name in dirs + files:
            full = Path(root) / name
            if full.is_symlink():
                raise ValueError(f"Symlink found in backup data: {full.relative_to(directory)}")


def _get_config_dir(config: PeekConfig) -> Path:
    return config.db_path.parent


def _read_config_file_for_backup(config: PeekConfig) -> bytes | None:
    config_dir = _get_config_dir(config)
    for candidate in [config_dir / "config.yaml", CONFIG_FILE]:
        if candidate.exists():
            return candidate.read_bytes()
    return None


def _read_secret_key_for_backup(config: PeekConfig) -> bytes | None:
    config_dir = _get_config_dir(config)
    for candidate in [config_dir / ".secret_key", SECRET_KEY_FILE]:
        if candidate.exists():
            return candidate.read_bytes()
    key = _load_or_generate_secret_key(config.auth.secret_key)
    return key.encode("utf-8")


def _read_captcha_secret_for_backup(config: PeekConfig) -> bytes | None:
    config_dir = _get_config_dir(config)
    captcha_path = config_dir / ".captcha_secret"
    if captcha_path.exists():
        return captcha_path.read_bytes()
    home_captcha = Path.home() / ".peekview" / ".captcha_secret"
    if home_captcha.exists():
        return home_captcha.read_bytes()
    return None


class AdminService:
    def __init__(self, engine, storage: StorageManager, config: PeekConfig):
        self.engine = engine
        self.storage = storage
        self.config = config

    def get_stats(self) -> AdminStatsResponse:
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)

        with Session(self.engine) as session:
            result = session.exec(
                select(
                    func.count(Entry.id).label("total"),
                    func.count(case((Entry.is_public, 1))).label("public"),
                    func.count(case((not Entry.is_public, 1))).label("private"),
                    func.count(
                        case(
                            (
                                (Entry.expires_at is not None)
                                & (Entry.expires_at <= now_naive),
                                1,
                            ),
                        )
                    ).label("expired"),
                )
            ).one()

            total, public, private, expired = result
            active = total - expired

            latest_created_at = session.exec(
                select(func.max(Entry.created_at))
            ).one()

            user_count = session.exec(select(func.count(User.id))).one()

            key_total = session.exec(select(func.count(ApiKey.id))).one()
            key_expired = session.exec(
                select(func.count(ApiKey.id)).where(
                    ApiKey.expires_at is not None,
                    ApiKey.expires_at <= now_naive,
                )
            ).one()

        data_dir_bytes = _get_dir_size(self.config.data_dir)
        data_dir_mb = round(data_dir_bytes / (1024 * 1024), 2)

        db_mb = 0.0
        db_path = self.config.db_path
        if db_path.exists():
            db_mb = round(db_path.stat().st_size / (1024 * 1024), 2)

        return AdminStatsResponse(
            users=user_count,
            entries=EntryStats(
                total=total,
                public=public,
                private=private,
                expired=expired,
                active=active,
                latest_created_at=latest_created_at,
            ),
            api_keys=ApiKeyStats(
                total=key_total,
                expired=key_expired,
            ),
            storage=StorageStats(
                data_dir_mb=data_dir_mb,
                db_mb=db_mb,
            ),
        )

    def cleanup_expired(self) -> AdminCleanupResponse:
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        retention_days = self.config.cleanup.archive_retention_days

        with Session(self.engine) as session:
            expired = session.exec(
                select(Entry).where(
                    Entry.expires_at is not None,
                    Entry.expires_at <= now_naive,
                    Entry.status == "active",
                )
            ).all()

            archived_slugs = []
            for e in expired:
                e.status = "archived"
                e.archived_at = now_naive
                e.expires_at = None
                session.add(e)
                archived_slugs.append(e.slug)
            session.commit()

            deleted_slugs = []
            total_freed = 0
            to_delete = []

            if retention_days > 0:
                cutoff = now_naive - timedelta(days=retention_days)
                old_archived = session.exec(
                    select(Entry).where(
                        Entry.status == "archived",
                        Entry.archived_at is not None,
                        Entry.archived_at <= cutoff,
                    )
                ).all()

                for e in old_archived:
                    size_bytes = self.storage.get_entry_size(e.id)
                    to_delete.append((e.slug, e.id, size_bytes))

        entry_service = EntryService(
            engine=self.engine, storage=self.storage, config=self.config
        )

        for slug, _entry_id, size_bytes in to_delete:
            try:
                entry_service.delete_entry_by_api_key(slug)
                deleted_slugs.append(slug)
                total_freed += size_bytes
            except NotFoundError:
                pass

        return AdminCleanupResponse(
            archived_count=len(archived_slugs),
            archived_slugs=archived_slugs,
            deleted_count=len(deleted_slugs),
            deleted_slugs=deleted_slugs,
            freed_mb=round(total_freed / (1024 * 1024), 2),
        )

    def list_users(
        self, username: str | None = None, page: int = 1, per_page: int = 20
    ) -> list[UserResponse]:
        with Session(self.engine) as session:
            query = select(User)
            if username is not None:
                query = query.where(User.username == username)
            query = query.order_by(User.id).offset((page - 1) * per_page).limit(per_page)
            users = session.exec(query).all()
            return [
                UserResponse(
                    id=u.id,
                    username=u.username,
                    display_name=u.display_name,
                    is_active=u.is_active,
                    is_admin=u.is_admin,
                    created_at=u.created_at,
                )
                for u in users
            ]

    def delete_user(self, user_id: int, current_user_id: int) -> None:
        if user_id == current_user_id:
            raise ValueError("Cannot delete yourself")
        with Session(self.engine) as session:
            user = session.get(User, user_id)
            if not user:
                raise NotFoundError(f"User {user_id} not found")
            entry_slugs = [
                e.slug
                for e in session.exec(select(Entry).where(Entry.owner_id == user_id)).all()
            ]
        entry_service = EntryService(
            engine=self.engine, storage=self.storage, config=self.config
        )
        for slug in entry_slugs:
            try:
                entry_service.delete_entry(slug, is_api_key_auth=True)
            except NotFoundError:
                pass
        with Session(self.engine) as session:
            from sqlalchemy import delete as sa_delete
            session.exec(sa_delete(ApiKey).where(ApiKey.user_id == user_id))
            user = session.get(User, user_id)
            if user:
                session.delete(user)
            session.commit()

    def reset_password(self, user_id: int, new_password: str) -> str:
        with Session(self.engine) as session:
            user = session.get(User, user_id)
            if not user:
                raise NotFoundError(f"User {user_id} not found")
            user.password_hash = hash_password(new_password)
            session.add(user)
            session.commit()
        return new_password

    def backup(self, output_path: Path | None = None) -> Path:
        from peekview import __version__

        if output_path is None:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            output_path = Path(f"peekview-backup-{timestamp}.tar.gz")

        output_path.parent.mkdir(parents=True, exist_ok=True)

        staging = tempfile.mkdtemp(prefix="peekview-backup-")
        try:
            staging_path = Path(staging)

            db_dest = staging_path / "peekview.db"
            source_conn = self.engine.raw_connection()
            try:
                dest_conn = sqlite3.connect(str(db_dest))
                source_conn.backup(dest_conn)
                dest_conn.close()
            finally:
                source_conn.close()

            data_default = self.config.data_dir / "default"
            if data_default.exists():
                for entry_dir in data_default.iterdir():
                    if entry_dir.is_dir():
                        dest_entry_dir = staging_path / "data" / "default" / entry_dir.name
                        shutil.copytree(entry_dir, dest_entry_dir)

            config_data = _read_config_file_for_backup(self.config)
            if config_data is not None:
                (staging_path / "config.yaml").write_bytes(config_data)
            else:
                (staging_path / "config.yaml").write_text(
                    f"# PeekView config (auto-generated by backup v{__version__})\n"
                )

            secret_data = _read_secret_key_for_backup(self.config)
            if secret_data is not None:
                (staging_path / ".secret_key").write_bytes(secret_data)

            captcha_data = _read_captcha_secret_for_backup(self.config)
            if captcha_data is not None:
                (staging_path / ".captcha_secret").write_bytes(captcha_data)

            checksums: dict[str, str] = {}
            for f in staging_path.rglob("*"):
                if f.is_file() and f.name != "metadata.json":
                    rel = f.relative_to(staging_path)
                    checksums[str(rel)] = _sha256_file(f)

            metadata = BackupMetadata(
                version=__version__,
                timestamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                file_checksums=checksums,
            )
            (staging_path / "metadata.json").write_text(
                json.dumps(metadata.model_dump(), indent=2)
            )

            tmp_output = output_path.with_suffix(".tar.gz.tmp")
            with tarfile.open(str(tmp_output), "w:gz") as tar:
                for f in sorted(staging_path.rglob("*")):
                    if f.is_file():
                        tar.add(str(f), arcname=str(f.relative_to(staging_path)))
            tmp_output.rename(output_path)

        finally:
            shutil.rmtree(staging, ignore_errors=True)

        return output_path

    def export_entry(
        self, slug: str, fmt: str = "json", output_path: Path | None = None
    ) -> str | Path:
        with Session(self.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == slug)
            ).first()
            if not entry:
                raise NotFoundError(f"Entry '{slug}' not found")

            files = session.exec(
                select(File).where(File.entry_id == entry.id)
            ).all()

            owner = None
            if entry.owner_id:
                owner = session.get(User, entry.owner_id)

        entry_data = {
            "slug": entry.slug,
            "summary": entry.summary,
            "status": entry.status.value if hasattr(entry.status, "value") else entry.status,
            "tags": entry.tags or [],
            "is_public": entry.is_public,
            "owner_id": entry.owner_id,
            "username": owner.username if owner else None,
            "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
            "updated_at": entry.updated_at.isoformat() if entry.updated_at else None,
        }

        files_data = []
        for f in files:
            file_dict: dict[str, object] = {
                "filename": f.filename,
                "path": f.path,
                "language": f.language,
                "is_binary": f.is_binary,
                "size": f.size,
                "sha256": f.sha256,
            }
            try:
                content = self.storage.read_file(entry.id, f.filename, f.path)
                if f.is_binary:
                    file_dict["content_base64"] = base64.b64encode(content).decode("ascii")
                else:
                    file_dict["content"] = content.decode("utf-8", errors="replace")
            except Exception:
                pass
            files_data.append(file_dict)

        if not files_data:
            summary_content = entry.summary.encode("utf-8")
            files_data.append({
                "filename": "summary.txt",
                "path": "summary.txt",
                "language": "text",
                "is_binary": False,
                "size": len(summary_content),
                "sha256": _sha256_bytes(summary_content),
                "content": entry.summary,
            })

        if fmt == "json":
            return json.dumps({"entry": entry_data, "files": files_data}, indent=2)

        if output_path is None:
            output_path = Path(f"{slug}.zip")

        output_path.parent.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(str(output_path), "w", zipfile.ZIP_DEFLATED) as zf:
            entry_json = json.dumps({"entry": entry_data, "files": [
                {k: v for k, v in fd.items() if k not in ("content", "content_base64")}
                for fd in files_data
            ]}, indent=2)
            zf.writestr(f"{slug}/entry.json", entry_json)

            for f in files:
                try:
                    content = self.storage.read_file(entry.id, f.filename, f.path)
                    arc_name = f"{slug}/{f.path or f.filename}"
                    zf.writestr(arc_name, content)
                except Exception:
                    pass

            if not files:
                zf.writestr(f"{slug}/summary.txt", entry.summary)

        return output_path

    def restore(
        self,
        backup_path: Path,
        dry_run: bool = False,
        replace: bool = False,
        yes: bool = False,
    ) -> RestorePreview | RestoreResult:
        from peekview import __version__

        staging = tempfile.mkdtemp(prefix="peekview-restore-")
        try:
            staging_path = Path(staging)

            with tarfile.open(str(backup_path), "r:gz") as tar:
                if sys.version_info >= (3, 12):
                    tar.extractall(path=staging_path, filter="data")
                else:
                    tar.extractall(path=staging_path)
                    for member in tar.getmembers():
                        member_path = (staging_path / member.name).resolve()
                        if not str(member_path).startswith(str(staging_path.resolve())):
                            raise ValueError(f"Path traversal in backup: {member.name}")

            _check_no_symlinks(staging_path)

            metadata_file = staging_path / "metadata.json"
            if not metadata_file.exists():
                for sub in staging_path.iterdir():
                    if sub.is_dir():
                        candidate = sub / "metadata.json"
                        if candidate.exists():
                            staging_path = sub
                            metadata_file = candidate
                            break

            if not metadata_file.exists():
                raise ValueError("Invalid backup: metadata.json not found")

            metadata = json.loads(metadata_file.read_text())

            checksums = metadata.get("file_checksums", {})
            for rel_path, expected_sha in checksums.items():
                actual_path = staging_path / rel_path
                if not actual_path.exists():
                    raise ValueError(
                        f"Backup integrity check failed: {rel_path} missing"
                    )
                actual_sha = _sha256_file(actual_path)
                if actual_sha != expected_sha:
                    raise ValueError(
                        f"Backup integrity check failed: checksum mismatch for {rel_path}"
                    )

            backup_version = metadata.get("version", "0.0.0")
            current_version = __version__
            try:
                bv = Version(backup_version)
                cv = Version(current_version)
            except Exception:
                bv = Version("0.0.0")
                cv = Version(current_version)

            version_check = "compatible"
            if bv > cv:
                raise ValueError(
                    f"Backup version {backup_version} is higher than current version {current_version}. "
                    f"Cannot restore from a newer version."
                )
            elif bv < cv:
                version_check = "downgrade_warning"

            backup_db_path = staging_path / "peekview.db"
            if not backup_db_path.exists():
                raise ValueError("Invalid backup: peekview.db not found")

            backup_conn = sqlite3.connect(str(backup_db_path))
            backup_conn.row_factory = sqlite3.Row

            try:
                entry_count = (backup_conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
                               if _table_exists(backup_conn, "entries") else 0)
                user_count = (backup_conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
                              if _table_exists(backup_conn, "users") else 0)
                api_key_count = (backup_conn.execute("SELECT COUNT(*) FROM api_keys").fetchone()[0]
                                 if _table_exists(backup_conn, "api_keys") else 0)
                share_count = (backup_conn.execute("SELECT COUNT(*) FROM entry_shares").fetchone()[0]
                               if _table_exists(backup_conn, "entry_shares") else 0)
                read_count = (backup_conn.execute("SELECT COUNT(*) FROM entry_reads").fetchone()[0]
                              if _table_exists(backup_conn, "entry_reads") else 0)

                conflicts = self._detect_conflicts(backup_conn)

                preview = RestorePreview(
                    entry_count=entry_count,
                    user_count=user_count,
                    api_key_count=api_key_count,
                    share_count=share_count,
                    read_count=read_count,
                    conflicts=conflicts,
                    version_check=version_check,
                )

                if dry_run:
                    return preview

                if replace:
                    return self._restore_replace(staging_path, backup_conn, version_check)
                else:
                    return self._restore_merge(staging_path, backup_conn, version_check, conflicts)

            finally:
                backup_conn.close()

        finally:
            shutil.rmtree(staging, ignore_errors=True)

    def _detect_conflicts(self, backup_conn: sqlite3.Connection) -> list[ConflictInfo]:
        conflicts = []

        with Session(self.engine) as session:
            existing_usernames = set(session.exec(select(User.username)).all())
            existing_slugs = set(session.exec(select(Entry.slug)).all())
            existing_key_hashes = set(session.exec(select(ApiKey.key_hash)).all())

        if _table_exists(backup_conn, "users"):
            for row in backup_conn.execute("SELECT id, username FROM users"):
                if row["username"] in existing_usernames:
                    conflicts.append(ConflictInfo(
                        type="username", value=row["username"], backup_id=row["id"]
                    ))

        if _table_exists(backup_conn, "entries"):
            for row in backup_conn.execute("SELECT id, slug FROM entries"):
                if row["slug"] in existing_slugs:
                    conflicts.append(ConflictInfo(
                        type="slug", value=row["slug"], backup_id=row["id"]
                    ))

        if _table_exists(backup_conn, "api_keys"):
            for row in backup_conn.execute("SELECT id, key_hash FROM api_keys"):
                if row["key_hash"] in existing_key_hashes:
                    conflicts.append(ConflictInfo(
                        type="key_hash", value=row["key_hash"], backup_id=row["id"]
                    ))

        return conflicts

    def _restore_merge(
        self,
        staging_path: Path,
        backup_conn: sqlite3.Connection,
        version_check: str,
        conflicts: list[ConflictInfo],
    ) -> RestoreResult:
        user_map: dict[int, int] = {}
        entry_map: dict[int, int] = {}
        file_map: dict[int, int] = {}
        share_map: dict[int, int] = {}
        conflicts_resolved = 0
        users_imported = 0
        entries_imported = 0
        files_imported = 0
        api_keys_imported = 0
        shares_imported = 0
        reads_imported = 0

        with Session(self.engine) as session:
            try:
                existing_usernames = dict(
                    session.exec(select(User.username, User.id)).all()
                )
                existing_slugs = set(session.exec(select(Entry.slug)).all())
                existing_key_hashes = set(session.exec(select(ApiKey.key_hash)).all())
                existing_window_keys = set()
                if _table_exists_raw(session, "entry_reads"):
                    existing_window_keys = set(session.exec(select(EntryRead.window_key)).all())

                if _table_exists(backup_conn, "users"):
                    for row in backup_conn.execute("SELECT * FROM users"):
                        old_id = row["id"]
                        username = row["username"]
                        if username in existing_usernames:
                            user_map[old_id] = existing_usernames[username]
                            conflicts_resolved += 1
                        else:
                            new_user = User(
                                username=username,
                                password_hash=_row_get(row, "password_hash", ""),
                                display_name=_row_get(row, "display_name"),
                                is_active=bool(_row_get(row, "is_active", 1)),
                                is_admin=bool(_row_get(row, "is_admin", 0)),
                            )
                            session.add(new_user)
                            session.flush()
                            user_map[old_id] = new_user.id
                            users_imported += 1

                if _table_exists(backup_conn, "entries"):
                    for row in backup_conn.execute("SELECT * FROM entries"):
                        old_id = row["id"]
                        slug = row["slug"]
                        owner_id = _row_get(row, "owner_id")

                        remapped_owner = user_map.get(owner_id) if owner_id else None

                        if slug in existing_slugs:
                            n = 1
                            new_slug = f"{slug}-{n}"
                            while new_slug in existing_slugs:
                                n += 1
                                new_slug = f"{slug}-{n}"
                            slug = new_slug
                            conflicts_resolved += 1

                        raw_tags = _row_get(row, "tags", "[]")
                        if isinstance(raw_tags, str):
                            tags_val = json.loads(raw_tags) if raw_tags else []
                        elif isinstance(raw_tags, (list, type(None))):
                            tags_val = raw_tags or []
                        else:
                            tags_val = []

                        raw_status = _row_get(row, "status", "active")
                        if isinstance(raw_status, str) and raw_status.upper() == "ACTIVE":
                            raw_status = "active"

                        new_entry = Entry(
                            slug=slug,
                            summary=_row_get(row, "summary", ""),
                            status=raw_status,
                            tags=tags_val,
                            is_public=bool(_row_get(row, "is_public", 1)),
                            owner_id=remapped_owner,
                            expires_at=_parse_db_datetime(_row_get(row, "expires_at")),
                        )
                        session.add(new_entry)
                        session.flush()
                        entry_map[old_id] = new_entry.id
                        existing_slugs.add(slug)
                        entries_imported += 1

                if _table_exists(backup_conn, "files"):
                    for row in backup_conn.execute("SELECT * FROM files"):
                        old_id = row["id"]
                        entry_id = _row_get(row, "entry_id")
                        if entry_id is None or entry_id not in entry_map:
                            continue

                        new_file = File(
                            entry_id=entry_map[entry_id],
                            path=_row_get(row, "path"),
                            filename=_row_get(row, "filename", "unknown"),
                            language=_row_get(row, "language"),
                            is_binary=bool(_row_get(row, "is_binary", 0)),
                            size=_row_get(row, "size", 0),
                            sha256=_row_get(row, "sha256"),
                        )
                        session.add(new_file)
                        session.flush()
                        file_map[old_id] = new_file.id
                        files_imported += 1

                if _table_exists(backup_conn, "entry_shares"):
                    for row in backup_conn.execute("SELECT * FROM entry_shares"):
                        old_id = _row_get(row, "id")
                        entry_id = _row_get(row, "entry_id")
                        created_by = _row_get(row, "created_by")

                        if entry_id is None or entry_id not in entry_map:
                            continue

                        new_share = EntryShare(
                            entry_id=entry_map[entry_id],
                            token_hash=_row_get(row, "token_hash", ""),
                            token_prefix=_row_get(row, "token_prefix", ""),
                            expires_at=_parse_db_datetime(_row_get(row, "expires_at")),
                            max_views=_row_get(row, "max_views"),
                            view_count=_row_get(row, "view_count", 0),
                            created_by=user_map.get(created_by, created_by) if created_by else created_by,
                        )
                        session.add(new_share)
                        session.flush()
                        if old_id is not None:
                            share_map[old_id] = new_share.id
                        shares_imported += 1

                if _table_exists(backup_conn, "entry_reads"):
                    for row in backup_conn.execute("SELECT * FROM entry_reads"):
                        entry_id = _row_get(row, "entry_id")
                        reader_id = _row_get(row, "reader_id")
                        window_key = _row_get(row, "window_key")

                        if entry_id is not None and entry_id not in entry_map:
                            continue

                        remapped_reader = user_map.get(reader_id) if reader_id else reader_id

                        if window_key and window_key in existing_window_keys:
                            n = 1
                            new_wk = f"{window_key}-{n}"
                            while new_wk in existing_window_keys:
                                n += 1
                                new_wk = f"{window_key}-{n}"
                            window_key = new_wk
                            conflicts_resolved += 1

                        new_read = EntryRead(
                            entry_id=entry_map.get(entry_id) if entry_id else entry_id,
                            action=_row_get(row, "action", "read"),
                            channel=_row_get(row, "channel", "api"),
                            reader_type=_row_get(row, "reader_type", "anonymous"),
                            reader_id=remapped_reader,
                            is_self_read=bool(_row_get(row, "is_self_read", 0)),
                            count=_row_get(row, "count", 1),
                            window_key=window_key or "",
                            reader_fingerprint=_row_get(row, "reader_fingerprint", ""),
                        )
                        session.add(new_read)
                        session.flush()
                        if window_key:
                            existing_window_keys.add(window_key)
                        reads_imported += 1

                if _table_exists(backup_conn, "api_keys"):
                    for row in backup_conn.execute("SELECT * FROM api_keys"):
                        user_id = _row_get(row, "user_id")
                        key_hash = _row_get(row, "key_hash")

                        if user_id is None or user_id not in user_map:
                            continue
                        if key_hash in existing_key_hashes:
                            conflicts_resolved += 1
                            continue

                        new_key = ApiKey(
                            user_id=user_map[user_id],
                            name=_row_get(row, "name", ""),
                            key_prefix=_row_get(row, "key_prefix", ""),
                            key_hash=key_hash,
                            expires_at=_parse_db_datetime(_row_get(row, "expires_at")),
                            last_used_at=_parse_db_datetime(_row_get(row, "last_used_at")),
                        )
                        session.add(new_key)
                        session.flush()
                        api_keys_imported += 1

                session.commit()

            except Exception:
                session.rollback()
                raise

        for old_entry_id, new_entry_id in entry_map.items():
            src_dir = staging_path / "data" / "default" / str(old_entry_id)
            if src_dir.exists():
                dst_dir = self.config.data_dir / "default" / str(new_entry_id)
                dst_dir.parent.mkdir(parents=True, exist_ok=True)
                shutil.copytree(src_dir, dst_dir)

        rebuild_fts_index(self.engine, self.storage)

        return RestoreResult(
            users_imported=users_imported,
            entries_imported=entries_imported,
            files_imported=files_imported,
            api_keys_imported=api_keys_imported,
            shares_imported=shares_imported,
            reads_imported=reads_imported,
            conflicts_resolved=conflicts_resolved,
            fts_rebuilt=True,
            version_check=version_check,
        )

    def _restore_replace(
        self,
        staging_path: Path,
        backup_conn: sqlite3.Connection,
        version_check: str,
    ) -> RestoreResult:
        backup_conn.close()

        config_dir = _get_config_dir(self.config)
        target_db = self.config.db_path
        data_default = self.config.data_dir / "default"

        staging_db = staging_path / "peekview.db"
        staging_data = staging_path / "data" / "default"

        restore_staging = target_db.parent / f"{target_db.name}.restore-staging"
        if restore_staging.exists():
            shutil.rmtree(restore_staging)
        restore_staging.mkdir(parents=True)

        staging_db_dest = restore_staging / "peekview.db"
        shutil.copy2(staging_db, staging_db_dest)

        staging_data_dest = restore_staging / "data" / "default"
        if staging_data.exists():
            _check_no_symlinks(staging_data)
            staging_data_dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(staging_data, staging_data_dest)

        if (staging_path / "config.yaml").exists():
            shutil.copy2(staging_path / "config.yaml", restore_staging / "config.yaml")
        if (staging_path / ".secret_key").exists():
            shutil.copy2(staging_path / ".secret_key", restore_staging / ".secret_key")
        if (staging_path / ".captcha_secret").exists():
            shutil.copy2(staging_path / ".captcha_secret", restore_staging / ".captcha_secret")

        with self.engine.connect() as conn:
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
            conn.commit()
        self.engine.dispose()

        old_db_backup = target_db.with_suffix(".db.old")
        if target_db.exists():
            target_db.rename(old_db_backup)
        staging_db_dest.rename(target_db)

        old_data_backup = data_default.parent / "default.old"
        if data_default.exists():
            data_default.rename(old_data_backup)

        new_data = restore_staging / "data" / "default"
        if new_data.exists():
            data_default.parent.mkdir(parents=True, exist_ok=True)
            new_data.rename(data_default)
        else:
            data_default.mkdir(parents=True, exist_ok=True)

        for name in ["config.yaml", ".secret_key", ".captcha_secret"]:
            src = restore_staging / name
            if src.exists():
                dst = config_dir / name
                if dst.exists():
                    dst.unlink()
                shutil.copy2(src, dst)

        shutil.rmtree(restore_staging, ignore_errors=True)
        if old_db_backup.exists():
            old_db_backup.unlink()
        if old_data_backup.exists():
            shutil.rmtree(old_data_backup, ignore_errors=True)

        engine = init_db(target_db)
        rebuild_fts_index(engine, self.storage)

        with Session(engine) as session:
            entry_count = session.exec(select(func.count(Entry.id))).one()
            user_count = session.exec(select(func.count(User.id))).one()
            file_count = session.exec(select(func.count(File.id))).one()
            api_key_count = session.exec(select(func.count(ApiKey.id))).one()

        return RestoreResult(
            users_imported=user_count,
            entries_imported=entry_count,
            files_imported=file_count,
            api_keys_imported=api_key_count,
            shares_imported=0,
            reads_imported=0,
            conflicts_resolved=0,
            fts_rebuilt=True,
            version_check=version_check,
        )


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    result = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return result is not None


def _table_exists_raw(session: Session, table_name: str) -> bool:
    result = session.exec(text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=:name"
    ).bindparams(name=table_name)).first()
    return result is not None


def _parse_db_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


def _row_get(row: sqlite3.Row, key: str, default: object = None) -> object:
    try:
        val = row[key]
        return val
    except (IndexError, KeyError):
        return default
