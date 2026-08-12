"""T073 BDD-6: API key expired count in admin stats.

BDD-6: Given 2 API keys (1 expired, 1 not expired),
When calling admin stats API,
Then api_keys.expired = 1.

This test FAILS because admin_service.py:156 uses `ApiKey.expires_at is not None`
which evaluates to Python bool in SQLAlchemy .where() context, producing `WHERE true`
instead of `WHERE expires_at IS NOT NULL`. This causes the expired count to be wrong.
"""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import Session, select

from peekview.models import ApiKey, User


@pytest.fixture
async def admin_client(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    from peekview.main import create_app

    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        ac._app = app
        yield ac


async def _setup_admin(client):
    admin_resp = await client.post(
        "/api/v1/auth/register",
        json={"username": "adminuser", "password": "adminpass123"},
    )
    admin_token = admin_resp.json()["access_token"]
    engine = client._app.state.engine
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "adminuser")).first()
        if user and not user.is_admin:
            user.is_admin = True
            session.add(user)
            session.commit()
    return admin_token


class TestBdd06ApiKeyExpiredCount:
    @pytest.mark.asyncio
    async def test_bdd_06_api_key_expired_count(self, admin_client):
        admin_token = await _setup_admin(admin_client)
        engine = admin_client._app.state.engine

        with Session(engine) as session:
            user = session.exec(select(User).where(User.username == "adminuser")).first()
            now = datetime.now(timezone.utc)

            expired_key = ApiKey(
                user_id=user.id,
                name="expired-key",
                key_prefix="pv_exp1",
                key_hash="hash_exp1",
                expires_at=now - timedelta(days=1),
            )
            active_key = ApiKey(
                user_id=user.id,
                name="active-key",
                key_prefix="pv_act1",
                key_hash="hash_act1",
                expires_at=now + timedelta(days=30),
            )
            session.add(expired_key)
            session.add(active_key)
            session.commit()

        resp = await admin_client.get(
            "/api/v1/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data["api_keys"]["expired"] == 1, (
            f"Expected 1 expired API key, got {data['api_keys']['expired']}"
        )
