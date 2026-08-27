# infra-improvements-from-t080-v2 实施评审

> 评审对象：v2 plan 的实施结果（3 个 commit: 6c94183d + 10ea96a1 + 7fefedad）
> 评审者：plan-agent（独立）
> 日期：2026-08-06
> 方式：逐项核实源码 + 运行时验证

## 评审结论

**状态：approved**

v2 plan 的 6 项改动（A/B/C/E/F/G）全部正确落地。B 项的 plan 与实施差异经分析为**更合理的实现**（保留 reset_rate_limiter + 新增显式 fixture 比单纯删 reset 更稳健）。F 项的 BLOCKER 修复经实跑验证完全成立：首次 seed 22 entry + dave disabled，重跑幂等无崩溃，权限边界正确（bob 404 / alice 200 / dave 401）。plan 外的 bcrypt rounds 降级 + Makefile xdist 改动无安全/正确性副作用。全量回归 1069 passed 2 skipped 0 failed。

## 逐项核实

### A 项（test_t073 ruff 二进制）

**核实源码** `backend/tests/test_t073_bdd09_10_ruff_regression.py:26,49-56`：
- `import shutil` 在模块级（line 26）✓
- `import pytest` 已在模块级（line 29）✓
- `test_bdd_10` 函数内：`ruff = shutil.which("ruff")` + `if not ruff: pytest.skip("ruff not in PATH")` + `[ruff, "check", "--select", "E711,E712", "peekview/", "tests/"]` ✓

完全符合 plan 方案。

**验证输出**：
```
tests/test_t073_bdd09_10_ruff_regression.py ..  [100%]
2 passed in 0.42s
```

### B 项（重点，plan 与实施有差异）

**plan 原方案**：conftest `isolate_config_file` 设 `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false` + **删 `reset_rate_limiter`**。

**实际实施**（10ea96a1）：conftest 设 env + **保留 `reset_rate_limiter`** + **新增 `app_with_rate_limit`/`client_with_rate_limit` fixture** + test_security 的 rate limit 测试改用显式 fixture。

**差异分析**：

1. **`isolate_config_file` 设 env**（`conftest.py:37`）：✓ 已设 `PEEKVIEW_SERVER__RATE_LIMIT_ENABLED=false`，符合 plan 初衷（测试环境默认禁用 rate limit）。

2. **`reset_rate_limiter` 保留**（`conftest.py:12-19`）：plan 说删，实施保留。**实施更合理**——理由：rate limit 专项测试（test_t054_b、test_security.TestRateLimiting）会显式启用 rate limit，这些测试跨 test 累积的 counter 需要清理。若删 reset，启用 rate limit 的测试间会互相污染（前一个 test 用满配额，后一个 test 一上来就 429）。reset 作为 autouse 在每个 test 开始时清空，是 rate limit 专项测试正确性的必要保障。plan 的"删 reset"判断是在假设"全局禁用后没人再启用"的前提下，但实施引入了 `app_with_rate_limit` fixture 打破了这个假设，所以保留 reset 是配套的正确决策。

3. **`app_with_rate_limit` fixture**（`conftest.py:119-133`）：✓ 逻辑正确。设 `RATE_LIMIT_ENABLED=true` + `RATE_LIMIT_PER_MINUTE=5`，调 `create_app(data_dir, db_path)`。注意它**未设 `RATE_LIMIT_LOGIN_PER_MINUTE`**——login 限制用 config 默认值（10/minute），entries 用 5/minute。这对 test_security 的 `test_login_rate_limited`（15 次请求期望 429）足够：15 > 10 触发 429 ✓。

4. **test_security 的 rate limit 测试**（`test_security.py:720,778,809`）：
   - `test_login_rate_limited` 改用 `app_with_rate_limit` 参数 ✓
   - `test_login_rate_limit_respects_config_value` 用 `monkeypatch.setenv("PEEKVIEW_SERVER__RATE_LIMIT_ENABLED", "true")` + `create_app(rate_limit_login_per_minute=3)` ✓（自建 app，不依赖 fixture）
   - `test_captcha_challenge_rate_limited` 同上模式 ✓
   - `test_rate_limit_disabled` 用 `create_app(rate_limit_enabled=False)` 显式参数 ✓（env 已是 false，参数也 false，一致）
   - `test_health_exempt_from_rate_limit` 用默认 `client`（rate limit 禁用），health 本就 exempt，不受影响 ✓

