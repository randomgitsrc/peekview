"""Tests for file storage layer.

Includes security tests for path traversal protection.
"""

import hashlib
import os
from pathlib import Path

import pytest

from peekview.config import PeekConfig, PeekStorage
from peekview.exceptions import ForbiddenPathError, StorageError
from peekview.storage import (
    compute_sha256,
    delete_entry_files,
    entry_file_exists,
    get_disk_path,
    get_entry_data_dir,
    get_entry_file_count,
    get_entry_size,
    read_entry_file,
    read_file_content,
    store_content,
    store_local_file,
    validate_local_path,
    write_file_atomic,
)


class TestGetEntryDataDir:
    """Test entry data directory calculation."""

    def test_returns_correct_path(self, tmp_path):
        """Returns path with entry ID."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        path = get_entry_data_dir(config, 42)

        assert path == tmp_path / "default" / "42"


class TestGetDiskPath:
    """Test disk path calculation."""

    def test_simple_filename(self, tmp_path):
        """Simple filename without path."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        path = get_disk_path(config, 42, None, "main.py")

        assert path == tmp_path / "default" / "42" / "main.py"

    def test_with_subdirectory(self, tmp_path):
        """Filename with subdirectory."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        path = get_disk_path(config, 42, "src/main.py", "main.py")

        assert path == tmp_path / "default" / "42" / "src" / "main.py"

    def test_deep_nesting(self, tmp_path):
        """Deep directory nesting."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        path = get_disk_path(config, 42, "a/b/c/d/file.txt", "file.txt")

        assert path == tmp_path / "default" / "42" / "a" / "b" / "c" / "d" / "file.txt"

    def test_path_traversal_blocked(self, tmp_path):
        """Path traversal is blocked."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        with pytest.raises(ForbiddenPathError) as exc_info:
            get_disk_path(config, 42, "../../../etc/passwd", "passwd")

        assert "escapes entry directory" in str(exc_info.value)

    def test_path_traversal_blocked_dotdot(self, tmp_path):
        """Multiple .. in path are blocked."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        with pytest.raises(ForbiddenPathError):
            get_disk_path(config, 42, "../secret.txt", "secret.txt")

    def test_path_traversal_in_filename(self, tmp_path):
        """Traversal in filename is blocked."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        with pytest.raises(ForbiddenPathError):
            get_disk_path(config, 42, None, "../../etc/passwd")

    def test_absolute_path_blocked(self, tmp_path):
        """Absolute paths are resolved and checked."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        with pytest.raises(ForbiddenPathError):
            get_disk_path(config, 42, "/etc/passwd", "passwd")

    def test_valid_nested_path(self, tmp_path):
        """Valid nested paths work."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        path = get_disk_path(config, 42, "lib/nested/file.py", "file.py")

        assert "lib/nested/file.py" in str(path)
        assert path.is_relative_to(tmp_path / "default" / "42")


class TestValidateLocalPath:
    """Test local path security validation."""

    def test_symlink_blocked(self, tmp_path):
        """Symlinks are blocked before resolve."""
        # Create a file and a symlink
        target = tmp_path / "target.txt"
        target.write_text("secret")
        link = tmp_path / "link.txt"
        link.symlink_to(target)

        allowed = tmp_path / "allowed"
        allowed.mkdir()
        config = PeekConfig(storage=PeekStorage(allowed_paths=[allowed]))

        with pytest.raises(ForbiddenPathError) as exc_info:
            validate_local_path(config, str(link))

        assert "Symlinks not allowed" in str(exc_info.value)

    def test_not_in_allowlist(self, tmp_path):
        """Paths outside allowlist are blocked."""
        file_path = tmp_path / "secret.txt"
        file_path.write_text("secret")

        # Empty allowlist - no access allowed
        config = PeekConfig(storage=PeekStorage(allowed_paths=[]))

        with pytest.raises(ForbiddenPathError) as exc_info:
            validate_local_path(config, str(file_path))

        assert "not in allowed directories" in str(exc_info.value)

    def test_path_in_allowlist(self, tmp_path):
        """Paths within allowlist are allowed."""
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        file_path = allowed / "file.txt"
        file_path.write_text("content")

        config = PeekConfig(storage=PeekStorage(allowed_paths=[allowed]))
        result = validate_local_path(config, str(file_path))

        assert result == file_path.resolve()

    def test_nested_path_in_allowlist(self, tmp_path):
        """Nested paths within allowlist are allowed."""
        allowed = tmp_path / "allowed"
        nested = allowed / "subdir" / "deep"
        nested.mkdir(parents=True)
        file_path = nested / "file.txt"
        file_path.write_text("content")

        config = PeekConfig(storage=PeekStorage(allowed_paths=[allowed]))
        result = validate_local_path(config, str(file_path))

        assert result == file_path.resolve()

    def test_file_not_exist(self, tmp_path):
        """Non-existent files raise error."""
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        file_path = allowed / "missing.txt"

        config = PeekConfig(storage=PeekStorage(allowed_paths=[allowed]))

        with pytest.raises(FileNotFoundError):
            validate_local_path(config, str(file_path))

    def test_directory_not_allowed(self, tmp_path):
        """Directories are not allowed."""
        allowed = tmp_path / "allowed"
        allowed.mkdir()

        config = PeekConfig(storage=PeekStorage(allowed_paths=[allowed]))

        # Directory exists but validate_local_path only checks files
        # This will pass FileNotFoundError but may fail other checks
        # Actually, Path.is_file() returns False for directories

        with pytest.raises(FileNotFoundError):
            validate_local_path(config, str(allowed))


class TestComputeSha256:
    """Test SHA256 computation."""

    def test_empty_content(self):
        """Empty content has known hash."""
        sha256 = compute_sha256(b"")
        expected = hashlib.sha256(b"").hexdigest()
        assert sha256 == expected

    def test_simple_content(self):
        """Simple content hash."""
        sha256 = compute_sha256(b"hello")
        expected = hashlib.sha256(b"hello").hexdigest()
        assert sha256 == expected

    def test_binary_content(self):
        """Binary content hash."""
        content = bytes(range(256))
        sha256 = compute_sha256(content)
        expected = hashlib.sha256(content).hexdigest()
        assert sha256 == expected


class TestWriteFileAtomic:
    """Test atomic file writes."""

    def test_writes_content(self, tmp_path):
        """Content is written."""
        target = tmp_path / "test.txt"
        write_file_atomic(target, b"hello world")

        assert target.read_bytes() == b"hello world"

    def test_creates_directories(self, tmp_path):
        """Parent directories created."""
        target = tmp_path / "a" / "b" / "c" / "file.txt"
        write_file_atomic(target, b"content")

        assert target.exists()
        assert target.read_bytes() == b"content"

    def test_atomic_rename(self, tmp_path):
        """File is renamed atomically."""
        target = tmp_path / "final.txt"
        write_file_atomic(target, b"content")

        # File should exist with correct content
        assert target.exists()
        assert target.read_bytes() == b"content"

        # No temp files should remain
        temp_files = list(tmp_path.glob(".tmp_*"))
        assert len(temp_files) == 0

    def test_overwrites_existing(self, tmp_path):
        """Overwrites existing file."""
        target = tmp_path / "existing.txt"
        target.write_text("old")

        write_file_atomic(target, b"new")

        assert target.read_bytes() == b"new"


class TestStoreContent:
    """Test storing content."""

    def test_stores_file(self, tmp_path):
        """Content stored correctly."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        content = b"Hello, World!"

        disk_path, size, sha256 = store_content(config, 42, "test.txt", "test.txt", content)

        assert disk_path.exists()
        assert disk_path.read_bytes() == content
        assert size == len(content)
        assert sha256 == hashlib.sha256(content).hexdigest()

    def test_creates_subdirectories(self, tmp_path):
        """Creates nested directories."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        store_content(config, 42, "src/main.py", "main.py", b"print('hello')")

        expected_path = tmp_path / "default" / "42" / "src" / "main.py"
        assert expected_path.exists()

    def test_blocks_traversal(self, tmp_path):
        """Blocks path traversal."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        with pytest.raises(ForbiddenPathError):
            store_content(config, 42, "../secret.txt", "secret.txt", b"data")


