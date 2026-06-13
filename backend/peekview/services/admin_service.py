"""Admin service — system statistics and cleanup operations."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import case, func
from sqlmodel import Session, select

from peekview.config import PeekConfig
from peekview.exceptions import NotFoundError
from peekview.models import (
    AdminCleanupResponse,
    AdminStatsResponse,
    ApiKey,
    ApiKeyStats,
    Entry,
    EntryStats,
    StorageStats,
    User,
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
                    func.count(case((Entry.is_public == True, 1))).label("public"),
                    func.count(case((Entry.is_public == False, 1))).label("private"),
                    func.count(
                        case(
                            (
                                (Entry.expires_at != None)
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
                    ApiKey.expires_at != None,
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

        with Session(self.engine) as session:
            expired_entries = session.exec(
                select(Entry).where(
                    Entry.expires_at != None,
                    Entry.expires_at <= now_naive,
                )
            ).all()

            if not expired_entries:
                return AdminCleanupResponse(
                    deleted_count=0, deleted_slugs=[], freed_mb=0.0
                )

            to_delete = []
            for e in expired_entries:
                size_bytes = self.storage.get_entry_size(e.id)
                to_delete.append((e.slug, e.id, size_bytes))

        deleted_slugs = []
        total_freed = 0
        entry_service = EntryService(
            engine=self.engine, storage=self.storage, config=self.config
        )

        for slug, entry_id, size_bytes in to_delete:
            try:
                entry_service.delete_entry_by_api_key(slug)
                deleted_slugs.append(slug)
                total_freed += size_bytes
            except NotFoundError:
                pass

        return AdminCleanupResponse(
            deleted_count=len(deleted_slugs),
            deleted_slugs=deleted_slugs,
            freed_mb=round(total_freed / (1024 * 1024), 2),
        )
