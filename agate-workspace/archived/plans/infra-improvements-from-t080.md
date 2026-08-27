# PeekView 基础设施改进 Plan（T080 复盘衍生）

> 来源：T080-admin-user-management agate 全流程复盘
> 日期：2026-08-06
> 状态：已通过独立评审（v2 approved），待实施

## Context

T080 agate 全流程（P0-P8，3h40m）暴露了 5 个 PeekView 项目层面（非 agate 协议）的基础设施问题。这些问题不是 agate 流程本身的问题，而是项目的测试环境、工具脚本、测试数据构建设施的不完善，导致每个走 agate 的任务都会重复踩坑。本 plan 基于已验证的确切机理，给出最小改动方案。

## 问题与机理（已验证）

### 问题 A：test_t073 预存失败（python3 解析到 hermes venv 无 ruff）

**机理**：`test_t073_bdd09_10_ruff_regression.py:52` 用 `subprocess.run(["python3", "-m", "ruff", ...])`。`subprocess.run` 不走 shell，但用 PATH 找 `python3`。当前 PATH 里 hermes venv（`/home/kity/.hermes/hermes-agent/venv/bin`）在最前（4 次重复），`python3` 解析到 hermes venv 的 python3（无 ruff 模块）。而 `ruff` 二进制在 `/home/kity/.local/bin/ruff` 可用（0.15.18），backend venv 的 python3 也有 ruff（0.15.22）。

**根因**：测试不应依赖 `python3` 解析到哪个 venv。ruff 是独立二进制，应直接调 `ruff` 而非 `python3 -m ruff`。

### 问题 B：rate limit 在测试环境应禁用而非靠 reset 兜底

**机理**：conftest 的 `reset_rate_limiter` autouse fixture 在每个 test 开始时 `storage.reset()`（FixedWindowRateLimiter + MemoryStorage，reset 有效清空 Counter）。reset 解决了**跨 test 累积**，但治标不治本——rate limit 是生产行为，测试环境本不应启用。T080 implementer 为绕开单 test 内 10/minute 限制，自发写了 `_create_user_direct()` 直接插 DB（绕过 `/auth/register` 端点），导致每个需要多用户的测试都自己造轮子（见问题 E）。

**根因**：conftest 用 reset 而非 disable。正确做法是测试环境全局禁用 rate limit，让测试可自由调用任何 API（包括 register）而不撞 429，不再需要 `_create_user_direct` 这种绕过手段。

### 问题 C：make debug-stop 偶发 PID 残留

**机理**：`dev-server.sh stop_server()` 逻辑：① `kill $PID`（SIGTERM）→ `sleep 2` → 若存活 `kill -9 $PID`；② `lsof -t -i :$PORT` 清端口（只 `kill` SIGTERM，无 `-9` 兜底，无 sleep 确认）。T080 P8 时 :8888 残留（PID 198514），可能是 SIGTERM 后 uvicorn 子进程接管，或 lsof 清理的 PID 不是实际监听进程。

**根因**：端口清理只发 SIGTERM 不确认死亡，无 `-9` 兜底。

### 问题 E：无统一用户构建 fixture

**机理**：`factories.py` 只有 `EntryFactory` / `FileFactory` / `create_test_entry` / `create_test_file`，无 User 构建器。T080 implementer 自发写了 `_create_user_direct(app, username, password, is_admin)` 直接插 DB（`hash_password` + `session.add(User(...))`）。每个需要用户的测试都自己造轮子。

**根因**：factories.py 缺 User 工厂函数。

### 问题 G：bump-version 与 CHANGELOG 内容脱节

**机理**：`make bump-version` 调 `scripts/sync_versions.py --bump-peekview`，其中 `ensure_changelog` 会在 `[Unreleased]` **下方插入空模板** `## [x.y.z] - today / ### 新增 / -`，但不会把 `[Unreleased]` 下已有的内容移到新版本节。所以流程是：bump（插入空模板 + commit）→ 人工填 CHANGELOG 内容 → amend。T080 产生两个 bump commit（f0c7b40e + c0472105 amend）。

**根因**：`ensure_changelog` 插空模板而非移动 `[Unreleased]` 内容。正确流程应是先填好 `[Unreleased]` 内容，bump 时把 `[Unreleased]` 标题改成 `[x.y.z] - today` 并重建空 `[Unreleased]`。

## 改动方案

### A. test_t073 改用 ruff 二进制直接调用（1 文件，~5 行）

文件：`backend/tests/test_t073_bdd09_10_ruff_regression.py`