class TestStoreLocalFile:
    """Test storing from local file."""

    def test_copies_file(self, tmp_path):
        """Copies file to entry."""
        allowed = tmp_path / "source"
        allowed.mkdir()
        source = allowed / "source.txt"
        source.write_text("source content")

        config = PeekConfig(storage=PeekStorage(
            data_dir=tmp_path / "data",
            allowed_paths=[allowed],
        ))

        disk_path, size, sha256 = store_local_file(
            config, 1, "dest.txt", "dest.txt", str(source)
        )

        assert disk_path.exists()
        assert disk_path.read_text() == "source content"
        assert size == len("source content")

    def test_requires_allowlist(self, tmp_path):
        """Requires path in allowlist."""
        source = tmp_path / "secret.txt"
        source.write_text("secret")

        # No allowlist
        config = PeekConfig(storage=PeekStorage(
            data_dir=tmp_path / "data",
            allowed_paths=[],
        ))

        with pytest.raises(ForbiddenPathError):
            store_local_file(config, 1, "dest.txt", "dest.txt", str(source))

    def test_blocks_symlink(self, tmp_path):
        """Blocks symlink even if target is allowed."""
        allowed = tmp_path / "allowed"
        allowed.mkdir()
        target = allowed / "target.txt"
        target.write_text("content")
        link = tmp_path / "link.txt"
        link.symlink_to(target)

        config = PeekConfig(storage=PeekStorage(
            data_dir=tmp_path / "data",
            allowed_paths=[allowed],
        ))

        with pytest.raises(ForbiddenPathError) as exc_info:
            store_local_file(config, 1, "dest.txt", "dest.txt", str(link))

        assert "Symlinks not allowed" in str(exc_info.value)


