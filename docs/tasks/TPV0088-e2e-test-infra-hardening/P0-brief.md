---
phase: P0
task_id: TPV0088
task_name: e2e-test-infra-hardening
trace_id: TPV0088
created: 2026-08-07
status: pending
parent: T087（复盘发现）
---

# P0-brief — T088 E2E 测试基础设施加固

## task

修复失效的 `frontend-v3/e2e/viewer.spec.ts`（路由格式过时 + 硬编码 slug 失效，20 用例全部预期失败），并在 `make debug-test` 前置检查中加入 static 产物新鲜度校验（防止前端改动未 `build-frontend` 导致 E2E/验收基于过期产物假通过）。两项均源自 T087 复盘（`docs/reviews/T087-retrospective-20260807.md` 3.1/3.2 节）发现的测试基础设施缺口。

## known_risks

- `viewer.spec.ts` 修复无"现有测试覆盖"兜底：文件本身就是待修的测试，选择器/断言改错会产生假绿（看似通过实则未测到真实行为），需要逐条对着当前真实 DOM 核实（不能只改路由格式就假定通过）
- 部分测试用例（TC-004/005/030/041/042）依赖单文件 entry（用于"隐藏文件树"等断言），需要确认 seed data 中哪个 slug 满足单文件条件，或改为运行时通过 API 创建（同 TC-001 已用的模式）
- static 新鲜度校验加入 `debug-test` 前置检查后，可能影响现有 CI/本地调试流程的执行路径，需验证不误伤正常流程（先 build 后 debug-start 的顺序不能被新检查拦住）
- 两个子任务虽同属"E2E 测试基础设施"，但改动文件不重叠（viewer.spec.ts vs Makefile/scripts），P4 可考虑并行派发

## executor_env

platform: claude-code
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离，含 seed data）；E2E: make debug-test 或 E2E_SPEC=e2e/viewer.spec.ts make debug-test；前端测试 make test-frontend（vitest 非 watch）"
lint: "前端无 lint gate，typecheck 是 CI 强制项：cd frontend-v3 && npx vue-tsc --noEmit"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/；测试只走 debug backend :8888"

## 代码审计结果（P0 输入，已核实）

### 子任务 A：viewer.spec.ts 失效清单

`frontend-v3/e2e/viewer.spec.ts`（20 用例，6 个 describe block）：

| 问题 | 范围 | 证据 |
|------|------|------|
| 路由格式过时 | 全部 20 用例 | 用 `/#/entry/{slug}`（hash 模式），实际路由是 `/{slug}`（history 模式，AGENTS.md 铁律第 7 条已明确） |
| 硬编码 slug 失效 | TC-004/005/030/041/042 用 `lu4prg`；TC-010~013/020~023/040 用 `ngajri` | 当前 `scripts/seed-data/` 无这两个目录，slug 已不存在。当前可用替代（已核实存在）：`python-entry-service`（多文件源码）、`markdown-test`（markdown+TOC）、`mermaid-charts`（含 mermaid） |
| 单文件断言用例的数据依赖 | TC-041（单文件应隐藏 file-sidebar）| 需确认哪个 seed slug 是单文件，或沿用 TC-001 模式运行时建 entry |

**选择器核查结果**（已用 grep 核实，均在当前源码中存在，无需改动）：`.file-sidebar` `.toc-sidebar` `.mobile-actions` `.drawer-left` `.drawer-right` `.entry-card` `.code-header` `.markdown-body` `.toc-nav .toc-item` 全部命中当前组件（EntryDetailContent.vue / EntryCard.vue / TocNav.vue / MarkdownViewer.vue）。**结论：选择器基本未过时，主要工作量在路由格式 + slug 替换 + 逐条实跑验证**，比最初评估的"全面重写"要轻。

### 子任务 B：static 新鲜度校验

现状（`Makefile:553-563` `debug-build`）：只检查 `backend/peekview/static/index.html` **存在**，不检查是否**比源码新**。T087 P4 implementer 改了 `useShiki.ts` 未跑 `make build-frontend`，P5 verifier 用的是过期 static，E2E 基于旧产物"通过"（实际 bug 仍在），额外花时间诊断才发现。

加固点：`Makefile:632` `debug-test` 的 Step 1（`scripts/e2e-safety-check.sh`）前置检查中加入 mtime 比对（`frontend-v3/src/` 最新 mtime vs `backend/peekview/static/index.html` mtime），过期则报错拦截并提示 `make build-frontend`。

## 裁剪倾向

- P1：两个子任务分别列 BDD（A：路由+数据修复后 20 用例应通过；B：故意造过期 static 场景应被拦截，新鲜 static 应放行）
- P2：`follows_existing_pattern`，均为对现有机制的修正，非新功能，可单候选方案
- P3：子任务 B（shell 脚本逻辑）建议保留最小 TDD（新鲜/过期两种输入的行为断言）；子任务 A 是测试代码本身，不适用传统 TDD，改为"P6 逐条实跑"作为验收锚点
- P6：不可裁剪——子任务 A 必须让 20 条用例在 debug backend 上逐条实跑通过（非抽样）；子任务 B 必须实测"过期 static 场景被拦截 + 新鲜场景放行"两种情况
- 风险：low-medium（无后端改动、无 schema、无权限边界；风险集中在"测试代码改错导致假绿"和"新检查误伤正常调试流程"两点，P6 需针对性验证）

## 排期

T088（本任务）：独立于 T086，无依赖，可随时启动。
