#!/usr/bin/env python3
"""TPV0102 BDD-12 — 存量数据 UTC 语义一次性审计（**不是 pytest 用例**）。

为什么不在 pytest 套件里（P2 §6.1 约束 3）：
``backend/tests/conftest.py`` 的 ``isolate_config_file`` 是 ``autouse=True``，
每个测试都把 ``PEEKVIEW_STORAGE__DB_PATH`` 指向 ``tmp_path``。在 tmp DB 上统计
「``created_at`` 晚于当前 UTC 的行数」必然为 0 —— 恒绿假象。BDD-12 的语义是
**对真实存量数据的一次性审计**，因此走独立脚本、对 debug DB 执行并留存输出。

判据（P1 BDD-12）：
  Given debug 数据库中全部 entry 行
  When  执行「``created_at`` 晚于数据库当前 UTC 时间」的行计数
        （排除 ``expires_at`` / ``archive_delete_at`` 这类天然未来列）
  Then  计数结果为 0

用法：
  python3 scripts/audit-utc-semantics.py                    # 默认 debug DB
  python3 scripts/audit-utc-semantics.py --db <path>        # 指定 DB
  python3 scripts/audit-utc-semantics.py --json             # 机器可读输出

退出码：0 = 计数 0（BDD-12 满足）；1 = 有异常行（打印明细）；2 = DB 不存在/不可读
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

# 平台无关的 debug DB 默认路径：运行时拼接，不写字面量（check-platform-assumptions R4）
_DEBUG_DB_PARTS = ("peekview-debug", "peekview.db")


def default_debug_db_path() -> str:
    """``<system temp>/peekview-debug/peekview.db`` —— 由 ``tempfile.gettempdir()`` 派生。"""
    import tempfile

    return os.path.join(tempfile.gettempdir(), *_DEBUG_DB_PARTS)


def _parse_db_datetime(raw: str | None) -> datetime | None:
    """把 DB 里的 naive UTC 字符串解析成 aware UTC。"""
    if not raw:
        return None
    text = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def bdd12_count_future_created_at(db_path: str, now: datetime | None = None) -> dict:
    """BDD-12 判据实现：返回 ``{count, rows, now, checked}``。

    ``count`` 即「``created_at`` 晚于当前 UTC 时间」的 entry 行数。
    天然未来的列（``expires_at`` / ``archive_delete_at``）**不参与**判定。
    """
    reference = now or datetime.now(timezone.utc)
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT slug, created_at FROM entries")
        offenders = []
        checked = 0
        for slug, created_at_raw in cursor.fetchall():
            checked += 1
            created_at = _parse_db_datetime(created_at_raw)
            if created_at is None:
                # 无法解析的 created_at 本身也是 UTC 语义异常，计入明细
                offenders.append({"slug": slug, "created_at": created_at_raw, "reason": "unparsable"})
                continue
            if created_at > reference:
                offenders.append(
                    {
                        "slug": slug,
                        "created_at": created_at.isoformat(),
                        "reason": "created_at_in_future",
                    }
                )
        return {
            "count": len(offenders),
            "rows": offenders,
            "checked": checked,
            "now": reference.isoformat(),
        }
    finally:
        connection.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="TPV0102 BDD-12 存量 UTC 语义审计")
    parser.add_argument("--db", default=None, help="目标 SQLite 数据库路径（默认 debug DB）")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出结果")
    args = parser.parse_args(argv)

    db_path = args.db or default_debug_db_path()
    if not os.path.isfile(db_path):
        sys.stderr.write(f"BDD-12 SKIP: 数据库不存在 {db_path}\n")
        return 2

    try:
        result = bdd12_count_future_created_at(db_path)
    except sqlite3.Error as exc:
        sys.stderr.write(f"BDD-12 SKIP: 无法读取数据库 {db_path}: {exc}\n")
        return 2

    result["db"] = db_path
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"BDD-12 UTC semantics audit — {db_path}")
        print(f"  checked entries : {result['checked']}")
        print(f"  reference (now) : {result['now']}")
        print(f"  future created_at rows : {result['count']}")
        for row in result["rows"]:
            print(f"    - {row['slug']}: {row['created_at']} ({row['reason']})")

    return 0 if result["count"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
