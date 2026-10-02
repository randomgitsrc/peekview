---
phase: P5
task_id: TPV0100
type: test-results
role: verifier
created: 2026-10-02
---

# P5 技术验证结果 — TPV0100 网页发布入口

> verifier 只读验证产出。命令清单取自 `P2-design.md` §5 `gate_commands`（权威）。
> 环境：debug backend `127.0.0.1:8888`（主 Agent 已 `debug-start` + `debug-seed`，verifier 未启动/停止服务）。

## 1. 命令执行结果（逐条）

### P5 — 前端单元测试（全量）

- 命令：`make test-frontend`（= `npx vitest run`，非 watch）
- 超时：`timeout 180`
- **exit code：0**
- 签名行：`Test Files  112 passed (112)` / `Tests  1364 passed | 4 skipped (1368)`
- 汇总：**1364 passed / 0 failed**（4 skipped）
- 通过。

### P5_backend — 后端不回归（全量 pytest）

- 命令：`make test-quick`（= venv pytest，xdist 并行）
- 超时：`timeout 300`
- **exit code：0**
- 签名行：`1173 passed, 3 skipped, 25 warnings in 34.56s` / `✓ Tests passed`
- 汇总：**1173 passed / 0 failed**（3 skipped）
- 通过。本任务后端零改动，全量后端套件仍绿。

### P5_typecheck — 类型检查（CI 强制）

- 命令：`make typecheck`（= `npx vue-tsc --noEmit`）
- 超时：`timeout 180`
- **exit code：0**
- 签名行：`✓ type check passed`
- 通过。

### P5_e2e — 端到端（ui_affected: true，必填）

- 命令：`E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test`
- 超时：`timeout 600`
- **exit code：0**
- 签名行：`39 passed (39.7s)` / `=== ✓ 所有 E2E 测试通过 ===` / `1 flaky`
- 汇总：**39 passed / 0 failed**，另 **1 flaky**（详见 §3 / `e2e.md`）
- 通过（flaky 已按 P5 规则记录，见 §3）。

## 2. 汇总表

| key | 命令 | 超时 | exit | passed | failed | skipped | 判定 |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| P5 | `make test-frontend` | 180s | 0 | 1364 | 0 | 4 | 通过 |
| P5_backend | `make test-quick` | 300s | 0 | 1173 | 0 | 3 | 通过 |
| P5_typecheck | `make typecheck` | 180s | 0 | — | 0 | — | 通过 |
| P5_e2e | `E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test` | 600s | 0 | 39 | 0 | — | 通过（1 flaky） |

**全量测试**：已运行全量（`make test-frontend` 为全量 vitest、`make test-quick` 为全量后端 pytest），非抽样。

## 2.1 Runner 签名行（供 N5 签名校验，行首计数）

```
Test Files  112 passed (112)
Tests  1364 passed | 4 skipped (1368)
1173 passed, 3 skipped, 25 warnings in 34.56s
✓ type check passed
39 passed (39.7s)
1 flaky
passed: 1364 (frontend) / 1173 (backend) / 39 (e2e)
failed: 0 (frontend) / 0 (backend) / 0 (e2e)
```

**预存失败**：无。四条命令均 exit 0 + failed=0，无与本任务无关的预存失败（故未登记 `known-failures.md`）。

## 3. Flaky 记录（P5 规则：flaky → 记入 P5-test-results，三振记录）

- 用例：`[Mobile Chrome] › e2e/tpv0100-publish.spec.ts:354:3 › TPV0100 Publish 1280x800 › test_bdd_10_result_links_copyable`
- 现象：首次尝试在 `openPublish()` 的 `page.waitForSelector('#app > *', { timeout: 20000 })`（spec L111）超时——`#app` 下首个可见元素仅 `div.toast-container`（`toast-container` 为 hidden），页面根未及时渲染。**重试 #1 通过**。
- 判定：**flaky（第 1 次记录）**，非确定性失败。E2E 结果为 `1 flaky / 39 passed`，Playwright 最终报告 exit 0。
- 失败截图：`frontend-v3/test-results/tpv0100-publish-TPV0100-Pu-8e8c5-dd-10-result-links-copyable-Mobile-Chrome/test-failed-1.png`

## 4. 生产隔离

`[PROD_NOT_TOUCHED]`

- 全程仅使用 debug backend `127.0.0.1:8888`（数据目录 `/tmp/peekview-debug/`）。
- `ss -ltn` 实测：仅 `127.0.0.1:8888` 监听，**未**出现 `:8080`（生产未启动/未触碰）。
- 未运行 CLI `peekview create`；未向系统 Python 安装；未操作 `~/.peekview/`。
- E2E 创建的 entry 由 spec `afterEach` 经 API 清理（debug 库）。

## 5. 边界声明

- 不声称 P6 已过——P6 是主 Agent 的用户视角验收。
- verifier 未改任何代码/测试。
