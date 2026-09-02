"""TPV0095 team-visibility backend TDD tests — CLI teams/--team (local + remote).

Covers BDD-31/32/33/34 + P2 §3.4/R1 gaps:
  - `peekview teams` owned/joined partitions (+ --json) and local --user requirement
  - `peekview create --team` + --visibility public mutual exclusion (fail fast)
  - `peekview list --team` explicit filtering
  - remote `peekview create --team` passes team_id through PeekClient (BDD-34)
  - CLI local DB self-heal: indexes created before teams cmd

RED in P3: CLI teams command, --team/--user options, PeekClient.create_entry
team_id passthrough all UNIMPLEMENTED — Click usage errors / NoSuchOption /
missing-argument exit codes (B-class).

[PROD_NOT_TOUCHED] — isolated tmp env via isolated_fs fixture; no production.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from click.testing import CliRunner
from sqlalchemy import text
from sqlmodel import Session, select

from peekview.cli import cli
from peekview.models import User


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def isolated_fs(runner, monkeypatch, tmp_path):
    monkeypatch.setenv("PEEKVIEW_STORAGE__DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("PEEKVIEW_STORAGE__DB_PATH", str(tmp_path / "peekview.db"))
    monkeypatch.setenv("PEEKVIEW_REMOTE__URL", "")
    monkeypatch.setenv("PEEKVIEW_REMOTE__API_KEY", "")
    config_dir = tmp_path / ".peekview"
    config_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("peekview.config.CONFIG_FILE", config_dir / "config.yaml")
    with runner.isolated_filesystem() as fs:
        yield fs


def _create_user(runner, username, password="pass123456", admin=False):
    args = ["user", "create", username, "--password", password]
    if admin:
        args.append("--admin")
    result = runner.invoke(cli, args)
    assert result.exit_code == 0, result.output


def _db_engine():
    from peekview.config import PeekConfig
    from peekview.database import init_db

    config = PeekConfig()
    return init_db(config.db_path)


def _make_team_db(username, team_slug, team_name):
    from peekview.models import Team

    engine = _db_engine()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        team = Team(slug=team_slug, name=team_name, owner_id=user.id)
        session.add(team)
        session.commit()
    return engine


# =====================================================================
# BDD-31: `peekview teams` owned + joined 分区（--user 本地必填 / --json）
# =====================================================================


class TestBdd31:
    def test_bdd_31_teams_owned_joined_partitions(self, runner, isolated_fs):
        _create_user(runner, "alice31")
        _create_user(runner, "bob31")
        engine = _db_engine()
        from peekview.models import Team, TeamMember

        with Session(engine) as session:
            alice = session.exec(select(User).where(User.username == "alice31")).first()
            bob = session.exec(select(User).where(User.username == "bob31")).first()
            team = Team(slug="proj-31", name="Proj31", owner_id=alice.id)
            session.add(team)
            session.commit()
            session.refresh(team)
            session.add(TeamMember(team_id=team.id, user_id=bob.id))
            session.commit()

        missing = runner.invoke(cli, ["teams"])
        assert missing.exit_code != 0, "local teams without --user must fail fast"
        assert "--user" in missing.output or "user" in missing.output.lower()

        text_res = runner.invoke(cli, ["teams", "--user", "alice31"])
        assert text_res.exit_code == 0, text_res.output
        assert "owned" in text_res.output.lower()
        assert "proj-31" in text_res.output

        json_res = runner.invoke(cli, ["teams", "--user", "alice31", "--json"])
        assert json_res.exit_code == 0, json_res.output
        data = json.loads(json_res.output)
        assert set(data.keys()) == {"owned", "joined"}
        assert {"slug": "proj-31", "name": "Proj31"} in data["owned"]

        json_bob = runner.invoke(cli, ["teams", "--user", "bob31", "--json"])
        bob_data = json.loads(json_bob.output)
        assert {"slug": "proj-31", "name": "Proj31"} in bob_data["joined"]


# =====================================================================
# BDD-31 gap (R1): CLI 本地直建库含两 team 索引
# =====================================================================


class TestCliIndexes:
    def test_bdd_31_cli_local_db_has_team_indexes(self, runner, isolated_fs):
        _create_user(runner, "idxuser")
        engine = _db_engine()
        with engine.connect() as conn:
            indexes = {
                r[0]
                for r in conn.execute(
                    text("SELECT name FROM sqlite_master WHERE type='index'")
                )
            }
            assert "idx_entries_team_id" in indexes, (
                "CLI local DB must create idx_entries_team_id"
            )
            assert "idx_team_members_user_id" in indexes, (
                "CLI local DB must create idx_team_members_user_id"
            )


# =====================================================================
# BDD-32: create --team 发布到 team；与 --visibility public 互斥 fail fast
# =====================================================================


class TestBdd32:
    def test_bdd_32_create_team_and_visibility_conflict(self, runner, isolated_fs):
        _create_user(runner, "alice32")
        _make_team_db("alice32", "proj-32", "Proj32")

        test_file = Path("cli-teams.md")
        test_file.write_text("# report")

        conflict = runner.invoke(
            cli,
            [
                "create", "-s", "report", "--team", "proj-32",
                "--visibility", "public", "--user", "alice32", str(test_file),
            ],
        )
        assert conflict.exit_code != 0, "team+public conflict must fail fast"
        assert "public" in conflict.output.lower() or "visibility" in conflict.output.lower(), (
            f"conflict must be reported (not silent), got: {conflict.output}"
        )

        ok = runner.invoke(
            cli,
            [
                "create", "-s", "report", "--team", "proj-32",
                "--user", "alice32", str(test_file),
            ],
        )
        assert ok.exit_code == 0, ok.output
        assert "Created" in ok.output

        from peekview.models import Entry

        with Session(_db_engine()) as session:
            entries = session.exec(select(Entry)).all()
            assert entries, "entry must exist"
            assert entries[-1].team_id is not None, "created entry must carry team_id"
            assert entries[-1].is_public is False


# =====================================================================
# BDD-33: list --team 显式过滤
# =====================================================================


class TestBdd33:
    def test_bdd_33_list_team_explicit_filter(self, runner, isolated_fs):
        _create_user(runner, "alice33")
        engine = _db_engine()
        from peekview.models import Entry, Team

        with Session(engine) as session:
            alice = session.exec(select(User).where(User.username == "alice33")).first()
            team_a = Team(slug="proj-33a", name="A33", owner_id=alice.id)
            team_b = Team(slug="other-33", name="Other33", owner_id=alice.id)
            session.add(team_a)
            session.add(team_b)
            session.commit()
            session.refresh(team_a)
            session.refresh(team_b)
            for i in range(2):
                session.add(
                    Entry(
                        slug=f"t33-a-{i}", summary=f"a {i}", is_public=False,
                        owner_id=alice.id, team_id=team_a.id,
                    )
                )
            session.add(
                Entry(
                    slug="t33-b", summary="b", is_public=False,
                    owner_id=alice.id, team_id=team_b.id,
                )
            )
            session.commit()

        result = runner.invoke(cli, ["list", "--team", "proj-33a", "--user", "alice33"])
        assert result.exit_code == 0, result.output
        assert "t33-a-0" in result.output
        assert "t33-a-1" in result.output
        assert "t33-b" not in result.output, "team filter must be explicit (no aggregation)"

        all_res = runner.invoke(cli, ["list", "--user", "alice33"])
        assert all_res.exit_code == 0
        assert "t33-b" in all_res.output


# =====================================================================
# BDD-34: 远程模式经 PeekClient 透传 team_id（验收锚）
# =====================================================================


class TestBdd34:
    def test_bdd_34_remote_create_peekclient_passes_team_id(
        self, runner, isolated_fs, monkeypatch
    ):
        from peekview.client import PeekClient, RemoteEntry

        captured = {}

        class StubPeekClient(PeekClient):
            def create_entry(self, **kwargs):
                captured.update(kwargs)
                return RemoteEntry(
                    id=1, slug="remote-team-entry",
                    url=f"{self.base_url}/remote-team-entry",
                    summary=kwargs.get("summary", ""), status="active", tags=[],
                    files=[], expires_at=None, created_at=None, updated_at=None,
                )

        monkeypatch.setenv("PEEKVIEW_REMOTE__URL", "http://127.0.0.1:18999")
        monkeypatch.setenv("PEEKVIEW_REMOTE__API_KEY", "remote-key")
        monkeypatch.setattr("peekview.cli.PeekClient", StubPeekClient)

        test_file = Path("remote.md")
        test_file.write_text("# remote report")
        result = runner.invoke(
            cli,
            ["create", "-s", "远程报告", "--team", "proj-31", str(test_file)],
        )
        assert result.exit_code == 0, result.output
        assert "→ Remote mode:" in result.output
        assert captured.get("team_id") == "proj-31", (
            f"PeekClient.create_entry must receive team_id, got {captured}"
        )
        assert not (captured.get("is_public") is True and captured.get("team_id")), (
            "remote create must not send is_public=True together with team"
        )
