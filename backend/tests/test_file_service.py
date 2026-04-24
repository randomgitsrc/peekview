"""Tests for file service."""

import os
from pathlib import Path

import pytest

from peek.exceptions import ForbiddenPathError
from peek.services.file_service import (
    FileInfo,
    decode_base64_content,
    parse_expires_in,
    scan_directory,
    validate_local_path,
)


# --- validate_local_path (ALLOWLIST approach) ---


def test_validate_local_path_allowed_dir(tmp_path):
    """File within allowed_dirs is accepted."""
    f = tmp_path / "hello.py"
    f.write_text("print('hi')")
    result = validate_local_path(str(f), allowed_dirs=[tmp_path])
    assert result == f.resolve()


def test_validate_local_path_outside_allowed_dir(tmp_path):
    """File outside all allowed_dirs is rejected."""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "forbidden"
    outside.mkdir()
    secret = outside / "secret.py"
    secret.write_text("secret")
    with pytest.raises(ForbiddenPathError):
        validate_local_path(str(secret), allowed_dirs=[allowed])


def test_validate_local_path_no_allowed_dirs_uses_data_dir(tmp_path):
    """When allowed_dirs is empty, data_dir is used as the only allowed dir."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    f = data_dir / "file.py"
    f.write_text("ok")
    # Should succeed — file is within data_dir
    result = validate_local_path(str(f), allowed_dirs=[], data_dir=data_dir)
    assert result == f.resolve()


def test_validate_local_path_symlink_rejected(tmp_path):
    """Symlinks are rejected — checked BEFORE resolve()."""
    real = tmp_path / "real.txt"
    real.write_text("content")
    link = tmp_path / "link.txt"
    link.symlink_to(real)
    with pytest.raises(ForbiddenPathError, match="[Ss]ymlink"):
        validate_local_path(str(link), allowed_dirs=[tmp_path])


def test_validate_local_path_hardlink_rejected(tmp_path):
    """Hardlinks (st_nlink > 1) are rejected."""
    original = tmp_path / "original.txt"
    original.write_text("content")
    hardlink = tmp_path / "hardlink.txt"
    os.link(str(original), str(hardlink))
    # original now has st_nlink == 2
    with pytest.raises(ForbiddenPathError, match="[Hh]ardlink"):
        validate_local_path(str(original), allowed_dirs=[tmp_path])


def test_validate_local_path_dotdot_rejected():
    """Paths with .. components are rejected."""
    with pytest.raises(ForbiddenPathError, match="\\.\\."):
        validate_local_path("../../etc/passwd", allowed_dirs=[Path("/")])


def test_validate_local_path_not_exists():
    """Non-existent path raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        validate_local_path("/nonexistent/file.py", allowed_dirs=[Path("/")])


def test_validate_local_path_is_dir(tmp_path):
    """Directory path raises ValueError."""
    with pytest.raises(ValueError, match="directory"):
        validate_local_path(str(tmp_path), allowed_dirs=[tmp_path])


# --- scan_directory ---


def test_scan_directory_recursive(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    (tmp_path / "README.md").write_text("readme")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    names = [f.filename for f in files]
    assert "main.py" in names
    assert "README.md" in names


def test_scan_directory_ignores_git(tmp_path):
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("git config")
    (tmp_path / "main.py").write_text("code")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs={".git"})
    names = [f.filename for f in files]
    assert "config" not in names
    assert "main.py" in names


def test_scan_directory_ignores_hidden(tmp_path):
    (tmp_path / ".hidden").mkdir()
    (tmp_path / ".hidden" / "secret.py").write_text("secret")
    (tmp_path / "visible.py").write_text("code")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    names = [f.filename for f in files]
    assert "secret.py" not in names
    assert "visible.py" in names


def test_scan_directory_ignores_node_modules(tmp_path):
    (tmp_path / "node_modules").mkdir()
    (tmp_path / "node_modules" / "lib.js").write_text("lib")
    (tmp_path / "app.js").write_text("app")
    files = scan_directory(
        str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs={"node_modules"}
    )
    names = [f.filename for f in files]
    assert "lib.js" not in names


def test_scan_directory_preserves_paths(tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    assert len(files) == 1
    assert files[0].path == "src/main.py"
    assert files[0].filename == "main.py"


def test_scan_directory_validates_each_file(tmp_path):
    """Each file in scanned directory is individually validated for path safety."""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("code")
    # Should not raise — all files are within allowed_dir
    files = scan_directory(str(tmp_path), allowed_dirs=[tmp_path], ignored_dirs=set())
    assert len(files) == 1


# --- parse_expires_in ---


def test_expires_in_1h():
    delta = parse_expires_in("1h")
    assert delta.total_seconds() == 3600


def test_expires_in_7d():
    delta = parse_expires_in("7d")
    assert delta.total_seconds() == 7 * 86400


def test_expires_in_30m():
    delta = parse_expires_in("30m")
    assert delta.total_seconds() == 30 * 60


def test_expires_in_invalid():
    with pytest.raises(ValueError):
        parse_expires_in("abc")


def test_expires_in_zero():
    with pytest.raises(ValueError, match="at least 1 minute"):
        parse_expires_in("0d")


def test_expires_in_minimum_1_minute():
    """expires_in below 1 minute is rejected."""
    with pytest.raises(ValueError, match="at least 1 minute"):
        parse_expires_in("0m")


def test_expires_in_maximum_365_days():
    """expires_in above 365 days is rejected."""
    with pytest.raises(ValueError, match="at most 365 days"):
        parse_expires_in("366d")


def test_expires_in_365_days_ok():
    """365 days is the maximum allowed."""
    delta = parse_expires_in("365d")
    assert delta.total_seconds() == 365 * 86400


def test_expires_in_1_minute_ok():
    """1 minute is the minimum allowed."""
    delta = parse_expires_in("1m")
    assert delta.total_seconds() == 60


# --- decode_base64_content ---


def test_decode_base64_valid():
    """Valid base64 is decoded."""
    encoded = "SGVsbG8gV29ybGQh"  # "Hello World!"
    result = decode_base64_content(encoded)
    assert result == b"Hello World!"


def test_decode_base64_invalid():
    """Invalid base64 raises ValueError."""
    with pytest.raises(ValueError, match="Invalid base64"):
        decode_base64_content("not-valid-base64!!!")


def test_decode_base64_unicode():
    """Unicode content encoded as base64 is decoded."""
    encoded = "5L2g5aW9LCDHh+XHjCE="  # Chinese characters
    result = decode_base64_content(encoded)
    # Should decode without error
    assert isinstance(result, bytes)


# --- FileInfo dataclass ---


def test_file_info_creation():
    """FileInfo can be created with required fields."""
    info = FileInfo(path="src/main.py", filename="main.py", local_path="/tmp/main.py")
    assert info.path == "src/main.py"
    assert info.filename == "main.py"
    assert info.local_path == "/tmp/main.py"
    assert info.language is None
    assert info.is_binary is False
    assert info.size == 0


def test_file_info_with_optional_fields():
    """FileInfo can include optional fields."""
    info = FileInfo(
        path="README.md",
        filename="README.md",
        local_path="/tmp/README.md",
        language="markdown",
        is_binary=False,
        size=1234,
    )
    assert info.language == "markdown"
    assert info.is_binary is False
    assert info.size == 1234
