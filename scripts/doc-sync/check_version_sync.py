#!/usr/bin/env python3
"""
Check version consistency across all documentation files.
"""

import re
from pathlib import Path


def get_code_version() -> str:
    """Get version from pyproject.toml (source of truth)."""
    pyproject = Path("backend/pyproject.toml")
    if not pyproject.exists():
        raise FileNotFoundError("backend/pyproject.toml not found")

    content = pyproject.read_text()
    match = re.search(r'version = "(\d+\.\d+\.\d+)"', content)
    if not match:
        raise ValueError("Version not found in pyproject.toml")
    return match.group(1)


def check_file_version(filepath: Path, version: str, patterns: list) -> tuple[bool, str]:
    """Check if version exists in file."""
    if not filepath.exists():
        return False, f"File not found: {filepath}"

    content = filepath.read_text()

    for pattern in patterns:
        if re.search(pattern.replace(r'\d+\.\d+\.\d+', version), content):
            return True, "OK"

    return False, f"Version {version} not found"


def main():
    print("=== Checking Version Sync ===\n")

    try:
        code_version = get_code_version()
    except (FileNotFoundError, ValueError) as e:
        print(f"❌ Error: {e}")
        return 1

    print(f"Source version (pyproject.toml): {code_version}\n")

    checks = [
        ("README.md", [
            rf"v{code_version}",
            rf"{code_version}",
        ]),
        ("INDEX.md", [
            rf"v{code_version}",
            rf"{code_version}",
        ]),
        ("CHANGELOG.md", [
            rf"## \[{code_version}\]",
        ]),
        ("CLAUDE.md", [
            rf"v{code_version}",
        ]),
    ]

    all_passed = True
    for filepath, patterns in checks:
        path = Path(filepath)
        passed, msg = check_file_version(path, code_version, patterns)
        status = "✅" if passed else "❌"
        print(f"{status} {filepath}: {msg}")
        if not passed:
            all_passed = False

    print()
    if all_passed:
        print("All version references are consistent!")
        return 0
    else:
        print("⚠️  Some files are missing version references.")
        return 1


if __name__ == "__main__":
    exit(main())
