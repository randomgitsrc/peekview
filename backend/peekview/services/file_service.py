"""File processing logic — local_path allowlist security, directory scanning, binary detection."""

from __future__ import annotations

import base64
import logging
import re
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

from peekview.exceptions import ForbiddenPathError
from peekview.language import detect_language, is_binary_content

logger = logging.getLogger(__name__)

# Bounds for expires_in
_MIN_EXPIRES = timedelta(minutes=1)
_MAX_EXPIRES = timedelta(days=365)


@dataclass
class FileInfo:
    """Scanned file metadata."""

    path: str | None  # Relative path (e.g. "src/main.py")
    filename: str  # File name
    local_path: str  # Absolute path on server
    language: str | None = None
    is_binary: bool = False
    size: int = 0


def validate_local_path(
    local_path: str,
    allowed_dirs: list[Path],
    data_dir: Path | None = None,
) -> Path:
    """Validate that local_path is safe to read using ALLOWLIST approach.

    Security checks (in order):
    1. Reject `..` components in the original path string
    2. Reject symlinks (check is_symlink() BEFORE resolve())
    3. Resolve the path
    4. Reject hardlinks (st_nlink > 1)
    5. Verify path is within one of allowed_dirs (or data_dir if allowed_dirs empty)
    6. Verify path points to a regular file

    Args:
        local_path: User-supplied filesystem path.
        allowed_dirs: List of allowed directory prefixes (allowlist).
        data_dir: Fallback allowed dir when allowed_dirs is empty.

    Returns:
        Resolved Path object.

    Raises:
        ForbiddenPathError: Path fails security check.
        FileNotFoundError: Path doesn't exist.
        ValueError: Path is a directory, not a file.
    """
    original = Path(local_path)

    # 1. Reject .. components in the path string
    if ".." in original.parts:
        raise ForbiddenPathError(f"Path traversal (..) not allowed: {local_path}")

    # 2. Reject symlinks BEFORE resolve()
    if original.is_symlink():
        raise ForbiddenPathError(f"Symlinks not allowed: {local_path}")

    resolved = original.resolve()

    # 3. Must exist
    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {local_path}")

    # 4. Must be a regular file, not a directory (check before hardlinks - tmpfs dirs have nlink > 1)
    if resolved.is_dir():
        raise ValueError(f"Path is a directory, not a file: {local_path}")

    # 5. Reject hardlinks (nlink > 1) - only for files
    try:
        stat_result = resolved.stat()
        if stat_result.st_nlink > 1:
            raise ForbiddenPathError(f"Hardlinks not allowed: {local_path}")
    except FileNotFoundError:
        pass  # Will be caught below

    # 6. Allowlist check — path must be within one of allowed_dirs
    effective_allowed = allowed_dirs if allowed_dirs else ([data_dir] if data_dir else [])
    if effective_allowed:
        path_allowed = False
        for allowed_dir in effective_allowed:
            allowed_resolved = allowed_dir.resolve()
            try:
                resolved.relative_to(allowed_resolved)
                path_allowed = True
                break
            except ValueError:
                continue
        if not path_allowed:
            raise ForbiddenPathError(
                f"Path is outside allowed directories: {local_path}"
            )

    return resolved


def scan_directory(
    dir_path: str, allowed_dirs: list[Path], ignored_dirs: set[str]
) -> list[FileInfo]:
    """Recursively scan a directory for files.

    Each discovered file is individually validated against allowed_dirs.

    Args:
        dir_path: Absolute directory path.
        allowed_dirs: Allowed directory prefixes for path validation.
        ignored_dirs: Set of directory names to skip (e.g. {".git", "node_modules"}).

    Returns:
        List of FileInfo objects for discovered files.
    """
    root = Path(dir_path).resolve()
    files: list[FileInfo] = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        # Skip files in ignored directories
        if any(part in ignored_dirs for part in path.parts):
            continue
        # Skip hidden files/dirs (name starts with .)
        try:
            rel = path.relative_to(root)
        except ValueError:
            continue
        if any(part.startswith(".") for part in rel.parts):
            continue

        # Validate each individual file path
        try:
            validate_local_path(str(path), allowed_dirs=allowed_dirs)
        except (ForbiddenPathError, ValueError):
            logger.warning("Skipping disallowed file in scan: %s", path)
            continue

        try:
            content = path.read_bytes()
            binary = is_binary_content(content)
            lang = detect_language(path.name) if not binary else None
        except (OSError, PermissionError):
            logger.warning("Cannot read file: %s", path)
            continue

        files.append(
            FileInfo(
                path=str(rel) if str(rel) != path.name else None,
                filename=path.name,
                local_path=str(path),
                language=lang,
                is_binary=binary,
                size=path.stat().st_size,
            )
        )

    return files


def parse_expires_in(expires_in: str) -> timedelta:
    """Parse expires_in string to timedelta with bounds checking.

    Supported formats: "1h" (hours), "30m" (minutes), "7d" (days).

    Bounds:
    - Minimum: 1 minute
    - Maximum: 365 days

    Args:
        expires_in: Duration string.

    Returns:
        timedelta object.

    Raises:
        ValueError: Invalid format, zero/negative duration, or out of bounds.
    """
    match = re.match(r"^(\d+)([hmd])$", expires_in)
    if not match:
        raise ValueError(
            f"Invalid expires_in format: {expires_in!r}. Use e.g. '1h', '30m', '7d'"
        )

    value = int(match.group(1))
    unit = match.group(2)

    if unit == "h":
        delta = timedelta(hours=value)
    elif unit == "m":
        delta = timedelta(minutes=value)
    elif unit == "d":
        delta = timedelta(days=value)
    else:
        raise ValueError(f"Unknown time unit: {unit}")

    # Bounds checking (also catches value <= 0 since _MIN_EXPIRES is 1 minute)
    if delta < _MIN_EXPIRES:
        raise ValueError(f"expires_in must be at least 1 minute, got: {expires_in!r}")
    if delta > _MAX_EXPIRES:
        raise ValueError(f"expires_in must be at most 365 days, got: {expires_in!r}")

    return delta


def decode_base64_content(content_base64: str) -> bytes:
    """Decode base64 content string.

    Args:
        content_base64: Base64-encoded string.

    Returns:
        Decoded bytes.

    Raises:
        ValueError: Invalid base64.
    """
    try:
        return base64.b64decode(content_base64, validate=True)
    except Exception as e:
        raise ValueError(f"Invalid base64 content: {e}") from e
