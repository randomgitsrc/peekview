# PeekView 基础设施改进 Plan v2（T080 复盘衍生）

> 来源：T080-admin-user-management agate 全流程复盘
> 日期：2026-08-06
> 状态：待复审（v2 评审 needs-revision，已按 BLOCKER 修复建议修订）
> 前序：`infra-improvements-from-t080.md`（v1，已 approved）
> v2 变化：继承 v1 的 A/B/C/E/G 五项，新增 F 项（seed-data 用户/权限维度补充），修正 v1 评审时未发现的 seed-data 缺口

## Context

T080 agate 全流程（P0-P8，3h40m）暴露了 5 个 PeekView 项目层面（非 agate 协议）的基础设施问题。v1 计划已覆盖其中 A/B/C/E/G 五项（均小改动，已 approved）。v2 在 v1 基础上新增 F 项，补齐 v1 评审时未发现的 seed-data 用户/权限维度缺口。

**v2 的核心论点**：v1 的 E 项（`create_test_user` fixture）只覆盖了**单元测试**的用户构建，但 T080 暴露的"用户数据匮乏"问题在 **E2E + 手动调试**层同样存在。`make debug-seed` 承诺"全面多样化的基础样例"，在格式维度已达标（20 entry 覆盖 11 种格式），但在用户/权限/状态维度是空白的。补齐这一层是与 E 项互补的闭环。

## 问题与机理（已验证）

### 问题 A：test_t073 预存失败（python3 解析到 hermes venv 无 ruff）

**机理**：`test_t073_bdd09_10_ruff_regression.py:52` 用 `subprocess.run(["python3", "-m", "ruff", ...])`。`subprocess.run` 不走 shell，但用 PATH 找 `python3`。当前 PATH 里 hermes venv（`/home/kity/.hermes/hermes-agent/venv/bin`）在最前（4 次重复），`python3` 解析到 hermes venv 的 python3（无 ruff 模块）。而 `ruff` 二进制在 `/home/kity/.local/bin/ruff` 可用（0.15.18），backend venv 的 python3 也有 ruff（0.15.22）。

**根因**：测试不应依赖 `python3` 解析到哪个 venv。ruff 是独立二进制，应直接调 `ruff` 而非 `python3 -m ruff`。

### 问题 B：rate limit 在测试环境应禁用而非靠 reset 兜底

**机理**：conftest 的 `reset_rate_limiter` autouse fixture 在每个 test 开始时 `storage.reset()`（FixedWindowRateLimiter + MemoryStorage，reset 有效清空 Counter）。reset 解决了**跨 test 累积**，但治标不治本——rate limit 是生产行为，测试环境本不应启用。T080 implementer 为绕开单 test 内 10/minute 限制，自发写了 `_create_user_direct()` 直接插 DB（绕过 `/auth/register` 端点），导致每个需要多用户的测试都自己造轮子（见问题 E）。

**根因**：conftest 用 reset 而非 disable。正确做法是测试环境全局禁用 rate limit，让测试可自由调用任何 API（包括 register）而不撞 429，不再需要 `_create_user_direct` 这种绕过手段。

### 问题 C：make debug-stop 偶发 PID 残留

**机理**：`dev-server.sh stop_server()` 逻辑：① `kill $PID`（SIGTERM）-> `sleep 2` -> 若存活 `kill -9 $PID`；② `lsof -t -i :$PORT` 清端口（只 `kill` SIGTERM，无 `-9` 兜底，无 sleep 确认）。T080 P8 时 :8888 残留（PID 198514），可能是 SIGTERM 后 uvicorn 子进程接管，或 lsof 清理的 PID 不是实际监听进程。

**根因**：端口清理只发 SIGTERM 不确认死亡，无 `-9` 兜底。

### 问题 E：无统一用户构建 fixture（单元测试层）

**机理**：`factories.py` 只有 `EntryFactory` / `FileFactory` / `create_test_entry` / `create_test_file`，无 User 构建器。T080 implementer 自发写了 `_create_user_direct(app, username, password, is_admin)` 直接插 DB（`hash_password` + `session.add(User(...))`）。每个需要用户的测试都自己造轮子。

**根因**：factories.py 缺 User 工厂函数。

