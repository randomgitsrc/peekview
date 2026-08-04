from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import Engine, func, text
from sqlmodel import Session, select

from peekview.models import (
    EntryRead,
    EntryReadStats,
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
        source: str = "direct",
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
        window_key = f"{eid_part}:{fingerprint}:{channel}:{action}:{window_ts}"

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
                    source=source,
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

            if entry_id is not None:
                stats = session.get(EntryReadStats, entry_id)
                if stats is None:
                    stats = EntryReadStats(
                        entry_id=entry_id,
                        total_reads=0,
                        unique_readers=0,
                        by_action="{}",
                        by_channel="{}",
                        by_source="{}",
                        reader_fingerprints="",
                    )
                    session.add(stats)

                stats.total_reads += 1

                by_action = json.loads(stats.by_action or "{}")
                by_action[action] = by_action.get(action, 0) + 1
                stats.by_action = json.dumps(by_action)

                by_channel = json.loads(stats.by_channel or "{}")
                by_channel[channel] = by_channel.get(channel, 0) + 1
                stats.by_channel = json.dumps(by_channel)

                by_source = json.loads(stats.by_source or "{}")
                by_source[source] = by_source.get(source, 0) + 1
                stats.by_source = json.dumps(by_source)

                if not is_self_read:
                    fps = [fp for fp in (stats.reader_fingerprints or "").split(",") if fp]
                    if fingerprint not in fps:
                        fps.append(fingerprint)
                        stats.reader_fingerprints = ",".join(fps)
                        stats.unique_readers += 1

                stats.last_read_at = now
                stats.updated_at = now
                session.add(stats)

            session.commit()

    def get_read_stats(self, entry_id: int) -> ReadStatsResponse:
        with Session(self.engine) as session:
            stats = session.get(EntryReadStats, entry_id)
            if stats is None:
                return ReadStatsResponse(
                    total_count=0,
                    unique_readers=0,
                    by_channel={},
                    by_action={},
                    by_source={},
                    last_read_at=None,
                )

            return ReadStatsResponse(
                total_count=stats.total_reads,
                unique_readers=stats.unique_readers,
                by_channel=json.loads(stats.by_channel or "{}"),
                by_action=json.loads(stats.by_action or "{}"),
                by_source=json.loads(stats.by_source or "{}"),
                last_read_at=stats.last_read_at,
            )

    def get_read_events(
        self,
        entry_id: int,
        page: int = 1,
        per_page: int = 20,
    ) -> ReadEventListResponse:
        with Session(self.engine) as session:
            total = session.exec(
                select(func.count()).select_from(EntryRead).where(EntryRead.entry_id == entry_id)
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

    def backfill_stats(self) -> None:
        with Session(self.engine) as session:
            stats_count = session.exec(
                text("SELECT COUNT(*) FROM entry_read_stats")
            ).scalar()
            if stats_count and stats_count > 0:
                return

            reads_count = session.exec(
                text("SELECT COUNT(*) FROM entry_reads WHERE entry_id IS NOT NULL")
            ).scalar()
            if not reads_count:
                return

            entries = session.exec(
                text("SELECT DISTINCT entry_id FROM entry_reads WHERE entry_id IS NOT NULL")
            ).all()

            for (eid,) in entries:
                rows = session.exec(
                    text(
                        "SELECT action, channel, SUM(count) as total FROM entry_reads "
                        "WHERE entry_id = :eid GROUP BY action, channel"
                    ).bindparams(eid=eid)
                ).all()

                by_action, by_channel = {}, {}
                total_reads = 0
                for action, channel, total in rows:
                    by_action[action] = by_action.get(action, 0) + total
                    by_channel[channel] = by_channel.get(channel, 0) + total
                    total_reads += total

                source_rows = session.exec(
                    text(
                        "SELECT COALESCE(source, 'unknown') as src, SUM(count) as total FROM entry_reads "
                        "WHERE entry_id = :eid GROUP BY src"
                    ).bindparams(eid=eid)
                ).all()
                by_source = {}
                for src, total in source_rows:
                    by_source[src] = by_source.get(src, 0) + total

                unique_readers = session.exec(
                    text(
                        "SELECT COUNT(DISTINCT reader_fingerprint) FROM entry_reads "
                        "WHERE entry_id = :eid AND is_self_read = 0"
                    ).bindparams(eid=eid)
                ).scalar() or 0

                fingerprints = session.exec(
                    text(
                        "SELECT GROUP_CONCAT(DISTINCT reader_fingerprint) FROM entry_reads "
                        "WHERE entry_id = :eid AND is_self_read = 0"
                    ).bindparams(eid=eid)
                ).scalar() or ""

                last_read = session.exec(
                    text("SELECT MAX(updated_at) FROM entry_reads WHERE entry_id = :eid").bindparams(
                        eid=eid
                    )
                ).scalar()
                if isinstance(last_read, str):
                    try:
                        last_read = datetime.fromisoformat(last_read)
                    except (ValueError, TypeError):
                        last_read = None

                stats = EntryReadStats(
                    entry_id=eid,
                    total_reads=total_reads,
                    unique_readers=unique_readers,
                    by_action=json.dumps(by_action),
                    by_channel=json.dumps(by_channel),
                    by_source=json.dumps(by_source),
                    reader_fingerprints=fingerprints,
                    last_read_at=last_read,
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(stats)

            session.commit()