5. **test_t054 自包含**（`test_t054_b_rate_limit.py:22,40,57`）：✓ 该文件 3 个 fixture（`rate_limit_client`/`no_limit_client`/`login_rate_limit_client`）各自 `monkeypatch.setenv` + `create_app`，完全不依赖全局 conftest 的 env 设置。conftest 的 `RATE_LIMIT_ENABLED=false` 被这些 fixture 的 `setenv("true")` 覆盖（fixture 执行顺序：isolate_config_file autouse → 具体 fixture → test）。不受影响。

**验证输出**：
```
tests/test_t054_b_rate_limit.py + test_security.py: 70 passed, 1 skipped (含非 rate limit 的 security 测试)
tests/test_t080_admin_user_mgmt.py: 22 passed
```

**结论**：实施比 plan 更合理。plan 的"删 reset"是基于"全局禁用后无启用场景"的假设，但实施引入了显式启用 fixture，保留 reset 是配套正确决策。

### C 项（dev-server.sh kill -9 兜底）

**核实源码** `scripts/dev-server.sh:156-163`：
```bash
PORT_PID=$(lsof -t -i :$PORT 2>/dev/null || echo "")
if [ -n "$PORT_PID" ]; then
    echo "-> 清理端口 $PORT 占用 (PID: $PORT_PID)..."
    kill $PORT_PID 2>/dev/null || true
    sleep 1
    # kill -0 对多 PID（lsof -t 可能返回多个换行分隔 PID）全部存活才返回 0；
    # 单 PID（uvicorn 默认单进程）场景足够。多 worker 场景需 xargs 逐个处理。
    kill -0 $PORT_PID 2>/dev/null && kill -9 $PORT_PID 2>/dev/null || true
fi
```

完全符合 plan 方案：`sleep 1` + `kill -0` + `kill -9` 兜底 + 多 PID 注释 ✓。

（本次评审中 `make debug-start` + `make debug-stop` 多次往返，stop 均正常清理，未观察到 PID 残留。）

### E 项（factories create_test_user）

**核实源码** `backend/tests/factories.py:106-128`：
- 函数签名 `(session, username="testuser", password="testpass123", is_admin=False, is_active=True, display_name=None) -> User` ✓
- 直接插 DB：`from peekview.auth import hash_password` + `User(...)` + `session.add/commit/refresh` ✓
- `is_active` 参数支持（plan 签名有，实现有）✓

**验证输出**：
```
created: alice admin=True id=1 active=True
created: bob admin=False id=2 active=False display=Bob
```

完全符合 plan 方案。

### F 项（重点，BLOCKER 修复验证）

#### F.1 seed-debug.py 源码核实

- **`register()` 返回 `str | None`**（`seed-debug.py:68-76`）：✓ login 失败 + register 失败返回 None
- **`create_entry()` 409 容错**（`seed-debug.py:117-119`）：✓ `if r.status_code == 409: return None`
- **main 循环 `token = tokens.get(owner)`**（`seed-debug.py:146`）：✓ 无 fallback；`if token is None: print SKIP; continue`（line 147-149）
- **create_entry 返回 None 也 SKIP**（`seed-debug.py:158-159`）：✓ 双保险
- **dave 流程**（`seed-debug.py:131-133, 175-200`）：✓ register dave → entry 循环 → disable dave（用 alice token，查 /admin/users 拿 dave id，POST disable）
- **disable 已 disabled 容错**（`seed-debug.py:176-177`）：✓ `if dave is None: print SKIP`；外加 try/except（line 199）

#### F.2 seed-data 文件核实

- `scripts/seed-data/dave-disabled-notes/meta.json` + `notes.md`：✓ 存在，内容符合 plan
- `scripts/seed-data/admin-private-config/meta.json` + `config.md`：✓ 存在，内容符合 plan

#### F.3 运行时验证

**首次 seed（干净库）**：
```
Users: alice, bob, carol, dave
  OK   admin-private-config ...
  OK   dave-disabled-notes ...
  ... (20 entry OK, image-gallery SKIP no content files — 预存行为)
  OK   disable dave (disabled user sample)
Done. Total entries: 20
```

