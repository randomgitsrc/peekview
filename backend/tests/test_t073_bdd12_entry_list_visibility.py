"""T073 BDD-12: entry list API visibility with OR expression.

BDD-12: Given 1 public entry (owned by alice) and 1 private entry (owned by alice),
When bob (authenticated, non-admin) calls entry list API,
Then bob sees the public entry but NOT alice's private entry,
and bob sees own private entries.

This specifically tests the OR expression path in entry_service.py:448/451:
  `(Entry.is_public) | (Entry.owner_id == current_user_id)`
The bare `Entry.is_public` in an OR expression works in SQLAlchemy but is
semantically ambiguous. After fix, it should use `Entry.is_public.is_(True)`.

The test verifies the correct behavior. It currently PASSES (bare Column works
in .where()) and should continue to PASS after the fix.
"""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client_and_app(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    from peekview.main import create_app

    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        ac._app = app
        yield ac, app


class TestBdd12EntryListVisibilityOrExpression:
    @pytest.mark.asyncio
    async def test_bdd_12_authenticated_sees_public_plus_own_private(self, client_and_app):
        client, app = client_and_app

        alice_resp = await client.post(
            "/api/v1/auth/register",
            json={"username": "alice", "password": "alicepass123"},
        )
        alice_token = alice_resp.json()["access_token"]

        bob_resp = await client.post(
            "/api/v1/auth/register",
            json={"username": "bob", "password": "bobpass123"},
        )
        bob_token = bob_resp.json()["access_token"]

        await client.post(
            "/api/v1/entries",
            json={"summary": "Alice public", "is_public": True, "slug": "alice-pub"},
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        await client.post(
            "/api/v1/entries",
            json={"summary": "Alice private", "is_public": False, "slug": "alice-priv"},
            headers={"Authorization": f"Bearer {alice_token}"},
        )
        await client.post(
            "/api/v1/entries",
            json={"summary": "Bob private", "is_public": False, "slug": "bob-priv"},
            headers={"Authorization": f"Bearer {bob_token}"},
        )

        resp = await client.get(
            "/api/v1/entries",
            headers={"Authorization": f"Bearer {bob_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        slugs = [e["slug"] for e in data["items"]]

        assert "alice-pub" in slugs, "Bob should see Alice's public entry"
        assert "alice-priv" not in slugs, "Bob should NOT see Alice's private entry"
        assert "bob-priv" in slugs, "Bob should see own private entry"
