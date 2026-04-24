"""File storage management for Peek.

Handles file operations with:
- Atomic writes (temp → rename)
- Path validation (traversal protection)
- Directory structure preservation
- SHA256 content hashing
"""

import hashlib
import logging
import shutil
import tempfile
from pathlib import Path

from peekview.config import PeekConfig
from peekview.exceptions import ForbiddenPathError, StorageError
from peekview.models import Entry

logger = logging.getLogger(__name__)


def get_entry_data_dir(config: PeekConfig, entry_id: int) -> Path:
    """Get the data directory for an entry.

    Args:
        config: Peek configuration
        entry_id: Entry ID

    Returns:
        Path to entry data directory
    """
    return config.data_dir / "default" / str(entry_id)


def get_disk_path(
    config: PeekConfig,
    entry_id: int,
    file_path: str | None,
    filename: str,
) -> Path:
    """Calculate the disk storage path for a file.

    Preserves directory structure from file_path. Validates that
    the resulting path stays within the entry directory.

    Args:
        config: Peek configuration
        entry_id: Entry ID
        file_path: Relative path including directories (e.g., "src/main.py")
        filename: Just the filename (e.g., "main.py")

    Returns:
        Absolute path to storage location

    Raises:
        ForbiddenPathError: If path escapes entry directory
    """
    # Base directory for this entry
    base = get_entry_data_dir(config, entry_id)
    base = base.resolve()

    # Determine the relative path to use
    if file_path:
        # file_path includes filename
        rel_path = file_path
    else:
        # Just the filename
        rel_path = filename

    # Compute the full path
    target = (base / rel_path).resolve()

    # SECURITY: Validate path doesn't escape entry directory
    # After resolve(), check target starts with base
    try:
        target.relative_to(base)
    except ValueError:
        raise ForbiddenPathError(
            f"Path escapes entry directory: {file_path or filename}"
        )

    return target


def validate_local_path(
    config: PeekConfig,
    local_path: str,
) -> Path:
    """Validate a local path for security.

    Checks:
    1. Path is within allowed directories (allowlist, with data_dir fallback)
    2. Not a symlink (checked before resolve)
    3. File exists and is readable

    Args:
        config: Peek configuration
        local_path: Path provided by user

    Returns:
        Resolved Path object

    Raises:
        ForbiddenPathError: If path is not allowed
        FileNotFoundError: If file doesn't exist
    """
    original = Path(local_path)

    # SECURITY: Check symlink BEFORE resolve (v2 fix #6)
    if original.is_symlink():
        raise ForbiddenPathError(f"Symlinks not allowed: {local_path}")

    # Resolve to absolute path
    try:
        resolved = original.resolve()
    except (OSError, RuntimeError) as e:
        raise ForbiddenPathError(f"Cannot resolve path: {local_path} ({e})")

    # SECURITY: Check allowlist (v2 fix #2) - uses data_dir as fallback if allowed_paths empty
    if not config.is_local_path_allowed(resolved):
        raise ForbiddenPathError(
            f"Path not in allowed directories: {local_path}. "
            f"Configure 'allowed_paths' in ~/.peek/config.yaml"
        )

    # Check file exists
    if not resolved.is_file():
        raise FileNotFoundError(f"File not found: {local_path}")

    return resolved


def compute_sha256(content: bytes) -> str:
    """Compute SHA256 hash of content.

    Args:
        content: File content as bytes

    Returns:
        Hex digest string (64 characters)
    """
    return hashlib.sha256(content).hexdigest()


