---
phase: P8
task_id: T086-admin-settings-consolidation
type: release
parent: P7-consistency.md
trace_id: T086-P8-20260807
status: draft
created: 2026-08-07
agent: implementer
---

# P8 — 发布准备

## bump_type

```yaml
bump_type: minor
```

**理由（复核 dispatch-context 建议，认同 minor）**：

- T086 新增了此前完全无 UI 入口、只能手敲 URL 访问的 `/admin` 页面的可发现入口——`/settings` 新增"用户管理"tab + UserMenu 新增管理员入口。这是**新增用户可见功能、向后兼容**，符合语义化版本 minor 的定义。
- `/admin` 独立路由被删除，改为一律落 404，属于路由层面的变更。但根据 P1-requirements.md 待确认清单与 P2-design.md 影响域分析，该路由此前**没有任何 UI 入口**（导航菜单、按钮均未链接到 `/admin`），只有手敲 URL 才能访问，因此实际用户影响面接近零，不构成需要 major 的破坏性公共契约变更。
- 本任务后端 API 零改动（P2-design.md §5 `domains: [frontend]`，`packages: [peekview]`），无需按后端契约变更评估 major。
- 项目先例支持：`CHANGELOG.md` 中 0.17.0（T080，同样是 admin 相关新增，含一处标记为"破坏性"的行为变更）也走的是 minor，而非 major，本任务性质与之一致（甚至风险更低，因为 T080 的破坏性变更是后端 API 语义变更，T086 只是删除一个从未暴露给普通用户的路由）。

## 版本号变更确认

| 包 | 旧版本 | 新版本 | version 文件路径 |
|---|---|---|---|
| peekview | 0.17.1 | 0.18.0 | `VERSIONS.json`（本 subagent 未手工修改，待主 Agent 执行 `make bump-version NEW_VERSION=0.18.0` 后同步到所有文件） |

`mcp_server` 不涉及本任务（P2-design.md §5 packages 声明仅 `[peekview]`），版本保持 `0.10.0` 不变，无需 bump。

## CHANGELOG.md 变更确认

`[Unreleased]` 区域已改写为 `## [0.18.0] - 2026-08-07` 版本号区块，内容：

- **新增**：`/settings` 新增"用户管理"tab（管理员可见，整合原 `/admin` 独立页面全部功能：用户列表分页/禁用启用/角色升降级/重置密码/删除）；UserMenu 新增管理员可发现入口
- **变更**（破坏性标记）：`/admin` 独立路由已删除，不再重定向，直接落 404（原路由无 UI 入口，仅限手敲 URL 访问的用户受影响）

`git diff --stat CHANGELOG.md` 确认：`CHANGELOG.md | 11 +++++++++++`，1 file changed, 11 insertions(+)。

**未暂存**——本 subagent 仅编辑工作区文件，未执行 `git add`。暂存/commit 由主 Agent 在 gate 验证通过后与 `bump-version` 一并处理。

## 发布检查命令（供主 Agent 执行，本 subagent 不执行）

```yaml
packages:
  peekview:
    check_command: "make pre-publish-quick"   # 不 rebuild 的快速检查
    note: "对应 P2-design.md §5 gate_commands 惯例（本包 P5=make test-frontend, P6_typecheck=make typecheck 已在 P5/P6 阶段跑过，此处 pre-publish-quick 是发布前的最终一遍快照检查）"
  mcp_server:
    check_command: null
    note: "本任务不涉及，P2-design.md §5 packages 声明仅 [peekview]，无需处理"
```

## 临时资源清单（供主 Agent READY 收尾清理）

- **调试服务/进程**：`/tmp/peekview-debug/` debug backend（`:8888`）——P5/P6 阶段使用，各轮 verifier 完成后已执行 `make debug-stop` 清理；本次 P8 阶段（仅编辑 CHANGELOG.md，纯文档操作）未启动任何新的调试服务或进程。
- **临时数据**：无新增。P5/P6 阶段的测试数据随 `make debug-stop` 一并清理，未见残留。
- **开发安装**：无。本任务全程未执行 `pip install -e .`、`npm link` 等开发安装操作。
- **PROD 触碰标记**：`[PROD_NOT_TOUCHED]`——P5/P6 verifier 均已确认，P8 阶段（CHANGELOG 文档编辑）同样未触碰 `:8080` 或 `~/.peekview/`。

## Lessons Learned

| 类别 | 教训 | 来源任务 | 日期 |
|---|---|---|---|
| 流程 | P4→P5 出现过一次真实的跨阶段回退（PAUSED）：P5 全量重跑发现 `/admin` 路由拦截 404 存在 bug（c331620a "P5 全量重跑证实路由修复 + PAUSED 跨阶段回退到 P3"），说明"P4 design-review approved"不等于"P5 验证会过"——回退机制本身工作正常，验证了 agate P5 不信任 P4 自报的设计初衷是必要的，不是过度设计。 |
| 测试 | BDD-11（UserMenu 管理员入口）在 P3 阶段测试代码本身有选择器 scope 缺陷，需要一次专门的修复迭代（5658ea76 "修复 BDD-11 选择器 scope 缺陷"）——TDD 红灯阶段的测试代码本身也需要像生产代码一样被审查，红灯≠测试正确，红灯只证明"当前没通过"，不证明"测试断言本身没写错"。 |
| 架构 | 发现了一个 agate 框架级 hook bug（详见任务目录下 `hook-bug-plan.md`/`hook-bug-plan.html`）——这类框架级问题应当独立于业务任务归档，避免和 T086 本身的验收结论混在一起，导致复盘时难以区分"业务代码问题"和"工作流工具问题"。 |
| 架构 | `/admin` 独立路由整合进 `/settings` tab 后，判定"是否 breaking change"不能只看路由删除这一动作本身，还要核查该路由在改动前是否已有 UI 曝光面——P2-design.md 影响域分析和 BDD-8/9/10（一律 404）的验收设计提前锁定了这个判断依据，使得 P8 阶段 bump_type 判定不需要重新调研，直接可复用 P1/P2 阶段已沉淀的结论。 |

## 主 Agent 后续动作（不由本 subagent 执行）

1. `git add CHANGELOG.md`（以及 `bump-version` 产生的 `VERSIONS.json` 等同步文件）
2. `make bump-version NEW_VERSION=0.18.0`
3. 逐包跑发布检查命令：`make pre-publish-quick`（peekview），确认 exit 0
4. 重跑 P5 gate（`make test-frontend` + `make typecheck`）确认仍全绿
5. `git log v0.17.1..HEAD --oneline` 对照 CHANGELOG 无遗漏
6. commit + tag（同一 commit）
7. READY 收尾检查（参考本文件「临时资源清单」）
