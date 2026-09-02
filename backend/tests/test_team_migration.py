"""TPV0095 team-visibility backend TDD tests — migration & FK & EXPLAIN.

Covers BDD-16/17/26 + P2 §2/§11 FK gaps (fresh-DB delete team/user cascade).

RED in P3: Team/TeamMember table models, entries.team_id column and the
corresponding migration segments are UNIMPLEMENTED — old-DB upgrade misses
columns/tables, fresh-DB FK deletes fail, EXPLAIN lacks team indexes.

[PROD_NOT_TOUCHED] — all DBs are tmp_path files; no production access.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlmodel import Session, select

from peekview.database import init_db
from peekview.main import create_app
from peekview.models import Entry, User
from tests._team_helpers import auth, get_user, make_entry_direct, make_team, register_user


@pytest.fixture
async def team_client(tmp_path):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    db_path = tmp_path / "test.db"
    app = create_app(data_dir=data_dir, db_path=db_path)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.cookies.clear()
        ac._app = app
        yield ac


# ---------------------------------------------------------------------
# old-schema builder (raw old DB: users + entries WITHOUT team_id, no teams)
# ---------------------------------------------------------------------


def _build_old_db(db_path: Path, seed_slugs=("old-entry",)) -> None:
    conn = sqlite3.connect(str(db_path))
    conn.executescript(
        """
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            is_active BOOLEAN DEFAULT 1,
            is_admin BOOLEAN DEFAULT 0,
            disabled_at TEXT,
            disabled_by INTEGER,
            disabled_reason TEXT,
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE entries (
            id INTEGER PRIMARY KEY,
            slug TEXT NOT NULL UNIQUE,
            summary TEXT,
            status TEXT DEFAULT 'active',
            tags TEXT DEFAULT '[]',
            is_public BOOLEAN DEFAULT 1,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            user_id TEXT DEFAULT 'default',
            expires_at TEXT,
            archived_at TEXT,
            archive_delete_at TEXT,
            idempotency_key TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    conn.execute(
        "INSERT INTO users (id, username, password_hash, is_active, is_admin) "
        "VALUES (1, 'alice-old', 'x', 1, 0)"
    )
    for slug in seed_slugs:
        conn.execute(
            "INSERT INTO entries (slug, summary, is_public, owner_id, status, tags) "
            "VALUES (?, ?, 0, 1, 'ACTIVE', '[]')",
            (slug, f"old data {slug}"),
        )
    conn.commit()
    conn.close()


# =====================================================================
# BDD-16: 删除 team → entry 转 private（team_id NULL）、数据完好
# =====================================================================


class TestBdd16:
    @pytest.mark.asyncio
    async def test_bdd_16_delete_team_entries_team_id_null_owner_readable_data_intact(
        self, team_client
    ):
        token_alice = await register_user(team_client, "alice16")
        token_bob = await register_user(team_client, "bob16")
        engine = team_client._app.state.engine
        with Session(engine) as session:
            alice = get_user(session, "alice16")
            bob = get_user(session, "bob16")
            team = make_team(
                team_client._app, session, slug="proj-a16", name="A16",
                owner_id=alice.id, member_ids=[bob.id],
            )
            make_entry_direct(
                team_client._app, session, slug="del-team-entry",
                is_public=False, owner_id=alice.id, team_id=team.id,
            )

        created = await team_client.post(
            "/api/v1/entries",
            json={
                "summary": "files entry",
                "slug": "del-team-file",
                "is_public": False,
                "files": [{"path": "x.txt", "content": "payload"}],
            },
            headers=auth(token_alice),
        )
        assert created.status_code == 201
        with Session(engine) as session:
            fe = session.exec(select(Entry).where(Entry.slug == "del-team-file")).first()
            fe.team_id = team.id
            session.add(fe)
            session.commit()
            file_id = fe.files[0].id

        from peekview.models import Team

        with Session(engine) as session:
            t = session.get(Team, team.id)
            session.delete(t)
            session.commit()

        with Session(engine) as session:
            for slug in ("del-team-entry", "del-team-file"):
                row = session.exec(select(Entry).where(Entry.slug == slug)).first()
                assert row is not None, "entry data must survive team delete"
                assert row.team_id is None, "team delete must SET NULL entries.team_id"
            fk = list(session.exec(text("PRAGMA foreign_key_check")).all())
            assert fk == [], f"foreign_key_check must pass, got {fk}"
            integ = list(session.exec(text("PRAGMA integrity_check")).all())
            assert integ == [("ok",)], f"integrity_check must pass, got {integ}"

        owner_resp = await team_client.get(
            "/api/v1/entries/del-team-file", headers=auth(token_alice)
        )
        assert owner_resp.status_code == 200
        content = await team_client.get(
            f"/api/v1/entries/del-team-file/files/{file_id}/content", headers=auth(token_alice)
        )
        assert content.status_code == 200
        bob_resp = await team_client.get(
            "/api/v1/entries/del-team-file", headers=auth(token_bob)
        )
        assert bob_resp.status_code == 404


# =====================================================================
# BDD-17: 旧库升级启动成功 + 存量完好 + 幂等（双启动）
# =====================================================================


class TestBdd17:
    def test_bdd_17_old_db_upgrade_twice_ok_data_intact(self, tmp_path):
        db_path = tmp_path / "old.db"
        _build_old_db(db_path)

        engine = init_db(db_path, run_migrations=True)
        with engine.connect() as conn:
            tables = {
                r[0]
                for r in conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                )
            }
            assert "teams" in tables, "upgrade must create teams table"
            assert "team_members" in tables, "upgrade must create team_members table"
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(entries)"))}
            assert "team_id" in cols, "upgrade must add entries.team_id"
        with Session(engine) as session:
            rows = session.exec(select(Entry)).all()
            assert len(rows) == 1 and rows[0].slug == "old-entry"
            assert rows[0].team_id is None
        engine.dispose()

        engine2 = init_db(db_path, run_migrations=True)
        with Session(engine2) as session:
            rows = session.exec(select(Entry)).all()
            assert len(rows) == 1 and rows[0].slug == "old-entry"
        engine2.dispose()


