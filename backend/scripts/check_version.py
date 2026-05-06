#!/usr/bin/env python3
"""Check version consistency across project files."""

import re
import sys
from pathlib import Path

def get_version_from_file(filepath: Path, pattern: str) -> str | None:
    """Extract version from file using regex pattern."""
    try:
        content = filepath.read_text()
        match = re.search(pattern, content)
        return match.group(1) if match else None
    except Exception:
        return None

def main():
    backend_dir = Path(__file__).parent.parent

    # Define files and their version patterns
    version_sources = {
        "pyproject.toml": (backend_dir / "pyproject.toml", r'version = "([^"]+)"'),
        "__init__.py": (backend_dir / "peekview" / "__init__.py", r'__version__ = "([^"]+)"'),
        "cli.py": (backend_dir / "peekview" / "cli.py", r'prog_name="peekview"\)$'),
        "main.py": (backend_dir / "peekview" / "main.py", r'version=__version__'),
    }

    print("Checking version consistency...")
    print("-" * 50)

    # Get pyproject.toml version as source of truth
    pyproject_version = get_version_from_file(
        version_sources["pyproject.toml"][0],
        version_sources["pyproject.toml"][1]
    )

    if not pyproject_version:
        print("ERROR: Could not read version from pyproject.toml")
        return 1

    print(f"Source version (pyproject.toml): {pyproject_version}")
    print()

    errors = []

    # Check __init__.py
    init_version = get_version_from_file(
        version_sources["__init__.py"][0],
        version_sources["__init__.py"][1]
    )
    if init_version != pyproject_version:
        errors.append(f"  ✗ __init__.py: {init_version} (expected {pyproject_version})")
    else:
        print(f"  ✓ __init__.py: {init_version}")

    # Check cli.py imports __version__
    cli_content = version_sources["cli.py"][0].read_text()
    if "from peekview import __version__" not in cli_content:
        errors.append("  ✗ cli.py: does not import __version__ from peekview")
    else:
        print("  ✓ cli.py: imports __version__ correctly")

    # Check main.py imports __version__
    main_content = version_sources["main.py"][0].read_text()
    if "from peekview import __version__" not in main_content:
        errors.append("  ✗ main.py: does not import __version__ from peekview")
    else:
        print("  ✓ main.py: imports __version__ correctly")

    print()

    if errors:
        print("ERRORS:")
        for error in errors:
            print(error)
        print()
        print("Fix: Ensure all version references use __version__ from peekview/__init__.py")
        return 1
    else:
        print("All version checks passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