class TestReadFileContent:
    """Test reading file content."""

    def test_reads_content(self, tmp_path):
        """Reads file content."""
        file_path = tmp_path / "test.txt"
        file_path.write_text("hello")

        content = read_file_content(file_path)
        assert content == b"hello"

    def test_reads_binary(self, tmp_path):
        """Reads binary file."""
        file_path = tmp_path / "binary.bin"
        file_path.write_bytes(bytes(range(256)))

        content = read_file_content(file_path)
        assert content == bytes(range(256))

    def test_enforces_max_size(self, tmp_path):
        """Enforces max size."""
        file_path = tmp_path / "large.txt"
        file_path.write_bytes(b"x" * 1000)

        with pytest.raises(StorageError) as exc_info:
            read_file_content(file_path, max_size=500)

        assert "exceeds size limit" in str(exc_info.value)


class TestReadEntryFile:
    """Test reading entry file."""

    def test_reads_stored_file(self, tmp_path):
        """Reads file from entry."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        # Store first
        store_content(config, 42, "file.txt", "file.txt", b"content")

        # Read back
        content = read_entry_file(config, 42, "file.txt", "file.txt")
        assert content == b"content"

    def test_not_found(self, tmp_path):
        """Raises for missing file."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        with pytest.raises(FileNotFoundError):
            read_entry_file(config, 42, "missing.txt", "missing.txt")


class TestDeleteEntryFiles:
    """Test deleting entry files."""

    def test_deletes_directory(self, tmp_path):
        """Deletes entire entry directory."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        # Create files
        store_content(config, 42, "a.txt", "a.txt", b"a")
        store_content(config, 42, "sub/b.txt", "b.txt", b"b")

        entry_dir = tmp_path / "default" / "42"
        assert entry_dir.exists()

        # Delete
        delete_entry_files(config, 42)

        assert not entry_dir.exists()

    def test_no_error_if_missing(self, tmp_path):
        """No error if directory doesn't exist."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        # Should not raise
        delete_entry_files(config, 999)


class TestEntryFileExists:
    """Test checking file existence."""

    def test_exists(self, tmp_path):
        """Returns True for existing file."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        store_content(config, 42, "file.txt", "file.txt", b"content")

        assert entry_file_exists(config, 42, "file.txt", "file.txt")

    def test_not_exists(self, tmp_path):
        """Returns False for missing file."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        assert not entry_file_exists(config, 42, "missing.txt", "missing.txt")


class TestGetEntrySize:
    """Test calculating entry size."""

    def test_empty_entry(self, tmp_path):
        """Empty entry has size 0."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        assert get_entry_size(config, 42) == 0

    def test_sums_files(self, tmp_path):
        """Sums all file sizes."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        store_content(config, 42, "a.txt", "a.txt", b"12345")  # 5 bytes
        store_content(config, 42, "b.txt", "b.txt", b"abcde")  # 5 bytes

        assert get_entry_size(config, 42) == 10


class TestGetEntryFileCount:
    """Test counting entry files."""

    def test_empty_entry(self, tmp_path):
        """Empty entry has count 0."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))
        assert get_entry_file_count(config, 42) == 0

    def test_counts_files(self, tmp_path):
        """Counts all files."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        store_content(config, 42, "a.txt", "a.txt", b"a")
        store_content(config, 42, "sub/b.txt", "b.txt", b"b")

        assert get_entry_file_count(config, 42) == 2

    def test_ignores_directories(self, tmp_path):
        """Only counts files."""
        config = PeekConfig(storage=PeekStorage(data_dir=tmp_path))

        store_content(config, 42, "a.txt", "a.txt", b"a")
        # Directory is created automatically

        assert get_entry_file_count(config, 42) == 1
