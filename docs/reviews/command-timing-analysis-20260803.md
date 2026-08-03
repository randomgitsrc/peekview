# PeekView 命令执行时间分析

> 2026-08-03 | 基于实测数据 | 环境：Linux x86_64, WSL2

## 1. 实测数据总表

| 命令 | 耗时 | 说明 |
|------|------|------|
| `make clean` | 0.5s | 删除 dist/node_modules/.vite/\_\_pycache\_\_ |
| `npm ci` | 7.4s | 重新安装所有依赖（node_modules 已存在时） |
| `npm run build`（vue-tsc + vite build） | 16.8s | vue-tsc 4.2s + vite build 12.3s |
| `npx vue-tsc --noEmit` | 4.2s | 纯类型检查 |
| `make build-frontend-fast` | 17.3s | npm cache + vite build + copy static |
| `make debug-start` | 3.2s | dev-server.sh start + sleep 2 |
| `make debug-seed` | 1.2s | seed-debug.py（20 entry 从文件加载） |
| `make debug-stop` | 2.0s | 停服务 + 清理 /tmp/peekview-debug/ |
| `make debug-quick` | **21.7s** | build-fast + start + seed |
| `make lint`（ruff） | 0.05s | 后端代码检查 |
| `npx vitest run`（全量 91 文件） | **170s (2m50s)** | 1199 测试 |
| `npx vitest run`（排除 TableView.spec） | **13s** | 1186 测试 |
| `npx vitest run TableView.spec`（单独） | **146s (2m27s)** | 13 测试 |
| `pytest test_language.py` | 0.8s | 63 测试 |
| `pytest tests/`（全量） | **159s (2m40s)** | 1008 测试 |
| `make debug-test`（E2E 全量） | **~5min** | Playwright CDP 全量 |
| `make debug-test-mcp` | **~1min** | MCP 集成测试 |
| `make debug`（完整 CI 级） | **~7min** | clean+build+start+verify+E2E+MCP |

## 2. 问题分析

### 2.1 vitest 全量 170s — 91% 耗时集中在一个文件

**数据**：

| 范围 | 文件数 | 测试数 | 耗时 |
|------|--------|--------|------|
| 全量 | 91 | 1199 | 170s |
| 排除 TableView.spec | 90 | 1186 | **13s** |
| TableView.spec 单独 | 1 | 13 | **146s** |

**结论**：90 个文件 1186 个测试只需 13s，1 个文件 13 个测试耗 146s——**TableView.spec 占全量 91% 耗时**。

**根因**：TableView.spec 的 `test_bdd_22_truncation_banner_with_download` 在 jsdom 中渲染 50000 行 CSV 表格，单测试耗 ~140s。jsdom 不是真实浏览器，DOM 操作极慢。

**还引发连锁问题**：
- vitest worker RPC 通信超时（`Timeout calling "onTaskUpdate"`），产生 2 个 unhandled errors
- 全量 exit code 非 0（虽然 0 failed），pre-commit hook 可能因此异常

**优化方向**：
1. **BDD-22 测试降低数据量**：测试 maxRows 截断逻辑不需要真的渲染 50000 行。用 `maxRows=100` 测截断行为，断言"渲染 100 行 + 截断 banner"，~0.1s 完成
2. 或给 BDD-22 单独设 `testTimeout: 300000` + `singleThread: true`，但治标不治本
3. 优化后全量 vitest 从 170s 降到 ~15s

### 2.2 pytest 全量 159s — 2 个测试占 16%

**数据**：

| 测试 | 耗时 | 占比 |
|------|------|------|
| `test_admin_cleanup_remote_mode_flag` | 12.86s | 8% |
| `test_admin_stats_remote_mode_flag` | 12.85s | 8% |
| `test_cli_remote_list` setup ×4 | 6.7s | 4% |
| 其余 1002 测试 | ~127s | 80% |

**根因**：admin_stats/cleanup 测试启动了完整的 FastAPI 应用 + CLI 子进程，每次 ~13s。CLI remote 测试的 setup 每次启动 uvicorn 子进程 ~1.7s。

**是否合理**：admin_stats 测试启动完整应用是合理的（集成测试），但 2 个测试占 16% 耗时偏高。可考虑共享 fixture 或标记为 `@pytest.mark.slow` 单独跑。

**优化方向**：低优先级——159s 对于 1008 个测试（含集成测试）是合理的。如果需要加速，admin_stats 2 个测试可以共享 app fixture。

### 2.3 `make debug` 完整流程 ~7min — E2E 占 70%

**数据**：

| 步骤 | 耗时 | 占比 |
|------|------|------|
| clean | 0.5s | 0% |
| npm ci | 7.4s | 2% |
| vite build | 16.8s | 4% |
| debug-start | 3.2s | 1% |
| debug-seed | 1.2s | 0% |
| debug-verify-isolation | ~3s | 1% |
| **debug-test（E2E）** | **~300s** | **70%** |
| debug-test-mcp | ~60s | 14% |

**结论**：`make debug` 的 7min 中，E2E + MCP 占 ~6min（84%），构建+启动+seed 仅 ~30s。这是合理的——E2E 需要真实浏览器交互，CDP 连接 + 页面加载 + 测试执行都有固有成本。