### 问题 F：seed-data 用户/权限维度空白（E2E/调试层，v2 新增）

**机理**：`scripts/seed-debug.py` 从 `scripts/seed-data/` 加载 20 个 entry，格式维度覆盖良好（csv/tsv/json/yaml/xml/html/markdown/mermaid/plantuml/svg/png/python，共 11 种）。但用户/权限/状态维度存在缺口：

| 维度 | 现状 | 缺口 |
|------|------|------|
| admin 用户 | alice 是首用户，register 时 auto-admin（`auth.py:87` `is_admin=is_first_user`） | **无缺口**（已修正认知，见下） |
| disabled 用户 | 无 | T080 引入 disable 能力，seed 无 disabled 用户样例 |
| 权限边界 entry | 2 个 private（api-v2-draft、security-audit），均为普通用户私有 | 无 admin 私有 entry，无法验证"admin 私有对其他 admin 可见、对普通用户 404" |
| 用户分布 | alice(7) / bob(6) / carol(7) | 够用，无需调整 |

**关键认知修正**：v1 评审时我曾误判"seed 无 admin 用户"，实际核实 `auth.py:87` 首用户 register 即 `is_admin=is_first_user=True`，seed-debug.py 第一个 register 的 alice **已经是 admin**。E2E `admin.spec.ts:33` 也直接用 alice 作为 admin 登录。因此"补 admin 用户"是伪需求，真正的缺口是 disabled 用户 + admin 私有 entry。

**根因**：seed-data 的设计聚焦格式维度，未跟进 T080 引入的用户状态维度（disable/promote/demote）。

**disabled 用户 seed 的技术约束**（已核实）：

1. `auth.py:149` login 检查 `not user.is_active` -> disabled 用户**无法 login**
2. seed-debug.py 的 `register()` 先 login 失败再 register -> 重跑时 disabled 用户 login 失败、register 也失败（用户已存在）-> **seed 崩溃**
3. `admin_service.disable_user()` 不幂等：直接 `user.is_active = False`，不检查是否已 disabled（重复 disable 不报错但重写 `disabled_at`）
4. disable 受 `_check_last_active_admin` + `_check_self_operation` 约束：不能 disable 自己，不能 disable 最后一个活跃 admin

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

**为什么不直接 monkeypatch `limiter.enabled`**：`limiter` 是模块级单例（`rate_limit.py:10`），但 `create_app()` 在 `main.py:385` 会执行 `limiter.enabled = config.server.rate_limit_enabled`（默认 True）。fixture 执行顺序是 `isolate_config_file` -> `app`/`client`（调 `create_app`），所以 monkeypatch 设的 `enabled=False` 会被 `create_app()` 覆盖回 True。环境变量方式让 `PeekConfig()` 读到 `rate_limit_enabled=False`，`create_app` 内部赋的就是 False，不会被覆盖。此模式代码库已有先例（`test_t054_b_rate_limit.py:40` 的 `no_limit_client`）。

删除旧的 `reset_rate_limiter` fixture（被环境变量禁用取代，reset 不再需要）。

### C. dev-server.sh stop 加 kill -9 兜底（1 文件，~6 行）

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

### F. seed-data 补 disabled 用户 + admin 私有 entry（2 文件，~40 行，v2 新增）

#### F.1 seed-debug.py 增加 disabled 用户流程

文件：`scripts/seed-debug.py`

**设计要点**（基于已核实的技术约束）：

1. 新增用户 `dave`，在 alice/bob/carol 之后注册
2. dave 的 entry 必须在 disable **之前**创建（disabled 用户无法 login，无法获取 token）
3. disable dave 用 admin token（alice），放在所有 entry 创建之后
4. `register()` 函数增加容错：重跑时 disabled 用户 login 失败 + register 失败（已存在）-> 返回 `None`
5. **main 循环 token=None 时跳过该 entry**（不 fallback 到 alice）--避免 idempotency_key 跨 owner 冲突（见 BLOCKER 修复）
6. `create_entry()` 容错 409：idempotency_key 已属于其他用户时返回 None 而非崩溃--双重保险（即使 main 循环的跳过逻辑漏了也不崩）
7. disable 操作 try/except 容错（已 disabled 不报错，`disable_user` 不幂等但不报错）