# =====================================================================
# 全新库 FK（P2 §11-1）：删 team → team_members CASCADE + entries SET NULL
# =====================================================================


class TestFreshDbFkTeam:
    def test_fk_delete_team_cascades_members_set_null_entries(self, tmp_path):
        db_path = tmp_path / "fresh.db"
        engine = init_db(db_path, run_migrations=True)
        from peekview.models import Team, TeamMember

        team_id: int = 0
        with Session(engine) as session:
            alice = User(username="fk-alice", password_hash="x")
            bob = User(username="fk-bob", password_hash="x")
            session.add(alice)
            session.add(bob)
            session.commit()
            session.refresh(alice)
            session.refresh(bob)
            team = Team(slug="fk-team", name="FK", owner_id=alice.id)
            session.add(team)
            session.commit()
            session.refresh(team)
            session.add(TeamMember(team_id=team.id, user_id=bob.id))
            session.commit()
            make_entry_direct(
                None, session, slug="fk-entry",
                is_public=False, owner_id=alice.id, team_id=team.id,
            )
            team_id = team.id
            session.delete(team)
            session.commit()

            members_left = session.exec(
                text("SELECT COUNT(*) FROM team_members WHERE team_id=:t").bindparams(t=team_id)
            ).scalar()
            assert members_left == 0, "team_members must CASCADE on team delete"
            row = session.exec(select(Entry).where(Entry.slug == "fk-entry")).first()
            assert row is not None and row.team_id is None, "entries.team_id must SET NULL"
            fk = list(session.exec(text("PRAGMA foreign_key_check")).all())
            assert fk == []
        engine.dispose()


# =====================================================================
# 全新库 FK（P2 §11-1）：删 user → teams CASCADE
# =====================================================================


class TestFreshDbFkUser:
    def test_fk_delete_user_cascades_teams(self, tmp_path):
        db_path = tmp_path / "fresh2.db"
        engine = init_db(db_path, run_migrations=True)
        from peekview.models import Team

        team_id: int = 0
        with Session(engine) as session:
            alice = User(username="fk2-alice", password_hash="x")
            session.add(alice)
            session.commit()
            session.refresh(alice)
            team = Team(slug="fk2-team", name="FK2", owner_id=alice.id)
            session.add(team)
            session.commit()
            session.refresh(team)
            team_id = team.id
            session.delete(alice)
            session.commit()
            teams_left = session.exec(
                text("SELECT COUNT(*) FROM teams WHERE id=:t").bindparams(t=team_id)
            ).scalar()
            assert teams_left == 0, "teams must CASCADE when owner user deleted"
            fk = list(session.exec(text("PRAGMA foreign_key_check")).all())
            assert fk == []
        engine.dispose()


# =====================================================================
# BDD-26: EXPLAIN 计划 — team 过滤命中索引、成员 EXISTS 无逐行 SCAN
# =====================================================================


class TestBdd26Explain:
    def test_bdd_26_explain_plan_index_hit_no_scan_on_team_members(self, tmp_path):
        db_path = tmp_path / "explain.db"
        engine = init_db(db_path, run_migrations=True)
        from peekview.models import Team, TeamMember

        bob_id: int = 0
        team_id: int = 0
        with Session(engine) as session:
            alice = User(username="exp-alice", password_hash="x")
            bob = User(username="exp-bob", password_hash="x")
            session.add(alice)
            session.add(bob)
            session.commit()
            session.refresh(alice)
            session.refresh(bob)
            team = Team(slug="exp-team", name="Exp", owner_id=alice.id)
            session.add(team)
            session.commit()
            session.refresh(team)
            session.add(TeamMember(team_id=team.id, user_id=bob.id))
            bob_id = bob.id
            team_id = team.id
            for i in range(30):
                session.add(
                    Entry(
                        slug=f"exp-{i}",
                        summary=f"entry {i}",
                        is_public=False,
                        owner_id=alice.id,
                        team_id=team_id if i % 2 == 0 else None,
                    )
                )
            session.commit()

        member_list_q = (
            "SELECT e.* FROM entries e WHERE "
            "(e.is_public = 1 OR e.owner_id = :me OR EXISTS (SELECT 1 FROM team_members tm "
            "WHERE tm.user_id = :me AND tm.team_id = e.team_id))"
        )
        team_filter_q = "SELECT e.* FROM entries e WHERE e.team_id = :tid"

        with engine.connect() as conn:
            plan = list(
                conn.execute(text(f"EXPLAIN QUERY PLAN {member_list_q}"), {"me": bob_id})
            )
            plan_txt = "\n".join(str(r[3]) for r in plan)
            assert "SEARCH tm" in plan_txt, (
                "team_members visibility lookup must use an index (no row-by-row SCAN); "
                "plan:\n" + plan_txt
            )

            plan2 = list(
                conn.execute(text(f"EXPLAIN QUERY PLAN {team_filter_q}"), {"tid": team_id})
            )
            plan2_txt = "\n".join(str(r[3]) for r in plan2)
            assert "idx_entries_team_id" in plan2_txt, (
                "team filter must use idx_entries_team_id; plan:\n" + plan2_txt
            )
        engine.dispose()