```python
# 模块级（文件顶部已有的 import 区加）：
import shutil
# （pytest 已在文件顶部 import）

# test_bdd_10 函数内，第 52-54 行改：
# 原：subprocess.run(["python3", "-m", "ruff", "check", ...], cwd=str(BACKEND_DIR))
# 新：
ruff = shutil.which("ruff")
if not ruff:
    pytest.skip("ruff not in PATH")
result = subprocess.run(
    [ruff, "check", "--select", "E711,E712", "peekview/", "tests/"],
    capture_output=True, text=True, cwd=str(BACKEND_DIR), timeout=60,
)
```

import 放模块级（非函数内），符合现有风格（文件顶部已有 `import subprocess`）。

### B. conftest 用环境变量禁用 rate limit（1 文件，~3 行）

文件：`backend/tests/conftest.py`

在 `isolate_config_file` autouse fixture（第 24 行，在 `app` fixture 之前跑，`PeekConfig()` 读环境变量）中加一行：

```python
@pytest.fixture(autouse=True)
def isolate_config_file(monkeypatch, tmp_path):
    # ... 现有 DATA_DIR / DB_PATH 设置 ...
    monkeypatch.setenv("PEEKVIEW_SERVER__RATE_LIMIT_ENABLED", "false")  # 测试环境禁用 rate limit
```

**为什么不直接 monkeypatch `limiter.enabled`**：`limiter` 是模块级单例（`rate_limit.py:10`），但 `create_app()` 在 `main.py:385` 会执行 `limiter.enabled = config.server.rate_limit_enabled`（默认 True）。fixture 执行顺序是 `isolate_config_file` → `app`/`client`（调 `create_app`），所以 monkeypatch 设的 `enabled=False` 会被 `create_app()` 覆盖回 True。环境变量方式让 `PeekConfig()` 读到 `rate_limit_enabled=False`，`create_app` 内部赋的就是 False，不会被覆盖。此模式代码库已有先例（`test_t054_b_rate_limit.py:40` 的 `no_limit_client`）。

删除旧的 `reset_rate_limiter` fixture（被环境变量禁用取代，reset 不再需要）。

### C. dev-server.sh stop 加 kill -9 兜底（1 文件，~4 行）

文件：`scripts/dev-server.sh`，`stop_server()` 端口清理段：

```bash
# 现有（第 156-160 行）：
PORT_PID=$(lsof -t -i :$PORT 2>/dev/null || echo "")
if [ -n "$PORT_PID" ]; then
    kill $PORT_PID 2>/dev/null || true
fi

# 改为：
PORT_PID=$(lsof -t -i :$PORT 2>/dev/null || echo "")
if [ -n "$PORT_PID" ]; then
    kill $PORT_PID 2>/dev/null || true
    sleep 1
    # kill -0 对多 PID（lsof -t 可能返回多个换行分隔 PID）全部存活才返回 0；
    # 单 PID（uvicorn 默认单进程）场景足够。多 worker 场景需 xargs 逐个处理。
    kill -0 $PORT_PID 2>/dev/null && kill -9 $PORT_PID 2>/dev/null || true
fi
```

### E. factories.py 加 create_test_user（1 文件，~25 行）

文件：`backend/tests/factories.py`

```python
def create_test_user(
    session: Session,
    username: str = "testuser",
    password: str = "testpass123",
    is_admin: bool = False,
    is_active: bool = True,
    display_name: str | None = None,
) -> User:
    """创建测试用户（直接插 DB，不走 /auth/register，避免 rate limit）。"""
    from peekview.auth import hash_password
    user = User(
        username=username,
        password_hash=hash_password(password),
        display_name=display_name,
        is_admin=is_admin,
        is_active=is_active,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
```

T080 的 `_create_user_direct` 可后续迁移到调用此函数（非本次必须，先建工厂）。

### G. sync_versions.py ensure_changelog 改为移动 [Unreleased] 内容（1 文件，~10 行）

文件：`scripts/sync_versions.py`，`ensure_changelog` 非 check_only 分支。

现状：在 `[Unreleased]` 下方插入空模板，导致 `[Unreleased]` 下方紧跟空模板再跟原内容——内容归属混乱。
改为：保留空 `[Unreleased]` 节在上，`[x.y.z]` 节在下继承原 `[Unreleased]` 的内容。

```python
if "## [Unreleased]" in content:
    today = date.today().isoformat()
    content = content.replace(
        "## [Unreleased]\n",
        f"## [Unreleased]\n\n## [{version}] - {today}\n",
        1,
    )
    changelog.write_text(content)
```

流程变为：先在 `[Unreleased]` 填内容 → bump 自动移到 `[x.y.z]` → 单 commit，无 amend。

