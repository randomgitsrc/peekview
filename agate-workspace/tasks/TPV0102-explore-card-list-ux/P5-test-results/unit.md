---
prod_touched: false
---
# P5 技术验证 — 单元/回归测试结果

- **任务**: TPV0102-explore-card-list-ux
- **阶段**: P5（技术验证）
- **执行者**: verifier subagent
- **日期**: 2026-11-11
- **git HEAD（基线）**: `d8adbec7` (`wf(TPV0102-P4): 代码实现——UTC 序列化契约 + TimeDisplay/VisibilityMenu + 两页挂载`)
- **命令真相源**: `P2-design.md` §9 `gate_commands`（7 条，逐字照跑，未挑跑）
- **环境**: debug backend `http://127.0.0.1:8888`（由主 Agent 后台 job 托底）；生产 `:8080` 全程 **000**

## [NO_NEED_CONFIRM]

本次 P5 未涉及任何数据删除/迁移等不可逆操作。

## 汇总（7 条命令全部执行）

| # | gate key | 命令 | exit | passed | failed | skipped | 耗时 | 判定 |
|---|---|---|---|---|---|---|---|---|
| 1 | `P5` | `make test-quick` | **2** | 1205 | **1**（预存） | 3 | 36s | ⚠️ 预存失败 |
| 2 | `P5_frontend` | `make test-frontend` | 0 | 1456 | 0 | 4 | 20s | ✅ PASS |
| 3 | `P5_e2e` | `E2E_SPEC=e2e/tpv0102-explore-card-list-ux.spec.ts make debug-test` | 0 | 61 | 0 | 3 | 174s | ✅ PASS |
| 4 | `P5_e2e_legacy` | `E2E_SPEC=e2e/team-visibility.spec.ts make debug-test` | **2** | 6 | **2**（fixture） | 0 | 262s | ⚠️ 已知 fixture 缺失 |
| 5 | `P5_lint` | `make lint` | 0 | — | 0 | — | <1s | ✅ PASS |
| 6 | `P5_typecheck` | `make typecheck` | 0 | — | 0 | — | 5s | ✅ PASS |
| 7 | `P5_fitness` | `cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short -k mixin_not_in_table_mro` | 0 | 1 | 0 | 19 deselected | 1s | ✅ PASS |

**总量**：`failed = 3`，其中 **预存/fixture = 3**，**TPV0102 引入的新增失败 = 0**。

> 命令 1（`make test-quick`，全量后端）与命令 2（`make test-frontend`，全量前端）均为**全量套件**，非只跑本任务新增测试。

---

## 逐条明细

### 命令 1 — `make test-quick`（后端全量单元/回归）

```
cd backend && .venv/bin/python -m pytest tests/ -n auto --tb=short
```
- **EXIT_CODE: 2**
- **计数**：`1 failed, 1205 passed, 3 skipped, 25 warnings in 34.73s`（外层总耗时 36s）
- **failed = 1** → 预存失败，见下节
- 本任务相关测试面（UTC 序列化 / TimeDisplay / VisibilityMenu / 两页挂载）全绿；1205 passed 无本任务引入的回归

### 命令 2 — `make test-frontend`（前端全量单元）

```
cd frontend-v3 && npx vitest run
```
- **EXIT_CODE: 0**
- **计数**：`Test Files 119 passed (119)` / `Tests 1456 passed | 4 skipped (1460)`
- **failed = 0**，`19.33s`（外层 20s）
- 备注：日志中 `[Vue warn] Invalid prop: type check failed` 与 `Mermaid render failed` 等为**既有噪声**，套件 exit 0 且 passed 计数正常 → 非失败

### 命令 3 — `P5_e2e`（本任务 E2E，`ui_affected: true`）

见 `e2e.md`。**EXIT_CODE: 0，61 passed / 3 skipped / 0 failed**。

### 命令 4 — `P5_e2e_legacy`（既有 team-visibility 回归）

见 `e2e.md`。**EXIT_CODE: 2，6 passed / 2 failed**（fixture 缺失，见下节）。

### 命令 5 — `make lint`（ruff，后端）

```
cd backend && .venv/bin/ruff check peekview/ tests/
```
- **EXIT_CODE: 0** — `All checks passed!`
- **failed = 0**

### 命令 6 — `make typecheck`（vue-tsc，前端）

```
cd frontend-v3 && npx vue-tsc --noEmit
```
- **EXIT_CODE: 0** — `✓ type check passed`
- **failed = 0**

### 命令 7 — `P5_fitness`（架构适应度：mixin 不污染表模型）

```
cd backend && .venv/bin/python -m pytest tests/test_utc_serialization.py -q --tb=short -k mixin_not_in_table_mro
```
- **EXIT_CODE: 0**
- **计数**：`1 passed, 19 deselected` — `PASSED tests/test_utc_serialization.py::TestBdd08TableModelsNotPolluted::test_mixin_not_in_table_mro`
- **failed = 0**
- 备注（如实记录取证过程）：首轮 `-q` 输出因 pyproject `addopts = "-q --tb=short"` 叠加而只有 `.` + `[100%]`、无汇总行；为取到 passed 计数，用同族命令加 `-rA` 复跑取得（**未修改任何测试**，函数名/文件名均按 P2 §6.1 冻结值使用）。`-k` 零命中会 exit 5，本次为 1 passed ⇒ 定向命中正常，非假绿。

