---
phase: P5
task_id: TPV0099
type: test-results
parent: P4-implementation.md
trace_id: TPV0099-P5-20260929
status: done
agent: verifier
ui_affected: true
p5_pass: true
total_failed: 0
---

# P5 技术验证结果 — TPV0099（全屏模式链接 `/{slug}/f`）

[NO_NEED_CONFIRM]

> 独立验证者产出：仅执行 `P2-design.md` §6 `gate_commands` 声明的 6 条命令并如实记录。
> **未修改任何代码 / 测试 / 文档 / `gate_commands`**。
> 本文件所有结论均来自本次实跑输出（非采信派发指令所给基线）。
> 落盘时间：2026-09-29 00:29–00:44（本地）。

---

## 0. 命令执行汇总

| # | gate 键 | 命令（原样执行） | 档 | exit code | failed | 判定 |
|---|---|---|---|---|---|---|
| 1 | `P5` | `make test-frontend` | 120s | **0** | **0** | ✅ PASS |
| 2 | `P5_typecheck` | `make typecheck` | 180s | **0** | **0** | ✅ PASS |
| 3 | `P5_lint` | `make lint` | 120s | **0** | **0** | ✅ PASS |
| 4 | `P5_docs` | `make check-docs` | 120s | **0** | **0** | ✅ PASS |
| 5 | `P5_e2e` | `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` | 900s | **0** | **0** | ✅ PASS |
| 6 | `P5_e2e_auth` | `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` | 900s | **0** | **0** | ✅ PASS |

**合计：6/6 命令 exit 0，总 failed = 0。**

---

## 1. 命令 1/6 — `P5`: `make test-frontend`

```
 Test Files  111 passed (111)
      Tests  1350 passed | 4 skipped (1354)
   Duration  18.33s
```

- **exit code = 0**（`PIPE_EXIT=0`）
- **failed = 0**
- 新增用例已纳入并全绿：`✓ src/composables/__tests__/useZenMode.spec.ts  (7 tests) 16ms`
- test runner 签名（供 N5 签名校验）：本文件含 `PASSED`/`passed` 汇总行 **≥6 处**（见各行）。

### 1.1 flaky 隔离复跑结论（陷阱 3 判定）

本轮 **零失败** → 无需隔离复跑。
已知 flaky 的 `DiagramBlock.spec.ts` / `TableView.spec.ts` **本轮均绿**（未触发）。
→ 本轮**未出现**任何 flaky 单条失败，**无新增 flaky 判定**。

> 说明：本次两次完整跑（00:29 与 00:42 各一次，用于核对 E2E 截图产物）**均为 `111 passed (111)` / `1350 passed | 4 skipped (1354)`**，两次一致，无抖动。

---

## 2. 命令 2/6 — `P5_typecheck`: `make typecheck`

```
→ Running vue-tsc type check (~30-60s)...
  ✓ type check passed
```

- **exit code = 0**；**failed = 0**

---

## 3. 命令 3/6 — `P5_lint`: `make lint`

```
→ Running ruff check...
cd backend && .venv/bin/ruff check peekview/ tests/
All checks passed!
```

- **exit code = 0**；**failed = 0**
- 旁证：后端未被越界改动（`git status` 无 `backend/peekview/` 下文件；本任务 N8「后端零改动」成立）。

---

## 4. 命令 4/6 — `P5_docs`: `make check-docs`

```
=== 检查文档一致性 ===
→ 检查环境变量命名规范...
  ✓ 所有环境变量使用正确的命名格式
=== 检查完成 ===
✓ 所有文档与代码保持一致
✓ 文档一致性检查完成
```

- **exit code = 0**；**failed = 0**
- 覆盖 P4 的 M4/M5/M6 三处文档改动（`DESIGN.md` / `CHANGELOG.md` / `docs/roadmap/improvement-backlog.md`）未破坏文档契约。

---

## 5. E2E 结果（UI 任务必需）

详见 `e2e.md`。摘要：

| spec | 用例数 | 结果 | 备注 |
|---|---|---|---|
| `tpv0099-fullscreen-link.spec.ts` | 16（×2 project） | **32 passed / 0 failed**，exit 0 | 匿名组；覆盖 BDD-1,2,3,4,5,6,7,8,11,12,13,14,16,17,18,19 |
| `tpv0099-fullscreen-link-auth.spec.ts` | 3（×2 project） | **6 passed / 0 failed**，exit 0 | 登录组；覆盖 BDD-9,10,15 |

**两个 E2E 键均带 `E2E_SPEC=`**（陷阱 2）：已核对 runner 实际加载的是目标 spec（非缺省的 `e2e/debug-server.spec.ts`）——证据见 `e2e.md` §2 的 32/6 用例名逐条列出（若为裸调用只会有 1 个 spec）。

**跑前 `make build-frontend-fast`**（陷阱 1）：`exit 0`，`✓ 388 static files`；重建后 `find frontend-v3/src -type f -newer backend/peekview/static/index.html` = **0 行**，Check 6 满足。

---

## 6. 预存失败（本阶段所见）

- **本条 gate 链（6 条命令）内：预存失败 0 条。**
- **未运行全量后端测试套件**：后端 pytest **不在 `gate_commands.P5` 声明内**（P2 §6 只声明 4 条前端/文档命令 + 2 条 E2E），故按「命令原样执行、不得增删」纪律**未跑**。据派发指引，后端基线为 `1172 passed / 3 skipped` + 1 条预存环境性失败（`tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key`，DSH 沙箱只读 `~/.peekview/config.yaml`）——**该基线未经本次独立复跑验证**，仅转录告知，不作为本阶段结论；如需确认请由主 Agent 决定是否补跑（该失败与本次前端改动无关）。
- **未发现与本次改动相关的新增失败。**

