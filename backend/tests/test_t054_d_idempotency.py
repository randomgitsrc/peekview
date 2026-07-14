"""T054-D: Create-endpoint idempotency key protection.

BDD: D1-D10
Tests should FAIL (red) until P4 implementation.
"""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.main import create_app
from peekview.models import Entry


@pytest.fixture
async def idem_client(monkeypatch):
    """Client for idempotency testing with auth enabled."""
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c, app
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _register_and_login(client: AsyncClient, username: str = "testuser", password: str = "testpass123") -> str:
    reg = await client.post("/api/v1/auth/register", json={
        "username": username,
        "password": password,
    })
    assert reg.status_code in (200, 201), f"Register failed: {reg.status_code} {reg.text}"
    return reg.json().get("access_token") or ""


async def _login_get_cookie(client: AsyncClient, username: str = "testuser", password: str = "testpass123") -> dict:
    reg = await client.post("/api/v1/auth/register", json={
        "username": username,
        "password": password,
    })
    assert reg.status_code in (200, 201)
    return {"cookie": reg.headers.get("set-cookie", "")}


class TestBDDD1FirstCreate201:
    """BDD-D1: Given POST /api/v1/entries with idempotency_key="abc123",
    When the key appears for the first time,
    Then a new entry is created, HTTP 201, response includes files list.
    """

    @pytest.mark.asyncio
    async def test_first_create_returns_201(self, idem_client):
        client, app = idem_client
        resp = await client.post("/api/v1/entries", json={
            "summary": "First entry",
            "idempotency_key": "abc123",
            "files": [{"path": "main.py", "content": "hello"}],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "files" in data
        assert isinstance(data["files"], list)

        with Session(app.state.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == data["slug"])
            ).first()
            assert entry is not None
            assert getattr(entry, "idempotency_key", None) == "abc123"


class TestBDDD2IdempotentHit200:
    """BDD-D2: Given an existing entry with idempotency_key="abc123",
    When the same owner requests POST /api/v1/entries with the same idempotency_key="abc123",
    Then returns existing entry (same slug), HTTP 200, response includes files list.
    """

    @pytest.mark.asyncio
    async def test_same_key_same_owner_returns_200(self, idem_client):
        client, app = idem_client
        cookies = await _login_get_cookie(client)

        resp1 = await client.post("/api/v1/entries", json={
            "summary": "Idempotent entry",
            "idempotency_key": "idem-200",
            "files": [{"path": "a.py", "content": "x"}],
        }, headers={"Cookie": cookies["cookie"]})
        assert resp1.status_code == 201
        slug1 = resp1.json()["slug"]
        files1 = resp1.json()["files"]

        resp2 = await client.post("/api/v1/entries", json={
            "summary": "Idempotent entry again",
            "idempotency_key": "idem-200",
            "files": [{"path": "b.py", "content": "y"}],
        }, headers={"Cookie": cookies["cookie"]})
        assert resp2.status_code == 200
        assert resp2.json()["slug"] == slug1
        assert "files" in resp2.json()
        assert isinstance(resp2.json()["files"], list)


class TestBDDD3IntegrityErrorCatch:
    """BDD-D3: Given idempotency_key column has UNIQUE constraint,
    When IntegrityError is triggered (key conflict) on insert,
    Then catch and query+return existing entry, HTTP 200.
    """

    @pytest.mark.asyncio
    async def test_concurrent_same_key_returns_existing(self, idem_client):
        client, app = idem_client
        cookies = await _login_get_cookie(client)

        resp1 = await client.post("/api/v1/entries", json={
            "summary": "Race entry",
            "idempotency_key": "race-key",
        }, headers={"Cookie": cookies["cookie"]})
        assert resp1.status_code == 201
        slug1 = resp1.json()["slug"]

        resp2 = await client.post("/api/v1/entries", json={
            "summary": "Race entry again",
            "idempotency_key": "race-key",
        }, headers={"Cookie": cookies["cookie"]})
        assert resp2.status_code == 200
        assert resp2.json()["slug"] == slug1


class TestBDDD4NoKeyBehaviorUnchanged:
    """BDD-D4: Given POST /api/v1/entries without idempotency_key,
    When creating an entry,
    Then behavior is identical to before (new entry each time, HTTP 201).
    """

    @pytest.mark.asyncio
    async def test_no_key_creates_new_each_time(self, idem_client):
        client, _ = idem_client
        resp1 = await client.post("/api/v1/entries", json={
            "summary": "No key 1",
        })
        resp2 = await client.post("/api/v1/entries", json={
            "summary": "No key 2",
        })
        assert resp1.status_code == 201
        assert resp2.status_code == 201
        assert resp1.json()["slug"] != resp2.json()["slug"]


class TestBDDD5KeyReusableAfterDelete:
    """BDD-D5: Given an entry with idempotency_key="del-test" has been deleted,
    When creating again with idempotency_key="del-test",
    Then creates a new entry, HTTP 201 (key cleared with entry deletion).
    """

    @pytest.mark.asyncio
    async def test_key_reusable_after_delete(self, idem_client):
        client, app = idem_client
        resp1 = await client.post("/api/v1/entries", json={
            "summary": "To delete",
            "idempotency_key": "del-test",
        })
        assert resp1.status_code == 201
        slug1 = resp1.json()["slug"]

        with Session(app.state.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug1)).first()
            assert entry is not None
            assert getattr(entry, "idempotency_key", None) == "del-test"

        del_resp = await client.delete(f"/api/v1/entries/{slug1}")
        assert del_resp.status_code == 200

        with Session(app.state.engine) as session:
            entry = session.exec(select(Entry).where(Entry.slug == slug1)).first()
            assert entry is None

        resp2 = await client.post("/api/v1/entries", json={
            "summary": "Recreated",
            "idempotency_key": "del-test",
        })
        assert resp2.status_code == 201
        assert resp2.json()["slug"] != slug1

        with Session(app.state.engine) as session:
            entry = session.exec(
                select(Entry).where(Entry.slug == resp2.json()["slug"])
            ).first()
            assert entry is not None
            assert getattr(entry, "idempotency_key", None) == "del-test"


