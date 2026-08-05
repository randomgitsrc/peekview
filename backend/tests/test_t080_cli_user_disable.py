"""T080 CLI user disable/enable/demote LastAdmin — TDD red-light tests.

BDD coverage (1:1 mapping):
  BDD-17: CLI disable user -> user cannot login
  BDD-18: CLI enable user -> user can login
  BDD-19: CLI demote last active admin -> refused
  BDD-24: CLI disable last active admin -> refused

All tests are RED in P3 (disable/enable commands not yet implemented;
demote LastAdmin protection not yet implemented).
"""

import pytest
from click.testing import CliRunner

from peekview.cli import cli


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


def _make_admin(isolated_fs):
    from peekview.config import PeekConfig
    from peekview.database import check_schema, init_db
    from sqlmodel import Session, select

    from peekview.models import User

    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)
    with Session(engine) as s:
        u = s.exec(select(User).where(User.username == "eve17")).first()
        if u:
            u.is_admin = True
            s.add(u)
            s.commit()


# --- BDD-17: CLI disable user -> user cannot login --- #


def test_bdd_17_cli_disable_user_cannot_login(runner, isolated_fs):
    _create_user(runner, "admin17", "adminpass123", admin=True)
    _create_user(runner, "eve17", "evepass123")

    result = runner.invoke(cli, ["user", "disable", "eve17"])
    assert result.exit_code == 0, result.output
    assert "disabled" in result.output.lower() or "✓" in result.output

    from peekview.config import PeekConfig
    from peekview.database import check_schema, init_db
    from sqlmodel import Session, select

    from peekview.models import User

    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)
    with Session(engine) as s:
        u = s.exec(select(User).where(User.username == "eve17")).first()
        assert u is not None
        assert u.is_active is False


# --- BDD-18: CLI enable user -> user can login --- #


def test_bdd_18_cli_enable_user_can_login(runner, isolated_fs):
    _create_user(runner, "admin18", "adminpass123", admin=True)
    _create_user(runner, "eve18", "evepass123")

    runner.invoke(cli, ["user", "disable", "eve18"])

    result = runner.invoke(cli, ["user", "enable", "eve18"])
    assert result.exit_code == 0, result.output
    assert "enabled" in result.output.lower() or "✓" in result.output

    from peekview.config import PeekConfig
    from peekview.database import check_schema, init_db
    from sqlmodel import Session, select

    from peekview.models import User

    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)
    with Session(engine) as s:
        u = s.exec(select(User).where(User.username == "eve18")).first()
        assert u is not None
        assert u.is_active is True


# --- BDD-19: CLI demote last active admin -> refused --- #


def test_bdd_19_cli_demote_last_admin_refused(runner, isolated_fs):
    _create_user(runner, "admin1_19", "adminpass123", admin=True)

    result = runner.invoke(cli, ["user", "demote", "admin1_19"])
    assert result.exit_code != 0, result.output
    assert "last" in result.output.lower() or "admin" in result.output.lower()

    from peekview.config import PeekConfig
    from peekview.database import check_schema, init_db
    from sqlmodel import Session, select

    from peekview.models import User

    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)
    with Session(engine) as s:
        u = s.exec(select(User).where(User.username == "admin1_19")).first()
        assert u is not None
        assert u.is_admin is True


# --- BDD-24: CLI disable last active admin -> refused --- #


def test_bdd_24_cli_disable_last_admin_refused(runner, isolated_fs):
    _create_user(runner, "admin1_24", "adminpass123", admin=True)

    result = runner.invoke(cli, ["user", "disable", "admin1_24"])
    assert result.exit_code != 0, result.output
    assert "last" in result.output.lower() or "admin" in result.output.lower()

    from peekview.config import PeekConfig
    from peekview.database import check_schema, init_db
    from sqlmodel import Session, select

    from peekview.models import User

    config = PeekConfig()
    engine = init_db(config.db_path)
    check_schema(engine)
    with Session(engine) as s:
        u = s.exec(select(User).where(User.username == "admin1_24")).first()
        assert u is not None
        assert u.is_active is True
