---
phase: P8
task_id: TPV0094-treeview-default-expand
type: release
parent: P7-consistency.md
trace_id: TPV0094-P8-20260815
status: draft
created: 2026-08-15
agent: implementer
---

# P8 发布准备 — TPV0094 TreeView 默认展开优化

> 状态标记：`[PROD_NOT_TOUCHED]`（只读 + 产出文件，未执行 git commit/tag/bump-version，未触碰 :8080 / ~/.peekview/）
> 本文件为 releaser→主 Agent 交接记录，**所有版本变更动作（bump-version + CHANGELOG + commit + tag）由主 Agent gate 通过后亲自执行**。

## 发布判定

- **bump_type**: `minor`
- **受影响包**: `peekview`（VERSIONS.json 唯一版本源）。期望版本变更 **0.18.6 → 0.19.0**
- **MCP 包** `@peekview/mcp-server`（VERSIONS.json `mcp_server: 0.10.0`）**不 bump**（本任务纯前端，MCP 零改动，P2 §1「不改什么：后端 / API / MCP」）
- **判定理由**：新增用户可见功能（TreeView 默认全展开 + 超阈值折叠降级 + 折叠提示 banner），非 bug 修复、非破坏性变更 → minor

## packages 声明（P2 §packages）

| P2 声明 | 实际落地 | 是否随版本发布 |
|---------|----------|----------------|
| `frontend-v3/src/components/TreeView.vue` | 已实现（默认全展开 + 阈值降级 + banner） | ✓ 发布产物 |
| `frontend-v3/src/components/__tests__/TreeView.spec.ts` | 已更新（11 新增 + 4 更新，spec 实计 17 it） | 测试，随源码 |
| `frontend-v3/e2e/structured-data-viewer.spec.ts` | 已更新（BDD-1~7 新增 + 27/28 更新） | 测试，随源码 |
| `frontend-v3/scripts/measure-treeview-perf.ts` | **未创建**（P7 §2 [DEVIATION] 非核心）；红线实测由 `P6-evidence/scripts/p6-redline-bench.ts` 承担 | 不发布（工具，已随任务记录归档） |

> [SCOPE_GAP] 检查：P2 packages 未含 mcp-server，与派发 prompt 一致，无遗漏。

## 版本变更确认

- 当前 `VERSIONS.json`：`peekview: 0.18.6`，`mcp_server: 0.10.0`
- **期望变更**：`peekview` 0.18.6 → **0.19.0**（主 Agent 执行 `make bump-version NEW_VERSION=0.19.0`）
- `mcp_server` 0.10.0 **保持不变**（本任务不触碰 MCP）
- **注意**：`make bump-version` 会同步 `scripts/sync_versions.py` 到所有文件（含 `backend/peekview/__init__.py`、`package.json`、frontend 等），版本源为 VERSIONS.json

## CHANGELOG 更新确认

当前 `CHANGELOG.md` 的 `[Unreleased]` 区域为**空**（模板状态，未含 TPV0094 条目）。bump 后主 Agent 需：

1. 在 `[Unreleased]` 下新增 TPV0094 条目，建议内容（新增节）：

```markdown
## [Unreleased]

### 新增

- 结构数据查看器 TreeView 默认全展开：节点总数 ≤ 2000 时自动展开所有含子节点路径，超阈值自动折叠根并显示折叠提示 banner（`data-testid="tree-collapse-banner"`），大文件首屏渲染防撑爆 DOM；阈值经红线实测（100~5000 节点，500ms 预算）定为 2000，导出常量 `DEFAULT_EXPAND_THRESHOLD` (TPV0094)
```

2. 将 `[Unreleased]` 移到 `[0.19.0] - 2026-08-15` 下
3. `git add CHANGELOG.md && git commit --amend --no-edit`（bump 后按 AGENTS.md 发布流程）

