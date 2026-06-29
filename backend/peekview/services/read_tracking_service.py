from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from sqlalchemy import Engine, func, text
from sqlmodel import Session, select

from peekview.models import (
    EntryRead,
    ReadEventListResponse,
    ReadEventResponse,
    ReadStatsResponse,
)

logger = logging.getLogger(__name__)


class ReadTrackingService:
    def __init__(self, engine: Engine):
        self.engine = engine

    def record_read(
        self,
        entry_id: int | None,
        entry_owner_id: int | None,
        action: str,
        channel: str,
        reader_id: int | None,
        reader_ip: str | None,
    ) -> None:
        if reader_id is not None:
            fingerprint = f"u:{reader_id}"
        elif reader_ip:
            fingerprint = f"a:{hashlib.sha256(reader_ip.encode()).hexdigest()[:8]}"
        else:
            fingerprint = "a:unknown"

        is_self_read = False
        if entry_owner_id is not None and reader_id is not None:
            is_self_read = reader_id == entry_owner_id

        now = datetime.now(timezone.utc)
        window_ts = now.strftime("%Y-%m-%dT%H:%M")
        eid_part = str(entry_id) if entry_id is not None else "discover"
        window_key = f"{eid_part}:{fingerprint}:{channel}:{window_ts}"

        reader_type = "authenticated" if reader_id is not None else "anonymous"

        with Session(self.engine) as session:
            existing = session.exec(
                select(EntryRead).where(EntryRead.window_key == window_key)
            ).first()
            if existing:
                existing.count += 1
                existing.updated_at = now
                session.add(existing)
            else:
                record = EntryRead(
                    entry_id=entry_id,
                    action=action,
                    channel=channel,
                    reader_type=reader_type,
                    reader_id=reader_id,
                    is_self_read=is_self_read,
                    count=1,
                    window_key=window_key,
                    reader_fingerprint=fingerprint,
                    read_at=now,
                    updated_at=now,
                )
                session.add(record)
            session.commit()

    def get_read_stats(self, entry_id: int) -> ReadStatsResponse:
        with Session(self.engine) as session:
            total_count = session.exec(
                select(func.coalesce(func.sum(EntryRead.count), 0)).where(
                    EntryRead.entry_id == entry_id
                )
            ).one()

            try:
                unique_count = session.execute(
                    text(
                        "SELECT COUNT(DISTINCT reader_fingerprint) FROM entry_reads "
                        "WHERE entry_id = :eid AND is_self_read = 0 AND action = 'read'"
                    ),
                    {"eid": entry_id},
                ).scalar() or 0
            except Exception:
                unique_count = 0

            channel_rows = session.exec(
                select(EntryRead.channel, func.coalesce(func.sum(EntryRead.count), 0))
                .where(EntryRead.entry_id == entry_id)
                .group_by(EntryRead.channel)
            ).all()
            by_channel = {row[0]: row[1] for row in channel_rows}

            last_read = session.exec(
                select(func.max(EntryRead.updated_at)).where(
                    EntryRead.entry_id == entry_id
                )
            ).first()

            return ReadStatsResponse(
                total_count=total_count,
                unique_readers=unique_count,
                by_channel=by_channel,
                last_read_at=last_read,
            )

    def get_read_events(
        self,
        entry_id: int,
        page: int = 1,
        per_page: int = 20,
    ) -> ReadEventListResponse:
        with Session(self.engine) as session:
            total = session.exec(
                select(func.count()).select_from(EntryRead).where(
                    EntryRead.entry_id == entry_id
                )
            ).one()

            offset = (page - 1) * per_page
            rows = session.exec(
                select(EntryRead)
                .where(EntryRead.entry_id == entry_id)
                .order_by(EntryRead.updated_at.desc())
                .offset(offset)
                .limit(per_page)
            ).all()

            items = [
                ReadEventResponse(
                    id=r.id,
                    action=r.action,
                    channel=r.channel,
                    reader_type=r.reader_type,
                    reader_id=r.reader_id,
                    is_self_read=r.is_self_read,
                    count=r.count,
                    read_at=r.read_at,
                    updated_at=r.updated_at,
                )
                for r in rows
            ]

            return ReadEventListResponse(
                items=items,
                total=total,
                page=page,
                per_page=per_page,
            )