def write_file_atomic(
    target_path: Path,
    content: bytes,
) -> None:
    """Write file atomically using temp + rename pattern.

    Creates parent directories if needed. Uses a temp file in the
    same directory as the target to ensure atomic rename.

    Args:
        target_path: Final destination path
        content: File content as bytes

    Raises:
        StorageError: If write fails
    """
    target_path = Path(target_path)

    # Create parent directories
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise StorageError(f"Cannot create directory: {target_path.parent} ({e})")

    # Use temp file in same directory for atomic rename
    temp_fd = None
    temp_path = None

    try:
        # Create temp file in same directory (for atomic rename)
        temp_fd, temp_path_str = tempfile.mkstemp(
            dir=target_path.parent,
            prefix=".tmp_",
            suffix=".write",
        )
        temp_path = Path(temp_path_str)

        # Write content
        try:
            import os

            os.write(temp_fd, content)
            os.fsync(temp_fd)  # Ensure data is on disk
        finally:
            os.close(temp_fd)
            temp_fd = None

        # Atomic rename
        temp_path.rename(target_path)

    except OSError as e:
        # Cleanup temp file on error
        if temp_path and temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
        raise StorageError(f"Failed to write file: {target_path} ({e})")

    logger.debug(f"Wrote {len(content)} bytes to {target_path}")


def read_file_content(path: Path, max_size: int | None = None) -> bytes:
    """Read file content with optional size limit.

    Args:
        path: File path
        max_size: Maximum bytes to read (None = unlimited)

    Returns:
        File content as bytes

    Raises:
        StorageError: If read fails or exceeds max_size
    """
    try:
        if max_size is not None:
            # Check size first
            size = path.stat().st_size
            if size > max_size:
                raise StorageError(
                    f"File exceeds size limit: {size} > {max_size} bytes"
                )

        return path.read_bytes()

    except OSError as e:
        raise StorageError(f"Failed to read file: {path} ({e})")


def store_content(
    config: PeekConfig,
    entry_id: int,
    file_path: str | None,
    filename: str,
    content: bytes,
) -> tuple[Path, int, str]:
    """Store file content for an entry.

    Args:
        config: Peek configuration
        entry_id: Entry ID
        file_path: Relative path (e.g., "src/main.py")
        filename: Just the filename (e.g., "main.py")
        content: File content as bytes

    Returns:
        Tuple of (disk_path, size, sha256)
    """
    # Calculate target path (validates path traversal)
    target = get_disk_path(config, entry_id, file_path, filename)

    # Compute hash before write
    sha256 = compute_sha256(content)

    # Atomic write
    write_file_atomic(target, content)

    return target, len(content), sha256


def store_local_file(
    config: PeekConfig,
    entry_id: int,
    file_path: str | None,
    filename: str,
    local_path: str,
) -> tuple[Path, int, str]:
    """Store a file from local filesystem.

    Validates local_path is allowed, then copies to entry directory.

    Args:
        config: Peek configuration
        entry_id: Entry ID
        file_path: Relative path in entry
        filename: Filename in entry
        local_path: Source path on local filesystem

    Returns:
        Tuple of (disk_path, size, sha256)

    Raises:
        ForbiddenPathError: If local_path not allowed
    """
    # Validate local path (v2 fix #2 - allowlist check)
    source = validate_local_path(config, local_path)

    # Read source
    content = read_file_content(source)

    # Store in entry directory
    return store_content(config, entry_id, file_path, filename, content)


def delete_entry_files(config: PeekConfig, entry_id: int) -> None:
    """Delete all files for an entry.

    Args:
        config: Peek configuration
        entry_id: Entry ID
    """
    entry_dir = get_entry_data_dir(config, entry_id)

    if entry_dir.exists():
        try:
            shutil.rmtree(entry_dir)
            logger.info(f"Deleted entry directory: {entry_dir}")
        except OSError as e:
            logger.error(f"Failed to delete entry directory: {entry_dir} ({e})")
            raise StorageError(f"Failed to delete entry files: {e}")


def read_entry_file(
    config: PeekConfig,
    entry_id: int,
    file_path: str | None,
    filename: str,
) -> bytes:
    """Read a file from an entry.

    Args:
        config: Peek configuration
        entry_id: Entry ID
        file_path: Relative path
        filename: Filename

    Returns:
        File content as bytes
    """
    disk_path = get_disk_path(config, entry_id, file_path, filename)

    if not disk_path.exists():
        raise FileNotFoundError(f"File not found: {disk_path}")

    return read_file_content(disk_path)