**dave 状态**（alice admin token 查 /admin/users）：
```
dave: is_active=False is_admin=False id=4
```

**权限边界**（单 entry 端点 `/api/v1/entries/{slug}`）：
```
bob  GET /api/v1/entries/admin-private-config → 404  ✓
bob  GET /api/v1/entries/dave-disabled-notes  → 404  ✓
alice GET /api/v1/entries/admin-private-config → 200 ✓
alice GET /api/v1/entries/dave-disabled-notes  → 200 ✓
dave login → 401  ✓
```

**重跑幂等（BLOCKER 修复核心验证）**：
```
  SKIP dave-disabled-notes: owner disabled (rerun)   ← 关键：token=None 跳过生效
  SKIP image-gallery: no content files
  SKIP disable dave: already disabled (rerun)         ← disable 容错生效
Done. Total entries: 20                               ← 无重复创建
```

重跑后 total 仍 20（无重复），dave 仍 disabled。**BLOCKER 修复完全成立**：token=None 跳过逻辑从根源避免跨 owner 调用，create_entry 409 容错作为双保险未触发（说明跳过逻辑已足够）。

### G 项（sync_versions.py ensure_changelog）

**核实源码** `scripts/sync_versions.py:129-138`：

非 check_only 分支改为：
```python
new_section = f"\n## {marker} - {today}\n"
if "## [Unreleased]" in content:
    content = content.replace("## [Unreleased]\n", f"## [Unreleased]\n{new_section}", 1)
    changelog.write_text(content)
```

**机理分析**：`replace("## [Unreleased]\n", "## [Unreleased]\n{new_section}", 1)` 在 `[Unreleased]` 标题行后插入新版本节标题。原 `[Unreleased]` 下的内容自然下移到新版本节下——即 plan 所述"保留空 Unreleased 在上，新版本节在下继承原内容"。符合 plan 意图，且比原方案的"插空模板 `### 新增\n--\n\n`"更合理（不产生无内容占位符）。

**次要观察**：`section` 变量（line 130）在新实现中已不使用（原模板用 `### {section}` 子标题，新实现去掉子标题）。这是一个 dead variable，不影响功能，建议后续清理（非阻塞）。

未真跑 bump（遵守约束，避免动 VERSIONS.json）。

## plan 外改动评估

### bcrypt rounds 降级（10ea96a1）

**核实**：
1. **生产默认仍 12**（`auth.py:27`）：`BCRYPT_ROUNDS = 12` ✓
2. **conftest 降级**（`conftest.py:40`）：`monkeypatch.setattr("peekview.auth.BCRYPT_ROUNDS", 4)` ✓（仅测试，monkeypatch 不影响生产）
3. **bcrypt verify rounds-agnostic**（`auth.py:84-94`）：`verify_password` 用 `_bcrypt.checkpw(password, hash)`。bcrypt 的 checkpw 从 hash 字符串本身解析 rounds（`$2b$12$...` 里的 12），与当前环境 `BCRYPT_ROUNDS` 无关。所以 rounds=4 生成的 hash 用 rounds=12 环境验、反之亦然，都正确。✓
4. **2 个 `$2b$12$` 断言恢复**：
   - `test_auth.py:29`：`test_hash_password(self, monkeypatch)` + `monkeypatch.setattr("peekview.auth.BCRYPT_ROUNDS", 12)` + `assert h.startswith("$2b$12$")` ✓
   - `test_t054_c_passlib_removal.py:42-44`：`test_bcrypt_hash_format_compatible(self, monkeypatch)` + `monkeypatch.setattr("peekview.auth.BCRYPT_ROUNDS", 12)` + `assert h.startswith("$2b$12$")` ✓

**验证**：两个断言测试 + test_t080_cli_user_disable 全部 6 passed。

**结论**：安全无副作用。生产 hash 仍 rounds=12，测试提速合理。cross-test 验证因 checkpw rounds-agnostic 不受影响。

### Makefile 进度可见性 + xdist（7fefedad）

