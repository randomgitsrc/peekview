"""T073 BDD-9 & BDD-10: ruff regression prevention.

BDD-9: Given fixed code with correct SQLAlchemy Column comparison syntax,
When running `ruff check --select E711,E712`,
Then no E711/E712 violations are reported (because E711/E712 are in ignore list).

BDD-10: Given fixed code and updated ruff config (E711/E712 ignored),
When running `make lint-fix`,
Then SQLAlchemy Column comparison syntax is unchanged.

BDD-9 FAILS because pyproject.toml does not yet have E711/E712 in the ignore list.
After P4 fix, the code will use .is_(None)/.isnot(None)/~Column/.is_(True) which
are valid SQLAlchemy syntax. Without the ignore, ruff would not flag these (they
don't use == None/!= None/== False), but the ignore is needed to prevent future
regression if someone writes `Column == None` again.

The test verifies the configuration is in place, not that ruff currently flags anything.
"""

from pathlib import Path

import pytest
import tomllib

BACKEND_DIR = Path(__file__).resolve().parents[1]
PYPROJECT_TOML = BACKEND_DIR / "pyproject.toml"


class TestBdd09RuffConfigIgnoresE711E712:
    def test_bdd_09_pyproject_toml_ignores_e711_e712(self):
        with open(PYPROJECT_TOML, "rb") as f:
            config = tomllib.load(f)
        ignore_list = config.get("tool", {}).get("ruff", {}).get("lint", {}).get("ignore", [])
        assert "E711" in ignore_list, (
            f"E711 must be in ruff lint ignore list. Current ignore: {ignore_list}"
        )
        assert "E712" in ignore_list, (
            f"E712 must be in ruff lint ignore list. Current ignore: {ignore_list}"
        )


class TestBdd10LintFixIdempotent:
    def test_bdd_10_lint_fix_preserves_sqlalchemy_syntax(self):
        import subprocess

        services_dir = BACKEND_DIR / "peekview" / "services"
        database_file = BACKEND_DIR / "peekview" / "database.py"

        sqlalchemy_patterns = [
            ".is_(None)",
            ".isnot(None)",
            "~Entry.",
            "~File.",
            "~ApiKey.",
            "~EntryRead.",
            ".is_(True)",
        ]

        original_contents = {}
        for py_file in services_dir.glob("*.py"):
            content = py_file.read_text()
            if any(p in content for p in sqlalchemy_patterns):
                original_contents[str(py_file)] = content

        if database_file.exists():
            db_content = database_file.read_text()
            if any(p in db_content for p in sqlalchemy_patterns):
                original_contents[str(database_file)] = db_content

        if not original_contents:
            pytest.skip("No files with SQLAlchemy patterns found (pre-fix state)")

        result = subprocess.run(
            ["make", "lint-fix"],
            capture_output=True,
            text=True,
            cwd=str(BACKEND_DIR.parent),
            timeout=120,
        )

        changed_files = []
        for path_str, original in original_contents.items():
            current = Path(path_str).read_text()
            if current != original:
                changed_files.append(Path(path_str).name)

        assert len(changed_files) == 0, (
            f"make lint-fix changed SQLAlchemy comparisons in: {changed_files}"
        )