class TestBDDD6MCPCreateEntryPassesKey:
    """BDD-D6: Given MCP createEntry tool passes idempotency_key="test-key",
    When backend receives the request,
    Then request body includes idempotency_key field with value "test-key".
    """

    def test_mcp_zod_schema_has_idempotency_key(self):
        import importlib
        try:
            mod = importlib.import_module("peekview.tools.createEntry")
        except ImportError:
            pytest.skip("MCP tools not importable from backend (expected)")

    def test_mcp_types_has_idempotency_key(self):
        import json
        from pathlib import Path
        types_path = Path(__file__).parent.parent.parent / "packages" / "mcp-server" / "src" / "types.ts"
        if not types_path.exists():
            pytest.skip("MCP types.ts not found")
        content = types_path.read_text()
        assert "idempotency_key" in content, "CreateEntryRequest should have idempotency_key field"

    def test_mcp_create_entry_schema_has_key(self):
        from pathlib import Path
        tool_path = Path(__file__).parent.parent.parent / "packages" / "mcp-server" / "src" / "tools" / "createEntry.ts"
        if not tool_path.exists():
            pytest.skip("MCP createEntry.ts not found")
        content = tool_path.read_text()
        assert "idempotency_key" in content, "createEntry tool schema should include idempotency_key"


class TestBDDD7CrossOwnerKeyReturns409:
    """BDD-D7: Given user A created entry with idempotency_key="shared-key",
    When user B requests POST with same idempotency_key="shared-key",
    Then returns HTTP 409 Conflict.
    """

    @pytest.mark.asyncio
    async def test_cross_owner_key_returns_409(self, idem_client):
        client, _ = idem_client

        cookies_a = await _login_get_cookie(client, "user_a", "password1a")
        resp_a = await client.post("/api/v1/entries", json={
            "summary": "User A entry",
            "idempotency_key": "shared-key",
        }, headers={"Cookie": cookies_a["cookie"]})
        assert resp_a.status_code == 201

        cookies_b = await _login_get_cookie(client, "user_b", "password1b")
        resp_b = await client.post("/api/v1/entries", json={
            "summary": "User B entry",
            "idempotency_key": "shared-key",
        }, headers={"Cookie": cookies_b["cookie"]})
        assert resp_b.status_code == 409


class TestBDDD8EmptyStringKey422:
    """BDD-D8: Given POST /api/v1/entries with idempotency_key="" (empty string),
    When backend processes the request,
    Then returns HTTP 422 (empty string treated as invalid input).
    """

    @pytest.mark.asyncio
    async def test_empty_string_key_returns_422(self, idem_client):
        client, _ = idem_client
        resp = await client.post("/api/v1/entries", json={
            "summary": "Empty key",
            "idempotency_key": "",
        })
        assert resp.status_code == 422


class TestBDDD9KeyTooLong422:
    """BDD-D9: Given POST /api/v1/entries with idempotency_key exceeding 128 chars,
    When backend processes the request,
    Then returns HTTP 422 (exceeds max_length limit).
    """

    @pytest.mark.asyncio
    async def test_overlength_key_returns_422(self, idem_client):
        client, _ = idem_client
        long_key = "x" * 129
        resp = await client.post("/api/v1/entries", json={
            "summary": "Long key",
            "idempotency_key": long_key,
        })
        assert resp.status_code == 422


class TestBDDD10MultipleNullsNoConflict:
    """BDD-D10: Given multiple entries without idempotency_key (NULL in DB),
    When querying the database,
    Then multiple NULL values do not trigger UNIQUE conflict.
    """

    def test_multiple_null_entries_no_unique_conflict(self, tmp_path):
        from peekview.config import PeekConfig
        from peekview.database import init_db
        from peekview.services.entry_service import EntryService
        from peekview.storage import StorageManager
        from sqlalchemy import text

        db_path = tmp_path / "test.db"
        data_dir = tmp_path / "data"
        data_dir.mkdir()

        engine = init_db(db_path)
        config = PeekConfig(data_dir=data_dir, db_path=db_path)
        storage = StorageManager(config=config)
        service = EntryService(engine=engine, storage=storage, config=config)

        r1 = service.create_entry(summary="Entry 1", slug="null-test-1")
        r2 = service.create_entry(summary="Entry 2", slug="null-test-2")
        r3 = service.create_entry(summary="Entry 3", slug="null-test-3")

        assert r1.id != r2.id
        assert r2.id != r3.id

        with Session(engine) as session:
            columns = {row[1] for row in session.execute(text("PRAGMA table_info(entries)"))}
            assert "idempotency_key" in columns, "idempotency_key column must exist"

            entries = session.exec(select(Entry)).all()
            null_key_entries = [e for e in entries if getattr(e, "idempotency_key", None) is None]
            assert len(null_key_entries) >= 3

        with engine.connect() as conn:
            indexes = {
                row[0]
                for row in conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='index'")
                )
            }
            assert "idx_entries_idempotency_key" in indexes, (
                "Partial unique index must exist for idempotency_key"
            )
