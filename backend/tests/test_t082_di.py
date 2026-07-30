"""T082 BDD-1~6: DI 统一验证测试。

These tests verify that the backend route layer and service layer no longer
directly instantiate StorageManager, Session, or cross-service instances.
They use source-code inspection (grep/AST) to enforce architectural constraints.

All tests are RED (failing) because the refactoring (R1) has not been implemented yet.
"""

import ast
import re
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent.parent / "peekview"
FILES_PY = BACKEND_ROOT / "api" / "files.py"
ENTRIES_PY = BACKEND_ROOT / "api" / "entries.py"
AUTH_PY = BACKEND_ROOT / "auth.py"
API_AUTH_PY = BACKEND_ROOT / "api" / "auth.py"
ADMIN_PY = BACKEND_ROOT / "api" / "admin.py"
ENTRY_SERVICE_PY = BACKEND_ROOT / "services" / "entry_service.py"
ADMIN_SERVICE_PY = BACKEND_ROOT / "services" / "admin_service.py"


def _read_source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _parse_functions(source: str) -> dict[str, ast.AST]:
    """Parse Python source and return dict of function name -> FunctionDef/AsyncFunctionDef."""
    tree = ast.parse(source)
    functions: dict[str, ast.AST] = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions[node.name] = node
    return functions


def _func_source_lines(source: str, func_name: str) -> str:
    """Extract the source lines of a specific function by name."""
    lines = source.splitlines()
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            start = node.lineno - 1
            end = node.end_lineno if node.end_lineno else len(lines)
            return "\n".join(lines[start:end])
    return ""


# BDD-1: files.py 路由不再直接实例化 StorageManager
def test_bdd_1_no_storage_manager_in_files_routes():
    """BDD-1: files.py 路由函数体内不存在 StorageManager(config=config) 直接实例化."""
    source = _read_source(FILES_PY)
    route_funcs = [
        "download_file",
        "get_file_content",
        "render_html_file",
        "resolve_entry_raw",
    ]
    for func_name in route_funcs:
        func_body = _func_source_lines(source, func_name)
        assert func_body, f"Function {func_name} not found in files.py"
        assert "StorageManager(config=config)" not in func_body, (
            f"BDD-1: {func_name} still directly instantiates StorageManager(config=config)"
        )


# BDD-2: files.py 路由不再直接实例化 Session
def test_bdd_2_no_session_in_files_routes():
    """BDD-2: files.py 路由函数体内不存在 Session(engine) 直接实例化."""
    source = _read_source(FILES_PY)
    route_funcs = [
        "download_file",
        "get_file_content",
        "render_html_file",
        "resolve_entry_raw",
    ]
    for func_name in route_funcs:
        func_body = _func_source_lines(source, func_name)
        assert func_body, f"Function {func_name} not found in files.py"
        assert "Session(engine)" not in func_body, (
            f"BDD-2: {func_name} still directly instantiates Session(engine)"
        )
        assert "Session(get_engine" not in func_body, (
            f"BDD-2: {func_name} still directly instantiates Session(get_engine(...))"
        )


# BDD-3: admin_service.py 不再直接 new EntryService
def test_bdd_3_no_entry_service_new_in_admin_service():
    """BDD-3: admin_service.py 不存在 EntryService(engine=...) 新建."""
    source = _read_source(ADMIN_SERVICE_PY)
    pattern = r"EntryService\s*\(\s*engine\s*="
    matches = re.findall(pattern, source)
    assert len(matches) == 0, (
        f"BDD-3: admin_service.py still has {len(matches)} EntryService(engine=...) instantiations"
    )


# BDD-4: auth.py 不再直接实例化 ApiKeyService
def test_bdd_4_no_apikey_service_new_in_auth():
    """BDD-4: auth.py get_current_user 不存在 ApiKeyService(engine=...) 新建."""
    source = _read_source(AUTH_PY)
    pattern = r"ApiKeyService\s*\(\s*engine\s*="
    matches = re.findall(pattern, source)
    assert len(matches) == 0, (
        f"BDD-4: auth.py still has {len(matches)} ApiKeyService(engine=...) instantiations"
    )


# BDD-5: entry_service.py 不再直接实例化 ReadTrackingService
def test_bdd_5_no_read_tracking_service_new_in_entry_service():
    """BDD-5: entry_service.py 不存在 ReadTrackingService(engine=...) 新建."""
    source = _read_source(ENTRY_SERVICE_PY)
    pattern = r"ReadTrackingService\s*\(\s*engine\s*="
    matches = re.findall(pattern, source)
    assert len(matches) == 0, (
        f"BDD-5: entry_service.py still has {len(matches)} ReadTrackingService(engine=...) instantiations"
    )


# BDD-6: entry_service.py 不再直接实例化 ShareService
def test_bdd_6_no_share_service_new_in_entry_service():
    """BDD-6: entry_service.py 不存在 ShareService(engine=...) 新建."""
    source = _read_source(ENTRY_SERVICE_PY)
    pattern = r"ShareService\s*\(\s*engine\s*="
    matches = re.findall(pattern, source)
    assert len(matches) == 0, (
        f"BDD-6: entry_service.py still has {len(matches)} ShareService(engine=...) instantiations"
    )