---

## 预存失败（单列）

### 预存失败：1 —— `test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`（与本次改动无关）

- **现象**：`assert 1 == 0`，子进程 CLI 退出码 1
- **机理（已独立取证，非自述）**：
  - 该用例**未隔离 HOME**，直接 `subprocess.run([python, -m, peekview, config, set, remote.api_key, ...])` → CLI 写真实 `~/.peekview/config.yaml`
  - 本沙箱将 `~/.peekview/` 挂为**只读文件系统** → `OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'`
  - 环境侧佐证：`touch /home/kity/.peekview/.p5probe` → `touch: 无法 touch '/home/kity/.peekview/.p5probe': 只读文件系统`
  - 对照组：同文件 `test_config_set_remote_url` 用 `patch.dict(os.environ, {"HOME": tmp_path})` 隔离 HOME → **1 passed**（证明非代码缺陷）
- **归属**：`P4-review.md` T-12 / 派发单「已知的合法失败 #1」；本文件 `backend/tests/test_cli_remote.py` 在 P4（commit `d8adbec7`）**未被修改**（`git status --porcelain backend/tests/test_cli_remote.py` 为空，最近改动为 TPV0090 的 `7612895c`）
- **处置**：登记 `known-failures.md` 第 1 条（WARNING 级，不阻断推进）

### 已知 fixture 缺失（非 TPV0102 缺陷）：2 —— `e2e/team-visibility.spec.ts` BDD-40

- 2 failed = 同一测试在 `[chromium]` 与 `[Mobile Chrome]` 两个 project 各失败一次
- 根因与独立取证见 `known-failures.md` 第 2 条：`proj-a` 不在 debug seed → 造数 `POST /api/v1/entries` 返回 **422**，卡片不存在 → 前置断言 `:157 toHaveCount(1)` 得 0
- 归属：`P4-review.md` T-14 / 派发单「已知的合法失败 #2」
- **不**计入 TPV0102 引入的失败

---

## 结论

- 7 条 `gate_commands` **全部执行**，无挑跑、无跳过。
- **事实**：非零退出的命令 2 条（#1 `make test-quick` exit 2、#4 `P5_e2e_legacy` exit 2），其余 5 条 exit 0。
- **归因**：命令 #1 的唯一 failed 已独立取证为**沙箱环境性预存失败**（`~/.peekview/` 只读，Errno 30）；命令 #4 的 2 failed 已独立取证为**既有 spec 的 fixture 缺失**（`proj-a` 不在 seed，POST 422）。二者均**非 TPV0102 引入**。
- 本任务主验证面全绿：后端 1205 passed（除预存 1 项）、前端 1456 passed / 0 failed、本任务 E2E 61 passed / 0 failed、lint / typecheck / fitness 全 exit 0。
- 状态标记：`[PROD_NOT_TOUCHED]` —— 全程 `:8080` 探活 000，未写 `~/.peekview/`（其只读本身也阻止写入）。
- 未修改任何被验证的代码或测试（只读纪律，见 `git status` 核验）。

### `EXIT_CODE` 取值说明（避免歧义）

下表末行 `EXIT_CODE: 2` = **7 条命令中非零退出者的退出码**（#1 与 #4 均为 2），**不是** verifier 对 P5 的放行/否决裁决。
按派发单「判定纪律」，verifier **不自行判"通过"**——「预存失败 / fixture 缺失是否放行」由主 Agent 依据 `known-failures.md` 的独立复现证据裁决。
若主 Agent 认可两条均属已知非本任务缺陷，则 TPV0102 的有效结论为 **failed(本任务引入)=0**；本文件不代其落此裁决。

---

## 附录 A：test runner 原始输出签名（逐字摘录，供 N5 签名校验）

> 仅摘汇总行/失败清单行，不含逐项 traceback。完整日志见 `.agate-tmp/p5/*.log`（临时目录，非产出）。

**命令 1 `make test-quick`（exit 2）**

```
FAILED tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key
1 failed, 1205 passed, 3 skipped, 25 warnings in 34.73s
```

**命令 2 `make test-frontend`（exit 0）**

```
 Test Files  119 passed (119)
      Tests  1456 passed | 4 skipped (1460)
   Duration  19.33s (transform 11.07s, setup 19ms, collect 42.10s, tests 32.46s, environment 143.67s, prepare 19.55s)
```

**命令 3 `P5_e2e`（exit 0）**

```
  3 skipped
  61 passed (39.4s)
=== ✓ 所有 E2E 测试通过 ===
```

**命令 4 `P5_e2e_legacy`（exit 2）**

```
  2 failed
  6 passed (2.1m)
```

**命令 5 `make lint`（exit 0）**

```
All checks passed!
```

**命令 6 `make typecheck`（exit 0）**

```
  ✓ type check passed
```

**命令 7 `P5_fitness`（exit 0）**

```
PASSED tests/test_utc_serialization.py::TestBdd08TableModelsNotPolluted::test_mixin_not_in_table_mro
1 passed, 19 deselected in 0.30s
```

EXIT_CODE: 2