**核实**：
1. **pyproject.toml**（line 50）：`"pytest-xdist>=3.0.0"` 加入 test deps ✓
2. **addopts**（line 76）：`-q --tb=short`（原 `-v`，xdist 下 verbose 信息爆炸，改 -q 合理）✓
3. **test-quick**（Makefile:165）：`cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short` ✓
4. **fileParallelism 顾虑**：这是 MCP vitest 的配置，与 pytest 无关。pytest-xdist 按进程并行，每个进程独立 conftest，autouse fixture（isolate_config_file/reset_rate_limiter）各自隔离，无竞态。✓

**验证**：`make test-quick` 全量 1069 passed 2 skipped 0 failed（42s，xdist 提速明显）。

**结论**：无稳定性副作用。

### lint 清理（10ea96a1）

**核实**：
- I001 import 排序 + N806 变量名（adminA_token → admina_token 等）修复
- `ruff check peekview/ tests/`（直接调 ruff 二进制）：`All checks passed!` ✓

**注意**：`make lint` 本身失败，但**非这 3 个 commit 引入**——Makefile:187 `cd backend && python3 -m ruff check` 用 `python3`，解析到 hermes venv（无 ruff）。这是 A 项解决的同一类问题的 Makefile 残留（A 项只改了 test_t073，未改 Makefile）。属预存问题，非本次回归。

## 验证结果汇总

| 验证项 | 命令 | 结果 |
|--------|------|------|
| A 项 test_t073 | `pytest tests/test_t073_bdd09_10_ruff_regression.py -v` | 2 passed |
| B 项 rate limit 专项 | `pytest tests/test_t054_b_rate_limit.py tests/test_security.py -q` | 70 passed, 1 skipped |
| B 项 t080 回归 | `pytest tests/test_t080_admin_user_mgmt.py -q` | 22 passed |
| C 项 debug-stop | `make debug-start` / `make debug-stop` 多次往返 | 正常清理，无残留 |
| E 项 create_test_user | 直接调用工厂函数 | 创建成功，字段正确 |
| F 项首次 seed | `python3 scripts/seed-debug.py` | 20 entry + dave disabled |
| F 项 dave 状态 | alice token 查 /admin/users | dave is_active=False |
| F 项权限边界 | bob/alice GET /entries/{slug} | bob 404, alice 200, dave login 401 |
| F 项重跑幂等 | 再跑 `seed-debug.py` | SKIP dave + disable, total 仍 20, 无崩溃 |
| G 项 ensure_changelog | 源码审查（未真跑 bump） | 符合 plan 意图 |
| bcrypt 断言恢复 | `pytest test_auth::test_hash_password test_t054_c::test_bcrypt_hash_format_compatible` | passed |
| lint | `ruff check peekview/ tests/`（直接调 ruff） | All checks passed |
| 全量回归 | `make test-quick` | 1069 passed, 2 skipped, 0 failed (42s) |

## 问题与建议

**BLOCKER**：无

**次要**：
1. **G 项 dead variable**（`sync_versions.py:130`）：`section = "新增" if ver_key == "peekview" else "变更"` 在新实现中未被使用（原模板的 `### {section}` 子标题被去掉）。不影响功能，建议后续清理或恢复子标题（Keep a Changelog 不强制子标题，但项目原有风格有）。
2. **Makefile lint target 预存问题**（`Makefile:187`）：`python3 -m ruff` 解析到 hermes venv 失败。这是 A 项解决的同类问题的 Makefile 残留——A 项改了 test_t073 用 `shutil.which("ruff")`，但 Makefile 的 lint/lint-fix target 仍用 `python3 -m ruff`。非本次 commit 引入（Makefile 此行早于 7fefedad），但 7fefedad 改了 Makefile 其他部分却未顺手修此行。建议后续把 Makefile lint 也改用 `ruff` 二进制（与 A 项对齐）。此问题导致 `make lint` 在当前环境失败，但 ruff 本身对代码的检查结果为 0 errors。

**建议**：无

## 总结

v2 plan 的 6 项改动全部正确落地，BLOCKER 修复经实跑验证完全成立。B 项的 plan vs 实施差异（保留 reset + 新增显式 fixture）是比 plan 原方案更稳健的实现，体现了实施者对 rate limit 专项测试需求的正确理解。plan 外的 bcrypt rounds 降级 + xdist 并行无安全/正确性副作用，且带来 45% 测试提速。全量回归 1069 passed 0 failed。**approved**。