> **BLOCKER 修复说明**（v2 评审发现）：原方案第 4 点只处理了 `register()` 容错，但 `seed-debug.py:140` 的 `token = tokens.get(owner, alice)` 在 dave=None 时会 fallback 到 alice token。此时调 `create_entry`：`idempotency_key="seed-..."` 已存在（首次用 dave token 创建，owner=dave），`entry_service.py:153` 检查 `existing.owner_id`(dave) != `current_user_id`(alice) -> ConflictError 409 -> `r.raise_for_status()` 崩溃。修复：main 循环 token=None 时直接跳过（不 fallback）+ `create_entry` 容错 409（双保险）。

```python
# register() 改为容错（第 68-74 行）：
def register(username: str, password: str = "testpass123") -> str | None:
    """注册或登录用户，返回 token。disabled 用户重跑时返回 None（跳过其 entry）。"""
    r = requests.post(f"{BASE}/api/v1/auth/login", json={"username": username, "password": password})
    if r.ok:
        return r.json()["access_token"]
    r = requests.post(f"{BASE}/api/v1/auth/register", json={"username": username, "password": password})
    if r.ok:
        return r.json()["access_token"]
    # login + register 都失败：用户已存在但 disabled（重跑场景），返回 None
    return None


# create_entry() 容错 409（第 101-116 行）：
def create_entry(token: str, slug: str, meta: dict, files: list[dict]) -> dict | None:
    payload = {
        "summary": meta["summary"],
        "slug": slug,
        "tags": meta.get("tags", []),
        "is_public": meta.get("is_public", True),
        "files": files,
        "idempotency_key": f"seed-{meta['summary']}",
    }
    r = requests.post(
        f"{BASE}/api/v1/entries",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    if r.status_code == 409:
        # idempotency_key 已属于其他用户（重跑 disabled 用户 fallback 场景），跳过
        return None
    r.raise_for_status()
    return r.json()


# main() 中 dave 流程（在 carol 之后、entry 循环之前）：
dave = register("dave")
tokens = {"alice": alice, "bob": bob, "carol": carol, "dave": dave}
print("Users: alice, bob, carol, dave")

# ... 现有 entry 循环改：token=None 时跳过（不 fallback 到 alice）...
# 原：token = tokens.get(owner, alice)
# 新：
token = tokens.get(owner)
if token is None:
    print(f"  SKIP {slug}: owner disabled (rerun)")
    continue

# entry 循环后，disable dave（用 admin token）：
if dave is None:
    print("  SKIP disable dave: already disabled (rerun)")
else:
    # 查 dave 的 user_id（通过 /api/v1/admin/users，需 alice admin token）
    r = requests.get(f"{BASE}/api/v1/admin/users", headers={"Authorization": f"Bearer {alice}"})
    users = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
    dave_user = next((u for u in users if u["username"] == "dave"), None)
    if dave_user:
        resp = requests.post(
            f"{BASE}/api/v1/admin/users/{dave_user['id']}/disable",
            headers={"Authorization": f"Bearer {alice}"},
            json={"reason": "seed: disabled user sample"},
        )
        if resp.ok:
            print("  OK   disable dave (disabled user sample)")
        else:
            print(f"  WARN disable dave: {resp.status_code} (may already be disabled)")
```

#### F.2 新增 dave 的 seed-data entry

目录：`scripts/seed-data/dave-disabled-notes/`

`meta.json`:

```json
{
  "summary": "Dave 的私有笔记（disabled 用户名下 entry 样例）",
  "tags": ["disabled", "private", "测试"],
  "is_public": false,
  "owner": "dave"
}
```

`notes.md`（内容文件）:

```markdown
# Disabled User Notes

此 entry 属于 dave（disabled 用户）。

用于验证：
- disabled 用户名下 entry 在用户被 disable 后仍存在
- admin 可见 disabled 用户的私有 entry
- 普通用户不可见 disabled 用户的私有 entry
```

#### F.3 新增 admin 私有 entry

目录：`scripts/seed-data/admin-private-config/`

`meta.json`:

```json
{
  "summary": "Admin 私有配置（权限边界样例）",
  "tags": ["admin", "private", "配置"],
  "is_public": false,
  "owner": "alice"
}
```

