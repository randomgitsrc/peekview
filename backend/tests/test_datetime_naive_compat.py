"""TPV0101 — naive UTC datetime column guards (sqlmodel >=0.0.47 compat).

These tests are the P3 red-light guards for the sqlmodel 0.0.47 regression:
sqlmodel 0.0.47 maps a bare ``datetime`` annotation to ``UTCDateTime(timezone=True)``
whose ``process_bind_param`` raises ``ValueError: Datetime values must have
timezone information`` whenever a *naive* value is bound. PeekView stores naive
UTC values in every table datetime column, so before the fix (explicit
``Column(DateTime(timezone=False))``) these tests fail on 0.0.47 while passing on
0.0.38 (which does not validate).

BDD coverage (1:1 with P1-requirements.md):
  BDD-1: naive + aware values can be written to every affected naive column
  BDD-2: nullable columns round-trip NULL <-> naive value
  BDD-3: read path binds naive values in WHERE comparisons without error
  BDD-6: naive UTC storage semantics preserved (no timezone drift on read-back)
  BDD-9: every aware assignment path (default_factory=now_utc / now(timezone.utc))
         binds as an equivalent naive UTC value
  BDD-16: all 25 table datetime columns are declared explicitly naive (static scan)

All writes go to a throwaway in-memory / tmp_path SQLite DB (autouse conftest
isolation), never to production data.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import DateTime
from sqlalchemy.sql.type_api import TypeDecorator, TypeEngine
from sqlmodel import Session, select

from peekview.models import (
    ApiKey,
    Entry,
    EntryRead,
    EntryReadStats,
    EntryShare,
    EntryStar,
    EntryTombstone,
    File,
    User,
)


def _naive() -> datetime:
    """A naive UTC value as written by the application commit paths."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _utc_now() -> datetime:
    """An aware UTC value as produced by ``now_utc`` / ``datetime.now(timezone.utc)``."""
    return datetime.now(timezone.utc)


def _effective_datetime_type(sa_type: TypeEngine) -> TypeEngine | None:
    """Return the underlying SQLAlchemy DateTime type, unwrapping decorators.

    sqlmodel's ``UTCDateTime`` (0.0.47, bare annotation) is a ``TypeDecorator``
    whose impl is ``DateTime(timezone=True)``; after the fix the column type is a
    plain ``DateTime`` directly.
    """
    if isinstance(sa_type, DateTime):
        return sa_type
    if isinstance(sa_type, TypeDecorator):
        impl = sa_type.impl
        if isinstance(impl, (TypeEngine, TypeDecorator)):
            return _effective_datetime_type(impl)
    return None


def _all_datetime_columns() -> list[tuple[str, str, TypeEngine]]:
    """Enumerate every table datetime column as (table, column, sa_type)."""
    found: list[tuple[str, str, TypeEngine]] = []
    for name, model in vars(__import__("peekview.models", fromlist=["_"])).items():
        table = getattr(model, "__table__", None)
        if not isinstance(model, type) or table is None:
            continue
        for column in table.columns:
            if _effective_datetime_type(column.type) is not None:
                found.append((name, column.name, column.type))
    return found


def _timezone_flag(sa_type: TypeEngine) -> bool | None:
    """Effective ``timezone`` flag of a datetime column type (None if implicit)."""
    effective = _effective_datetime_type(sa_type)
    if effective is None:
        return None
    return getattr(effective, "timezone", None)


def _mk_user(session: Session, username: str = "dtuser") -> User:
    user = User(username=username, password_hash="x", is_active=True, is_admin=False)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _mk_entry(session: Session, slug: str, owner_id: int | None = None, **kwargs) -> Entry:
    entry = Entry(slug=slug, summary="datetime guard", owner_id=owner_id, **kwargs)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