**对比 `make debug-quick`**：21.7s（跳过 E2E + MCP + clean + npm ci），适合开发迭代。

**优化方向**：
1. `make debug` 的 `npm ci` 改为 `npm install`（仅在 package.json 变化时更新）——省 ~5s
2. `debug-build` 的 `clean` 步骤在迭代开发时非必要——可以提供 `debug-build-fast` 跳过 clean
3. E2E 改为 `workers: 1` 串行模式可能更稳定（当前并发导致 CDP 超时）

### 2.4 E2E CDP 超时 — 环境稳定性问题

**现象**：T085 执行期间 E2E 单跑也超时（120s/300s），CDP Chrome :18800 `json/version` 可访问但 Playwright `connectOverCDP` 卡住。

**根因**：WSL2 + Windows Chrome 的 CDP 连接不稳定。fullyParallel 8 worker 共享 :18800 单连接竞争。

**影响**：P5 阶段 ~1h 损耗（2 次超时 + 诊断 + 重启 debug）。P6 verifier subagent 最终成功（可能 retry 或连接时机不同）。

**优化方向**：
1. playwright.config.ts 改为 `workers: 1`（串行模式，稳定但慢）
2. 或 `fullyParallel: false` + `retries: 2`
3. 或拆分大 spec 文件（render-regression.spec.ts 11 测试 → 2-3 个小文件）

### 2.5 pre-commit hook 超时 — 导致 --no-verify 8 次

**现象**：T085 的 P2-P8 commit 全部用 `--no-verify`。

**根因**：不是 hook 本身慢（实测 0.023s），而是 hook 内 check-gate.sh 读 state.yaml phase 时，state 已推进到下一阶段但产出文件未暂存 → gate 失败 → hook 拦截 → commit 失败。主 Agent 用 --no-verify 绕过。

**影响**：8 次 commit 跳过 gate 验证（provenance/SCOPE+ 等检查被绕过）。

**优化方向**：state.yaml phase 更新时机调整——先 commit 当前阶段产出，commit 后再更新 state phase 推进。

## 3. 各命令是否合理

| 命令 | 耗时 | 是否合理 | 说明 |
|------|------|---------|------|
| `make clean` | 0.5s | ✅ | 快 |
| `npm ci` | 7.4s | ✅ | 合理（node_modules 已缓存） |
| `npm run build` | 16.8s | ✅ | vue-tsc 4.2s + vite 12.3s，合理 |
| `make build-frontend-fast` | 17.3s | ✅ | 跳过 npm ci，合理 |
| `make debug-start` | 3.2s | ✅ | 含 sleep 2 |
| `make debug-seed` | 1.2s | ✅ | 20 entry 从文件加载 |
| `make debug-quick` | 21.7s | ✅ | 开发迭代合理 |
| `make lint` | 0.05s | ✅ | 极快 |
| `vue-tsc --noEmit` | 4.2s | ✅ | 合理 |
| `pytest test_language.py` | 0.8s | ✅ | 快 |
| **`npx vitest run`（全量）** | **170s** | **❌ 不合理** | **91% 耗时在 1 个文件（TableView BDD-22 50000 行 jsdom）** |
| `npx vitest run`（排除慢测试） | 13s | ✅ | 合理 |
| `pytest tests/`（全量） | 159s | ⚠️ 基本合理 | 2 个 admin 测试占 16%，可优化但非必须 |
| `make debug-test`（E2E） | ~5min | ⚠️ 可接受 | CDP 环境不稳定时超时 |
| `make debug`（完整） | ~7min | ⚠️ 可接受 | E2E 占 70%，是 CI 级验证 |

## 4. 优化优先级

| # | 优化项 | 当前 | 优化后 | 收益 | 优先级 |
|---|--------|------|--------|------|--------|
| 1 | **BDD-22 测试降数据量** | 50000 行 jsdom 140s | maxRows=100 ~0.1s | vitest 全量 170s→15s | **P0** |
| 2 | npm ci → npm install（build-frontend） | 7.4s | ~0.1s（缓存命中时） | make debug 省 7s | P2 |
| 3 | E2E workers:1 | 并发不稳定 | 串行稳定 | 消除 CDP 超时 | P2 |
| 4 | admin_stats 共享 fixture | 25.7s | ~13s | pytest 省 13s | P3 |
| 5 | state.yaml 更新时机 | hook 超时 | 正常 | 消除 --no-verify | P1（agate 层面） |

## 5. 结论

项目命令整体执行时间合理，**唯一严重问题是 vitest 全量 170s 中 146s 花在 TableView.spec 的 BDD-22 50000 行 jsdom 渲染**——这在开发迭代中是显著的摩擦。改为用小数据量测试截断逻辑可将全量从 170s 降到 ~15s，提速 11 倍。

`make debug` 的 7min 主要是 E2E（~5min）+ MCP（~1min），作为 CI 级验证可接受。`make debug-quick` 的 21.7s 适合开发迭代。

E2E CDP 超时是 WSL2 环境的固有问题，改 `workers: 1` 可提升稳定性。