`config.md`（内容文件）:

```markdown
# Admin Private Config

此 entry 是 admin（alice）的私有配置。

用于验证：
- admin 私有 entry 对其他 admin 可见
- admin 私有 entry 对普通用户返回 404（防枚举）
- 权限边界：admin vs 普通用户的可见性差异
```

#### F.4 seed-data 维度补充后的覆盖矩阵

| 维度 | 补充前 | 补充后 |
|------|--------|--------|
| 格式 | 11 种（csv/json/yaml/xml/html/md/mermaid/plantuml/svg/png/py） | 不变 |
| 用户 | alice/bob/carol | +dave（disabled） |
| admin | alice（auto-admin） | 不变 |
| disabled 用户 | 无 | dave |
| 权限边界 | 2 private（bob/carol） | +admin 私有 + disabled 用户私有 |
| 总 entry 数 | 20 | 22 |

## 不改的项

- **D（E2E 强制 data-testid）**：需加 eslint 规则或 code review 检查，改动面大且属长期治理。agate v0.30.1 已在 P2 design 层提示选择器契约。F 项补齐 seed 用户维度后，E2E 不再需要临时造 admin/disabled 用户，D 项的 agate 层改动压力会减小（项目层投入缓解协议层复杂度）。
- **G 之外的 sync_versions.py 改动**：bump-version 双 commit 问题是流程习惯（先填 CHANGELOG 再 bump 即可），G 项的 `ensure_changelog` 改动已足够。

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
# 2. 确认 rate limit 在测试环境确实被禁用
cd backend && .venv/bin/python -c "
import os
os.environ['PEEKVIEW_SERVER__RATE_LIMIT_ENABLED']='false'
from peekview.config import PeekConfig
c = PeekConfig()
print(f'rate_limit_enabled={c.server.rate_limit_enabled}  (应为 False)')
assert c.server.rate_limit_enabled is False
print('OK: 测试环境 rate limit 已禁用')
"
# 3. 确认现有 rate limit 专项测试仍正常
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
import tempfile
with tempfile.TemporaryDirectory() as d:
    engine = init_db(f'{d}/test.db')
    with Session(engine) as s:
        u = create_test_user(s, 'alice', is_admin=True)
        print(f'created: {u.username} admin={u.is_admin} id={u.id}')
"
```

### F 验证

```bash
# 1. 首次 seed（干净库）
make debug-start
python3 scripts/seed-debug.py
# 期望：alice/bob/carol/dave 注册，22 entry 创建，dave 被 disable

# 2. 验证 dave disabled 且其 entry 存在
curl -s http://127.0.0.1:8888/api/v1/auth/login -d '{"username":"alice","password":"testpass123"}' -H 'Content-Type: application/json' | python3 -c "import sys,json; t=json.load(sys.stdin)['access_token']; print(t[:20])"
# 用 alice token 查 /admin/users 确认 dave is_active=False
# 用 alice token 查 /api/v1/entries?slug=dave-disabled-notes 确认 entry 存在

# 3. 幂等性：重跑 seed 不崩溃（BLOCKER 修复后验证）
python3 scripts/seed-debug.py
# 期望：dave login 失败 -> register 失败 -> register() 返回 None
#       -> main 循环 token=None 时 SKIP dave 的 entry（不 fallback 到 alice，避免 409）
#       -> create_entry 409 容错兜底（即使跳过逻辑漏了也不崩）
#       -> disable dave skip（已 disabled）
# 期望输出含："SKIP dave-disabled-notes: owner disabled (rerun)"

# 4. 权限边界：普通用户不可见 admin 私有 entry
# 用 bob token 查 /api/v1/entries?slug=admin-private-config -> 404