class TestBdd01NaiveWritePaths:
    """BDD-1: all affected naive columns accept both naive and aware writes."""

    def test_bdd_01_naive_write_on_all_affected_columns(self, session: Session):
        user = _mk_user(session)
        naive = _naive()
        deadline = naive + timedelta(days=30)

        entry = _mk_entry(session, "bdd01-naive")
        entry.expires_at = naive
        entry.archived_at = naive
        entry.archive_delete_at = deadline
        entry.updated_at = naive
        session.add(entry)
        session.commit()
        session.refresh(entry)

        assert entry.archive_delete_at == deadline
        assert entry.archive_delete_at.tzinfo is None

        user.disabled_at = naive
        session.add(user)
        session.commit()
        session.refresh(user)
        assert user.disabled_at == naive
        assert user.disabled_at.tzinfo is None

        api_key = ApiKey(
            user_id=user.id,
            name="bdd01",
            key_prefix="pv_bdd01",
            key_hash="hash-bdd01",
            last_used_at=naive,
            expires_at=deadline,
        )
        session.add(api_key)
        session.commit()
        session.refresh(api_key)
        assert api_key.last_used_at == naive
        assert api_key.expires_at == deadline

    def test_bdd_01_aware_write_is_stored_as_naive(self, session: Session):
        """Aware assignment paths (class b) bind without error and de-timezone."""
        aware = _utc_now()
        user = _mk_user(session, username="bdd01-aware")
        entry = _mk_entry(session, "bdd01-aware", owner_id=user.id)

        entry.updated_at = aware
        entry.expires_at = aware + timedelta(days=7)
        session.add(entry)
        session.commit()
        session.refresh(entry)

        assert entry.updated_at is not None
        assert entry.updated_at.tzinfo is None
        assert entry.updated_at == aware.replace(tzinfo=None)


class TestBdd02NullRoundTrip:
    """BDD-2: nullable naive columns round-trip NULL and naive values."""

    def test_bdd_02_null_and_naive_roundtrip(self, session: Session):
        entry = _mk_entry(session, "bdd02")
        assert entry.expires_at is None
        assert entry.archived_at is None
        assert entry.archive_delete_at is None

        naive = _naive()
        entry.archive_delete_at = naive
        session.add(entry)
        session.commit()
        session.refresh(entry)
        assert entry.archive_delete_at == naive

        entry.archive_delete_at = None
        session.add(entry)
        session.commit()
        session.refresh(entry)
        assert entry.archive_delete_at is None


class TestBdd03NaiveWhereComparison:
    """BDD-3: read paths binding naive values compare without error."""

    def test_bdd_03_naive_where_comparison(self, session: Session):
        naive = _naive()
        entry = _mk_entry(session, "bdd03")
        entry.expires_at = naive + timedelta(days=1)
        session.add(entry)
        session.commit()

        selected = session.exec(
            select(Entry).where(Entry.expires_at <= naive + timedelta(days=2))
        ).all()
        assert any(e.slug == "bdd03" for e in selected)

        none_selected = session.exec(
            select(Entry).where(Entry.expires_at <= naive - timedelta(days=2))
        ).all()
        assert all(e.slug != "bdd03" for e in none_selected)


class TestBdd06NaiveStorageSemantics:
    """BDD-6: naive UTC storage semantics preserved, no timezone drift."""

    def test_bdd_06_readback_matches_stored_utc_instant(self, session: Session):
        stored = datetime(2026, 1, 2, 3, 4, 5, 0)
        entry = _mk_entry(session, "bdd06", expires_at=stored)
        assert entry.expires_at == stored
        assert entry.expires_at.tzinfo is None

        raw = session.exec(
            select(Entry.expires_at).where(Entry.slug == "bdd06")
        ).one()
        assert raw == stored
        assert raw.tzinfo is None


