"""T082 BDD-11~13: 重复代码去重验证测试。

These tests verify that duplicated helper functions (_looks_like_jwt,
_is_global_api_key_auth, _record_read_async) are defined exactly once
in the entire backend codebase.

All tests are RED (failing) because the refactoring (R2) has not been implemented yet.
Currently these functions exist in 2-3 files each.
"""

import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent / "peekview"


def _count_function_defs(func_name: str) -> tuple[int, list[str]]:
    """Count how many times a function is defined across the backend codebase.

    Returns (count, list_of_files).
    """
    pattern = re.compile(rf"^\s*(async\s+)?def\s+{re.escape(func_name)}\s*\(", re.MULTILINE)
    files_with_def: list[str] = []
    for py_file in BACKEND_ROOT.rglob("*.py"):
        if "__pycache__" in str(py_file):
            continue
        source = py_file.read_text(encoding="utf-8")
        matches = pattern.findall(source)
        if matches:
            files_with_def.append(str(py_file.relative_to(BACKEND_ROOT)))
    return len(files_with_def), files_with_def


# BDD-11: _looks_like_jwt 函数全局唯一
def test_bdd_11_looks_like_jwt_unique():
    """BDD-11: _looks_like_jwt 函数在整个 backend/ 中只存在 1 份定义."""
    count, files = _count_function_defs("_looks_like_jwt")
    assert count == 1, (
        f"BDD-11: _looks_like_jwt found {count} definitions (expected 1): {files}"
    )


# BDD-12: _is_global_api_key_auth 函数全局唯一
def test_bdd_12_is_global_api_key_auth_unique():
    """BDD-12: _is_global_api_key_auth 函数在整个 backend/ 中只存在 1 份定义."""
    count, files = _count_function_defs("_is_global_api_key_auth")
    assert count == 1, (
        f"BDD-12: _is_global_api_key_auth found {count} definitions (expected 1): {files}"
    )


# BDD-13: _record_read_async 函数全局唯一
def test_bdd_13_record_read_async_unique():
    """BDD-13: _record_read_async 函数在整个 backend/ 中只存在 1 份定义."""
    count, files = _count_function_defs("_record_read_async")
    assert count == 1, (
        f"BDD-13: _record_read_async found {count} definitions (expected 1): {files}"
    )
