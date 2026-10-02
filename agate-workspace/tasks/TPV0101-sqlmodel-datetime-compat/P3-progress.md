# P3 progress — TPV0101 test-designer

## 2026-10-02
- 已读 P3 dispatch-context / test-designer role / P1-requirements / P2-design / P0-brief
- 已读 models.py（25 datetime 列均裸 datetime）/ conftest.py / factories.py / star_service.py / database.py backfill
- 已确认隔离 venv /tmp/ci-repro-venv = sqlmodel 0.0.47 / sqlalchemy 2.0.54 / pytest 9.1.1
- 实测 0.0.47 修复前行为（/tmp/opencode/tpv0101_probe*.py）：
  - naive 写入（Entry.archive_delete_at / User.disabled_at）→ RED（StatementError wrapping ValueError）
  - aware 写入（Entry.created_at）→ OK
  - NULL 写入 → OK
  - WHERE naive 比较（Entry.expires_at <= now_naive）→ RED（StatementError）
- 列类型当前为 UTCDateTime tz=True（5 个 Entry 列全部）

## P3 产出完成
- 新增 backend/tests/test_datetime_naive_compat.py（BDD-1/2/3/6/9/16，10 用例）
- 新增 backend/tests/test_dependency_guard.py（BDD-15，3 用例）
- P3-test-cases.md（18 BDD 1:1 映射 + 回归口径 + test_code_dir）
- 验证：
  - P3 gate（0.0.47）: 9 failed/1 passed（真红灯）
  - check-tdd-red.py: exit 0 red-light
  - check-platform-assumptions.py 新文件: 0 命中
  - 本地 0.0.38: datetime 守卫 10 passed（不回归）