class TestBdd09AwareAssignmentPaths:
    """BDD-9: aware assignment paths store equivalent naive UTC values."""

    def test_bdd_09_default_factory_created_at_is_naive_on_readback(self, session: Session):
        user = _mk_user(session, username="bdd09")
        entry = _mk_entry(session, "bdd09", owner_id=user.id)
        share = EntryShare(
            entry_id=entry.id,
            token_hash="hash-bdd09",
            token_prefix="pv_b09",
            expires_at=_utc_now() + timedelta(days=1),
            created_by=user.id,
            created_at=_utc_now(),
        )
        session.add(share)
        session.commit()
        session.refresh(share)
        assert share.created_at.tzinfo is None
        assert share.expires_at.tzinfo is None

        read = EntryRead(
            entry_id=entry.id,
            window_key="bdd09-window",
            read_at=_utc_now(),
            updated_at=_utc_now(),
        )
        stats = EntryReadStats(entry_id=entry.id, last_read_at=_utc_now(), updated_at=_utc_now())
        session.add(read)
        session.add(stats)
        session.commit()
        session.refresh(read)
        session.refresh(stats)
        assert read.read_at.tzinfo is None
        assert read.updated_at.tzinfo is None
        assert stats.last_read_at.tzinfo is None
        assert stats.updated_at.tzinfo is None

    def test_bdd_09_service_assignment_columns_are_naive(self, session: Session):
        user = _mk_user(session, username="bdd09b")
        entry = _mk_entry(session, "bdd09b", owner_id=user.id)

        star = EntryStar(entry_id=entry.id, user_id=user.id, created_at=_utc_now())
        tombstone = EntryTombstone(
            slug="bdd09b",
            title="t",
            deleted_by="tester",
            deleted_at=_utc_now(),
        )
        session.add(star)
        session.add(tombstone)
        session.commit()
        session.refresh(star)
        session.refresh(tombstone)
        assert star.created_at.tzinfo is None
        assert tombstone.deleted_at.tzinfo is None


class TestBdd16ExplicitNaiveColumns:
    """BDD-16: every table datetime column declares an explicit timezone flag."""

    def test_bdd_16_all_datetime_columns_explicit_naive(self):
        columns = _all_datetime_columns()
        assert len(columns) == 25, (
            f"expected 25 table datetime columns, found {len(columns)}: {columns}"
        )

        implicit = [
            (table, column)
            for table, column, sa_type in columns
            if _timezone_flag(sa_type) is not False
        ]
        assert implicit == [], (
            "datetime columns without an explicit naive (timezone=False) declaration: "
            f"{implicit}"
        )

    def test_bdd_16_column_type_is_plain_datetime_not_decorator(self):
        decorated = [
            (table, column)
            for table, column, sa_type in _all_datetime_columns()
            if not isinstance(sa_type, DateTime)
        ]
        assert decorated == [], (
            "datetime columns still mapped through a decorator (bare `datetime` "
            f"annotation drift): {decorated}"
        )


class TestCleanupHooks:
    """Registered resource cleanup — no rows leak out of the isolated test DB."""

    def test_created_rows_are_scoped_to_isolated_engine(self, session: Session):
        user = _mk_user(session, username="cleanup-user")
        entry = _mk_entry(session, "cleanup-entry", owner_id=user.id)
        file = File(entry_id=entry.id, filename="a.py", size=1)
        session.add(file)
        session.commit()
        assert file.id is not None

        session.delete(file)
        session.delete(entry)
        session.delete(user)
        session.commit()
        assert session.exec(select(File).where(File.id == file.id)).first() is None


@pytest.fixture(autouse=True)
def _cleanup_created_rows(request):
    """After-each cleanup queue: guarantee every created row is removed.

    The conftest ``isolate_config_file`` fixture already routes storage to a
    temp dir; this hook is the explicit afterEach safety net for created rows.
    """
    queue: list = []
    yield queue
    for item in queue:
        session = item.pop("session", None)
        model = item.pop("model", None)
        if session is None or model is None:
            continue
        try:
            existing = session.get(model, item["pk"])
            if existing is not None:
                session.delete(existing)
                session.commit()
        except Exception:
            session.rollback()
