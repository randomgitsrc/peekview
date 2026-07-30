"""T073 BDD-9 & BDD-10: ruff regression prevention.

BDD-9: Given pyproject.toml with E711/E712 in ruff lint ignore list,
When reading the ignore list from pyproject.toml,
Then "E711" and "E712" are both present.

BDD-10: Given existing code uses correct SQLAlchemy Column comparison syntax
(.is_(None) / .isnot(None) / ~Column / .is_(True)),
When running `ruff check --select E711,E712`,
Then exit code is 0 (no violations found).

BDD-9 verifies the ignore list is in place (configuration guard).
BDD-10 verifies the existing code is clean (code guard).

Together they form a two-layer defense:
- Layer 1 (config): E711/E712 are in ignore list → ruff won't auto-fix them
- Layer 2 (code): even if the ignore list is removed, existing code uses valid
  SQLAlchemy syntax that doesn't trigger E711/E712

BDD-10 uses `ruff check --select E711,E712` (read-only) rather than
`make lint-fix` (which would rewrite the entire codebase per all enabled
rules, leaving the working tree dirty). This way the test has zero side
effects regardless of pass/fail.
"""

from pathlib import Path

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


class TestBdd10RuffCheckSelectE711E712:
    def test_bdd_10_existing_code_passes_e711_e712_check(self):
        """读性检查现有代码不触发 E711/E712 违规。replace `make lint-fix` → `ruff check --select E711,E712`。"""
        import subprocess

        result = subprocess.run(
            ["python3", "-m", "ruff", "check", "--select", "E711,E712", "peekview/", "tests/"],
            capture_output=True,
            text=True,
            cwd=str(BACKEND_DIR),
            timeout=60,
        )
        assert result.returncode == 0, (
            f"ruff E711/E712 violations found (E711/E712 ignore may be missing):\n"
            f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
        )