def entry_file_exists(
    config: PeekConfig,
    entry_id: int,
    file_path: str | None,
    filename: str,
) -> bool:
    """Check if a file exists in an entry.

    Args:
        config: Peek configuration
        entry_id: Entry ID
        file_path: Relative path
        filename: Filename

    Returns:
        True if file exists
    """
    try:
        disk_path = get_disk_path(config, entry_id, file_path, filename)
        return disk_path.is_file()
    except ForbiddenPathError:
        return False


def get_entry_size(config: PeekConfig, entry_id: int) -> int:
    """Get total size of all files in an entry.

    Args:
        config: Peek configuration
        entry_id: Entry ID

    Returns:
        Total size in bytes
    """
    entry_dir = get_entry_data_dir(config, entry_id)

    if not entry_dir.exists():
        return 0

    total = 0
    for path in entry_dir.rglob("*"):
        if path.is_file():
            total += path.stat().st_size

    return total


def get_entry_file_count(config: PeekConfig, entry_id: int) -> int:
    """Get number of files in an entry.

    Args:
        config: Peek configuration
        entry_id: Entry ID

    Returns:
        File count
    """
    entry_dir = get_entry_data_dir(config, entry_id)

    if not entry_dir.exists():
        return 0

    count = 0
    for path in entry_dir.rglob("*"):
        if path.is_file():
            count += 1

    return count


class StorageManager:
    """High-level storage manager that wraps storage functions with config.

    This provides a class-based interface for services that need
    to interact with file storage.
    """

    def __init__(self, config: PeekConfig | None = None, data_dir: Path | None = None):
        """Initialize storage manager.

        Args:
            config: Peek configuration (uses data_dir from config)
            data_dir: Direct path to data directory (alternative to config)
        """
        if config:
            self.config = config
            self.data_dir = config.data_dir
        elif data_dir:
            self.config = None
            self.data_dir = data_dir
        else:
            raise ValueError("Either config or data_dir must be provided")

    def get_entry_data_dir(self, entry_id: int) -> Path:
        """Get the data directory for an entry."""
        return self.data_dir / "default" / str(entry_id)

    def get_disk_path(
        self,
        entry_id: int,
        filename: str,
        file_path: str | None = None,
    ) -> Path:
        """Calculate the disk storage path for a file."""
        return get_disk_path(self.config or PeekConfig(), entry_id, file_path, filename)

    def write_file(
        self,
        entry_id: int,
        filename: str,
        content: bytes,
        file_path: str | None = None,
    ) -> Path:
        """Write file content for an entry."""
        return store_content(
            self.config or PeekConfig(), entry_id, file_path, filename, content
        )[0]

    def read_file(
        self,
        entry_id: int,
        filename: str,
        file_path: str | None = None,
    ) -> bytes:
        """Read a file from an entry."""
        return read_entry_file(
            self.config or PeekConfig(), entry_id, file_path, filename
        )

    def delete_entry_files(self, entry_id: int) -> None:
        """Delete all files for an entry."""
        delete_entry_files(self.config or PeekConfig(), entry_id)

    def file_exists(
        self,
        entry_id: int,
        filename: str,
        file_path: str | None = None,
    ) -> bool:
        """Check if a file exists in an entry."""
        return entry_file_exists(
            self.config or PeekConfig(), entry_id, file_path, filename
        )

    def get_entry_size(self, entry_id: int) -> int:
        """Get total size of all files in an entry."""
        return get_entry_size(self.config or PeekConfig(), entry_id)

    def get_entry_file_count(self, entry_id: int) -> int:
        """Get number of files in an entry."""
        return get_entry_file_count(self.config or PeekConfig(), entry_id)

    def compute_sha256(self, content: bytes) -> str:
        """Compute SHA256 hash of content."""
        return compute_sha256(content)
