"""TPV0104 — 后端文件列表顺序确定性契约（BDD-13）

判据（P1-requirements.md §3.2 BDD-13）：
  - 连续两次 `GET /api/v1/entries/{slug}` 的 `files` 顺序**逐元素相同**
  - 且等于按「`path` 非空取 `path`、否则取 `filename`」字典升序、同键按 `id` 升序
  - 素材必须使**构造序 ≠ 字典序**（seed 的 `multi-format-demo` 恰好相等 → 假 PASS）

附加（P2-design.md R1 / G3）：显式断言 **POST 序 ≠ GET 序** ——
`_create_entry` 读的是 POST 响应的 `files`（源为逐条 `session.add` 的构造序，不经 `select(File)`），
`order_by` 只作用于 GET 侧查询。若未来有人把排序也加到 POST 响应构造上，该断言会报出来。

`order_by` 是默认入口 resolver 的**前置条件**（前端「稳定排序首个」需要确定输入）。
"""

import shutil
import tempfile
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from peekview.main import create_app


@pytest.fixture(scope="function")
async def client():
    tmp_dir = Path(tempfile.mkdtemp())
    try:
        data_dir = tmp_dir / "data"
        data_dir.mkdir()
        db_path = tmp_dir / "test.db"
        app = create_app(data_dir=data_dir, db_path=db_path)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _sort_key(file_entry: dict) -> tuple[str, int]:
    """契约排序键：`path` 非空取 `path`、否则取 `filename`；同键按 `id` 升序。"""
    return ((file_entry.get("path") or file_entry.get("filename") or ""), file_entry["id"])


CONSTRUCTION_ORDER = ["zzz.txt", "aaa.txt", "mmm.txt"]
LEXICOGRAPHIC_ORDER = ["aaa.txt", "mmm.txt", "zzz.txt"]


async def _create_multi_file_entry(client):
    files = [{"filename": name, "content": f"content of {name}"} for name in CONSTRUCTION_ORDER]
    resp = await client.post(
        "/api/v1/entries",
        json={"summary": "tpv0104 file order", "files": files},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


class TestEntryFileOrderDeterminism:
    @pytest.mark.asyncio
    async def test_bdd_13_two_consecutive_gets_same_order(self, client):
        entry = await _create_multi_file_entry(client)
        slug = entry["slug"]

        first = await client.get(f"/api/v1/entries/{slug}")
        second = await client.get(f"/api/v1/entries/{slug}")
        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text

        names_first = [f["path"] or f["filename"] for f in first.json()["files"]]
        names_second = [f["path"] or f["filename"] for f in second.json()["files"]]
        assert names_first == names_second

    @pytest.mark.asyncio
    async def test_bdd_13_get_order_is_lexicographic_not_construction_order(self, client):
        entry = await _create_multi_file_entry(client)
        slug = entry["slug"]

        resp = await client.get(f"/api/v1/entries/{slug}")
        assert resp.status_code == 200, resp.text
        got = [f["path"] or f["filename"] for f in resp.json()["files"]]

        # 构造序 zzz/aaa/mmm ≠ 字典序 aaa/mmm/zzz
        assert got == LEXICOGRAPHIC_ORDER
        assert got != CONSTRUCTION_ORDER

    @pytest.mark.asyncio
    async def test_bdd_13_order_matches_contract_sort_key(self, client):
        # 含子目录项：`path` 非空取 `path`（不是 basename）
        files = [
            {"filename": "sub.md", "path": "docs/sub.md", "content": "sub"},
            {"filename": "zzz.txt", "content": "z"},
            {"filename": "aaa.txt", "content": "a"},
        ]
        resp = await client.post(
            "/api/v1/entries", json={"summary": "tpv0104 mixed paths", "files": files}
        )
        assert resp.status_code == 201, resp.text
        slug = resp.json()["slug"]

        detail = await client.get(f"/api/v1/entries/{slug}")
        assert detail.status_code == 200, detail.text
        listed = detail.json()["files"]
        expected = sorted(listed, key=_sort_key)
        assert listed == expected

    @pytest.mark.asyncio
    async def test_bdd_13_post_order_differs_from_get_order(self, client):
        """G3：POST 返回构造序、GET 返回契约序 —— 两者不得被「顺手统一」。"""
        entry = await _create_multi_file_entry(client)
        slug = entry["slug"]

        post_order = [f["path"] or f["filename"] for f in entry["files"]]
        detail = await client.get(f"/api/v1/entries/{slug}")
        assert detail.status_code == 200, detail.text
        get_order = [f["path"] or f["filename"] for f in detail.json()["files"]]

        assert post_order == CONSTRUCTION_ORDER
        assert get_order == LEXICOGRAPHIC_ORDER
        assert post_order != get_order