make debug-stop
```

## 改动清单

| 文件 | 改动 | 行数 | 来源 |
|------|------|------|------|
| `backend/tests/test_t073_bdd09_10_ruff_regression.py` | `python3 -m ruff` -> `ruff` + skip 兜底 | ~5 | v1 |
| `backend/tests/conftest.py` | `isolate_config_file` 加 `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false`，删 `reset_rate_limiter` | ~3 | v1 |
| `scripts/dev-server.sh` | stop_server 端口清理加 kill -9 兜底（多 PID 注释） | ~6 | v1 |
| `backend/tests/factories.py` | 加 create_test_user | ~25 | v1 |
| `scripts/sync_versions.py` | ensure_changelog 移动 [Unreleased] 而非插空模板（双版本限制说明） | ~10 | v1 |
| `scripts/seed-debug.py` | register() 容错 + create_entry() 409 容错 + dave 用户流程 + main 循环 token=None 跳过 + disable 逻辑 | ~35 | v2 新增（含 BLOCKER 修复） |
| `scripts/seed-data/dave-disabled-notes/` | 新增 disabled 用户私有 entry（meta.json + notes.md） | 2 文件 | v2 新增 |
| `scripts/seed-data/admin-private-config/` | 新增 admin 私有 entry（meta.json + config.md） | 2 文件 | v2 新增 |

总计 8 文件 ~84 行，全部小改动。改完后 T080 的 known-failures.md 第一条（ruff env）可删除，第二条（E2E 选择器）已在 P4 retry#3 修复。

## 实施顺序（按收益/风险比）

1. **B（rate limit env 禁用）**：收益最大，直接消除 `_create_user_direct` 这类绕过的动机，且 T080 已验证 env 时序正确
2. **C（kill -9 兜底）**：立即生效，消除 debug-stop 残留
3. **A（ruff 二进制）**：消除 known-failures 第一条，让 pytest 全绿
4. **E（create_test_user）+ F（seed-data 用户维度）**：一起做，单元测试 + E2E/debug 两层同时补齐
5. **G（ensure_changelog）**：改动 sync_versions.py 影响发布流程，建议最后做并配合一次 dry-run 验证

## 与 v1 的差异说明

| 项 | v1 | v2 | 理由 |
|----|----|----|------|
| A/B/C/E/G | approved | 原样继承 | v1 评审已通过，无需改动 |
| F | 不存在 | 新增 | v1 评审时未发现 seed-data 用户维度缺口 |
| 认知修正 | 曾误判"seed 无 admin 用户" | 修正：alice 已 auto-admin | 核实 `auth.py:87` 首用户即 admin |
| 实施顺序 | 未给 | 新增 §实施顺序 | 按收益/风险比排序，E+F 合并做 |

## 评审记录

- v1 评审（2026-08-06，plan-agent）：status=needs-revision。B 项方案失效（`monkeypatch.setattr(limiter,"enabled",False)` 被 `create_app()` 覆盖）+ B 机理不准（BDD-01 实际只 1 次 HTTP register）。A/C/E/G 通过。
- v1 修订（2026-08-06）：B 项改为环境变量 `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false`（isolate_config_file 内设，对齐 test_t054_b_rate_limit.py 先例），B 机理改为"测试环境应禁用而非 reset 兜底"。采纳 A（import 模块级）、C（多 PID 注释）、G（双版本限制）建议。
- v1 复审（2026-08-06，plan-agent）：status=approved。B 项核实通过。A/C/E/G 非阻塞建议均已采纳。可进入实施。
- v2 起草（2026-08-06，主 Agent）：新增 F 项（seed-data 用户/权限维度补充）。修正 v1 评审时的认知错误（alice 已是 admin）。F 项基于已核实的技术约束（disabled 用户无法 login、disable 不幂等、idempotency_key 兜底）设计幂等 seed 方案。待评审。
- v2 评审（2026-08-06，主 Agent，发布于 peek.gsis.top/yije1y）：status=needs-revision。F 项机理核实全部准确，但发现 BLOCKER：`seed-debug.py:140` `token = tokens.get(owner, alice)` 在 dave=None 时 fallback 到 alice token，导致 `entry_service.py:153` idempotency_key 跨 owner 冲突 -> ConflictError 409 -> `raise_for_status()` 崩溃。v2 承诺的"幂等重跑"不成立。
- v2 修订（2026-08-06，主 Agent）：按评审建议修复 BLOCKER。① main 循环 `token=None` 时直接跳过（不 fallback 到 alice），从根源避免跨 owner 调用；② `create_entry()` 容错 409 返回 None（双保险，即使跳过逻辑漏了也不崩）。更新 F 验证第 3 步期望输出。待复审。