> P8 gate 要求「暂存区 CHANGELOG 有变更」——上述更新由主 Agent 执行后应入同一 commit。

## debt_check

`debt_check: none`

核对记录：`agate-workspace/debt/tech-debt.md` 存在，但仅含登记模板 + 示例条目（DEBT0001-0003 为 schema 示例占位，非真实债务）。**无已登记的真实开放债务条目**，本任务亦未触发新债务登记（无 retreat/review/retrospective 来源新增）。无关注项，不阻断发布。

## 红线阈值复核（P7 §7）

| 量级 | 实测渲染耗时 | ≤500ms 预算 | 判定 |
|------|-------------|------------|------|
| 100 | 45.8ms | ✓ | 满足 |
| 500 | 141.9ms | ✓ | 满足 |
| 1000 | 206.5ms | ✓ | 满足 |
| 2000 | 297.2ms | ✓ | 满足 |
| 5000 | 787.7ms | ✗ | 超预算 → 降档取 2000 |

阈值保持 2000 与 `DEFAULT_EXPAND_THRESHOLD = 2000`（TreeView.vue:49）一致，无需回 P4 改常量（P7 §7 确认）。

## 临时资源清单（releaser→主 Agent 交接，READY 收尾清理用）

| 资源 | 类型 | 状态 | 清理动作 |
|------|------|------|----------|
| debug backend :8888（uvicorn，PID 2095744） | 进程 | **仍在运行** | `make debug-stop`（停止 + 清理 /tmp/peekview-debug/） |
| `/tmp/peekview-debug/`（peekview.db + data/） | 临时数据 | 存在 | `make debug-stop` 清理 |
| P6 fixture entries（t094-large / t094-small 等，经 debug API :8888 创建） | 临时数据 | 存于 debug DB | 随 debug DB 清理 |
| `/tmp/create-p6-fixtures.py` | 临时脚本 | 存在 | 删除 |
| `/tmp/measure-treeview-perf.ts` | 临时脚本 | **不存在**（P7 §2：P2 声明的正式 perf 脚本未落地） | 无 |
| `P6-evidence/scripts/p6-redline-bench.ts` + `p6-verify-bdd1-7.ts` | 工具脚本 | 已随任务记录归档 | 保留（不清理） |
| Chrome CDP :18800 | 外部常驻服务 | 不属于本任务启动 | **不清理**（注明：外部常驻，非本任务范围） |

> 另注：P7 §10 提到 working tree 曾有 4 个非本任务 dirty 文件（`static/index.html` + 3 个 zip 产物），本次 git status 已确认全部干净（仅剩未追踪的 P8-dispatch-context 文件），无需处理。

## 发布检查命令（主 Agent gate 需亲自执行）

从 P2 §5 gate_commands 提取：

```bash
make test-frontend && make typecheck          # P5 gate 重跑（bump 后确认全绿）
make debug-quick && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test   # 可选：本 spec E2E
git log v0.18.6..HEAD --oneline               # 对照 CHANGELOG 无遗漏
```

## Lessons Learned

| 类别 | 教训 | 来源任务 | 日期 |
|------|------|----------|------|
| 流程 | P2 声明的工具文件（measure-treeview-perf.ts）可在 P6 阶段被主 Agent 派发时重定向落地位置（P6-evidence/scripts/），形成非核心 DEVIATION；阈值实测目标（BDD-8）达成与否与脚本位置解耦 | TPV0094 | 2026-08-15 |
| 测试 | 红线实测用平铺 fixture（单根+N-1 叶子）专供计时、深层分支 fixture 专供 BDD-3/4 点击交互，两类 fixture 分离可避免「单次点击渲染 N 节点超时」协议悬挂 | TPV0094 | 2026-08-15 |
| 流程 | 阈值常量先定安全下界（2000），经 P6 红线实测（5000 超 500ms 预算）确认保持 2000，避免过度调优 | TPV0094 | 2026-08-15 |
