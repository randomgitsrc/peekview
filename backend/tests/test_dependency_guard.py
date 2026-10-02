"""TPV0101 BDD-15 — dependency drift guard for sqlmodel.

The sqlmodel 0.0.47 regression was possible because ``pyproject.toml`` declared
``sqlmodel>=0.0.14`` with no upper bound: CI kept installing the newest release
while the local venv stayed on 0.0.38. This guard makes the constraint
mechanically checkable and fails when the bound is removed / widened.

BDD-15 (i):  the guard exists, is executable, and succeeds on the fixed repo.
BDD-15 (ii): injecting a drift (removing the upper bound) makes the guard fail.

The "inject drift" assertion is expressed as a unit test of the guard evaluator
so it can be run non-destructively. The full end-to-end injection (editing
pyproject.toml, re-running, restoring) is performed manually in P6.
"""

import tomllib
from pathlib import Path

from packaging.requirements import Requirement
from packaging.version import Version
import sqlmodel

BACKEND_DIR = Path(__file__).resolve().parents[1]
PYPROJECT_TOML = BACKEND_DIR / "pyproject.toml"


def _read_sqlmodel_requirement() -> Requirement | None:
    """Parse the sqlmodel Requirement from backend/pyproject.toml."""
    with open(PYPROJECT_TOML, "rb") as fh:
        config = tomllib.load(fh)
    dependencies = config.get("project", {}).get("dependencies", [])
    for raw in dependencies:
        requirement = Requirement(raw)
        if requirement.name == "sqlmodel":
            return requirement
    return None


def _has_upper_bound(requirement: Requirement) -> bool:
    """True if the requirement constrains sqlmodel below some version."""
    return any(spec.operator in ("<", "<=", "==", "~=") for spec in requirement.specifier)


def _guard_failures(requirement: Requirement | None, installed: str) -> list[str]:
    """Return drift findings for a (requirement, installed version) pair.

    Empty list means the guard passes. Kept pure so the unit tests can feed an
    artificially drifted requirement without touching pyproject.toml.
    """
    failures: list[str] = []
    if requirement is None:
        return ["pyproject.toml does not declare a sqlmodel dependency"]
    if not _has_upper_bound(requirement):
        failures.append(
            f"sqlmodel requirement {requirement} has no upper bound; "
            "a future release can silently break the build"
        )
    if not requirement.specifier.contains(Version(installed), prereleases=True):
        failures.append(
            f"installed sqlmodel {installed} does not satisfy {requirement}"
        )
    return failures


class TestBdd15DependencyGuard:
    def test_bdd_15_guard_exists_and_passes_on_fixed_repo(self):
        requirement = _read_sqlmodel_requirement()
        assert requirement is not None, (
            "backend/pyproject.toml must declare a sqlmodel dependency"
        )
        failures = _guard_failures(requirement, sqlmodel.__version__)
        assert failures == [], "dependency drift guard failed: " + "; ".join(failures)

    def test_bdd_15_injected_drift_turns_guard_red(self):
        """Removing the upper bound must make the guard fail (not silently pass)."""
        drifted = Requirement("sqlmodel>=0.0.14")
        failures = _guard_failures(drifted, sqlmodel.__version__)
        assert failures, "guard accepted an unbounded sqlmodel requirement (drift not detected)"
        assert any("no upper bound" in failure for failure in failures)

    def test_bdd_15_installed_version_within_declared_bound(self):
        requirement = _read_sqlmodel_requirement()
        assert requirement is not None
        assert requirement.specifier.contains(Version(sqlmodel.__version__), prereleases=True), (
            f"installed sqlmodel {sqlmodel.__version__} is outside {requirement}"
        )