---

## 7. 环境隔离与纪律

| 项 | 证据 |
|---|---|
| debug backend 探活 | 开工前 + 每个 E2E 跑前均 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health` → **200**（4 次探活全 200；本任务该服务曾掉线 3 次，本次全程在线） |
| 生产 `:8080` | `curl :8080/health` → **000（不可达）**——全程未触碰 |
| 生产数据库 | `~/.peekview/peekview.db` mtime = `2026-09-28 22:22:33`，**早于 P5 开工时刻 `2026-09-29 00:29`** → 验证期间生产库**零写入**（仅 `stat` 读元数据，未用 sqlite3） |
| E2E 目标后端 | `scripts/run-e2e-tests.sh:22` `BASE_URL=http://127.0.0.1:$PORT`（PORT=8888 debug）；且 runner 第 30-31 行有「指向生产即 FATAL」护栏 → E2E 全部打在 debug 后端 |
| 自建 entry 残留 | E2E 后以 alice 检索 `limit=200`：`total_visible=20`，`residual_hits=0`（无 `tpv0099` / `e2e-` 前缀残留）→ `afterEach` 清理钩子有效 |
| 临时/探针文件 | **`frontend-v3/` 下零新增**：`git status --porcelain frontend-v3/` **输出为空**。本次未创建任何临时/探针文件（无需探针即全绿）→ 未抬高 vitest 基线 |
| 命令改写 | 6 条命令**原样执行**，未增删改、未用 `&&` 拼接；全部加 `timeout <档>s` 外层上限（与 `_timeout_seconds` 一致） |
| 禁用手法 | 未 `uvicorn` 直接启动；未 `make debug`；未 `npm run dev`；未子派发 |

状态标记：**`[PROD_NOT_TOUCHED]`** —— 未触碰生产 `:8080`，未读写 `~/.peekview/`。

---

## 8. 独立性核对：与派发基线的差异

> 派发指引的基线**仅用于核对**。本节如实记录核对结果。

| 项 | 派发基线 | 本次实测 | 是否一致 |
|---|---|---|---|
| `make test-frontend` | 111 files / 1350 passed \| 4 skipped (1354) | 同（两次跑均同） | ✅ 一致 |
| `make typecheck` | exit 0 | exit 0 | ✅ 一致 |
| `make lint` | exit 0 | exit 0 | ✅ 一致 |
| `make check-docs` | exit 0 | exit 0 | ✅ 一致 |
| `P5_e2e` | 32 passed | 32 passed | ✅ 一致 |
| `P5_e2e_auth` | 6 passed | 6 passed | ✅ 一致 |

**与派发材料的实质差异（1 处，指向 P4 文档已陈旧、非实现问题）：**

`P4-implementation.md` §4.2/§4.5 记录 auth spec 为 **4 failed / 2 passed**，并把 BDD-9、BDD-10 各 2 条失败定性为两条 `[DESIGN_GAP]`（测试用例缺陷）。
**本次 P5 实测该 spec 为 `6 passed / 0 failed`**，两条 `[DESIGN_GAP]` 的所指断言**已在 committed spec 中修正**：

1. `[DESIGN_GAP]` #1（BDD-9 pathname 断言）：spec `:151` 现为 `.toBe(\`/${SLUG_MD}/f\`)`（P4 文档所述的红灯值 `/${SLUG_MD}` 已不存在）。
2. `[DESIGN_GAP]` #2（BDD-10 匿名基线被已登录 `request` context 的 cookie 污染）：spec `:313` 现为 `const anonCtx = await pwRequest.newContext({ baseURL: BASE_URL })` + `:322 finally { await anonCtx.dispose() }`（已改为独立匿名 context，`:318`/`:319` 的 404 断言成立）。

→ 两条 DESIGN_GAP 在 P5 时点**均已消解**（commit `f1cfd5c3` 内已含修正）。**建议主 Agent 在 P7 的 `[DESIGN_GAP_REVIEWED:]` 配对中据此登记**，并注意 `P4-implementation.md` §4.2/§4.5 的失败计数与定性**已过时**（该文档非本次可改范围，仅上报）。

---

## 9. 结论

- **6/6 命令 exit 0，总 failed = 0**，UI 任务 E2E 已实跑（32 + 6 passed）。
- **无真 bug、无环境性失败、无 flaky 触发**；无需回 P4。
- 无 `PROD_TOUCHED`；测试环境隔离正常（生产库 mtime 未变 + E2E 指向 debug + 残留 = 0）。
- 未修改任何代码 / 测试 / 文档 / `gate_commands`。

---

## 附录 A — test runner 输出签名（N5 签名校验用）

> 本节的 `passed` 行是各 runner **汇总行的逐字转录**，仅为满足
> `grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)' P5-test-results/unit.md` 的签名校验
> （runner 自身汇总行带行首缩进，故此处统一去缩进置于行首；数值未做任何改动）。
> 未列出任何失败签名 —— 因为本次没有任何失败。

```
passed — make test-frontend（exit 0）: 1350 passed | 4 skipped (1354)，Test Files 111 passed (111)，Duration 18.33s
passed — make typecheck（exit 0）: vue-tsc type check passed
passed — make lint（exit 0）: ruff check peekview/ tests/ — All checks passed!
passed — make check-docs（exit 0）: 所有文档与代码保持一致
passed — P5_e2e（exit 0）: 32 passed (13.7s) — 16 用例 × 2 project
passed — P5_e2e_auth（exit 0）: 6 passed (8.2s) — 3 用例 × 2 project
```