**已知限制（与当前代码相同，非回归）**：peekview 和 mcp 同时 bump 时，第二个 entry（mcp）的标题会插在 peekview 上方，但 mcp 节为空（原 `[Unreleased]` 内容已被第一个 entry 捕获到 peekview 版本下）。单包 bump 不受影响。

## 不改的项

- **D（E2E 强制 data-testid）**：需加 eslint 规则或 code review 检查，改动面大且属长期治理。agate v0.30.1 已在 P2 design 层提示选择器契约。
- **F（gate_commands 拆单命令）**：属 agate 协议层（P2 声明），非项目代码。下次任务 P2 时注意声明单命令即可。

## 验证

### A 验证
```bash
cd backend && .venv/bin/python -m pytest tests/test_t073_bdd09_10_ruff_regression.py -v
# 期望：2 passed（不再因 hermes venv 无 ruff 失败）
```

### B 验证
```bash
# 1. 确认 t080 测试仍通过（回归保护）
cd backend && .venv/bin/python -m pytest tests/test_t080_admin_user_mgmt.py -q --tb=short
# 2. 确认 rate limit 在测试环境确实被禁用（写一个临时测试验证 register 不再 429）
cd backend && .venv/bin/python -c "
import asyncio, os
os.environ['PEEKVIEW_SERVER__RATE_LIMIT_ENABLED']='false'
from peekview.main import create_app
from peekview.config import PeekConfig
c = PeekConfig()
print(f'rate_limit_enabled={c.server.rate_limit_enabled}  (应为 False)')
assert c.server.rate_limit_enabled is False
print('OK: 测试环境 rate limit 已禁用')
"
# 3. 确认现有 rate limit 专项测试仍正常（test_t054_b_rate_limit.py 用自己的 no_limit_client，不依赖 conftest）
cd backend && .venv/bin/python -m pytest tests/test_t054_b_rate_limit.py -q --tb=short
```

### C 验证
```bash
make debug-start && sleep 2 && make debug-stop
pgrep -f "uvicorn.*8888" && echo "STILL RUNNING" || echo "stopped OK"
```

### E 验证
```bash
cd backend && .venv/bin/python -c "
from tests.factories import create_test_user
from sqlmodel import Session
from peekview.database import init_db
import tempfile, os
with tempfile.TemporaryDirectory() as d:
    engine = init_db(f'{d}/test.db')
    with Session(engine) as s:
        u = create_test_user(s, 'alice', is_admin=True)
        print(f'created: {u.username} admin={u.is_admin} id={u.id}')
"
```

### G 验证
```bash
python3 scripts/sync_versions.py --bump-peekview 0.17.1
head -20 CHANGELOG.md  # [Unreleased] 空节在上，[0.17.1] 继承原内容
git checkout CHANGELOG.md VERSIONS.json  # 回退模拟
```

## 改动清单

| 文件 | 改动 | 行数 |
|------|------|------|
| `backend/tests/test_t073_bdd09_10_ruff_regression.py` | `python3 -m ruff` → `ruff` + skip 兜底 | ~5 |
| `backend/tests/conftest.py` | `isolate_config_file` 加 `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false`，删 `reset_rate_limiter` | ~3 |
| `scripts/dev-server.sh` | stop_server 端口清理加 kill -9 兜底（多 PID 注释） | ~6 |
| `backend/tests/factories.py` | 加 create_test_user | ~25 |
| `scripts/sync_versions.py` | ensure_changelog 移动 [Unreleased] 而非插空模板（双版本限制说明） | ~10 |

总计 5 文件 ~49 行，全部小改动。改完后 T080 的 known-failures.md 第一条（ruff env）可删除，第二条（E2E 选择器）已在 P4 retry#3 修复。

## 评审记录

- v1 评审（2026-08-06，plan-agent）：status=needs-revision。B 项方案失效（`monkeypatch.setattr(limiter,"enabled",False)` 被 `create_app()` 覆盖）+ B 机理不准（BDD-01 实际只 1 次 HTTP register）。A/C/E/G 通过。
- v2 修订（2026-08-06）：B 项改为环境变量 `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false`（isolate_config_file 内设，对齐 test_t054_b_rate_limit.py 先例），B 机理改为"测试环境应禁用而非 reset 兜底"。采纳 A（import 模块级）、C（多 PID 注释）、G（双版本限制）建议。
- v2 复审（2026-08-06，plan-agent）：status=approved。B 项核实通过（isolate_config_file autouse 时序正确 + PeekConfig env_nested_delimiter 读取 + main.py:385 赋 False 不被覆盖 + 机理已修正）。A/C/E/G 非阻塞建议均已采纳。可进入实施。
