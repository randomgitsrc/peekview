# tech-debt 条目模板

> 用途：登记协议/项目技术债。文件落 `{AGATE_WORKSPACE}/debt/tech-debt.md`，每条 DEBT = 一个 ` ```yaml ` fenced block（机器校验）+ 可选正文（人读），标题按 id 编号（`## DEBT0001`）。
> 机器校验：`bash {agate_root}/scripts/check-debt.sh {AGATE_WORKSPACE}/debt/tech-debt.md`（schema 校验，exit 0/1）。
> 回退覆盖比对：`bash {agate_root}/scripts/check-debt.sh --retreat-coverage`（git log 的 retreat 提交 vs `source: retreat` 条目，缺失 WARNING）。

## 登记判据（三分法）

登记前回答一句话：**"不修它，当前任务的验收声明会不会变成假的？"**

1. **会** → 登记（债已经威胁到验收真实）
2. **不会，但会让未来变更更贵 / 更危险** → 登记（技术债的本质：未来变更成本）
3. **都不影响**（验收声明不受威胁，未来变更成本不变）→ **不登记**（合法出口，防止登记簿变成垃圾场）

> **硬规则：登记 DEBT 不豁免当前任务。** 记了债 ≠ 当前任务的验收声明可以打折扣——该完成的验收一个都不能少。登记只是承认"有账"，不改变本期必须交付的范围。

## 字段表（schema 校验，缺失/非法即 exit 1）

| 字段 | 必填 | 枚举 / 类型 | 说明 |
|------|------|------------|------|
| `id` | 是 | str，文件内唯一 | 登记簿唯一引用 id |
| `category` | 是 | `technical` / `management` / `protocol` | 债的类型 |
| `title` | 是 | str | 一句话描述 |
| `status` | 是 | `open` / `in_progress` / `closed` | 三态 |
| `priority` | 是 | `high` / `medium` / `low` | 优先级 |
| `evidence` | 是 | 非空 list（`path`/`note`/`ref`） | 债的出处证据（回退债必须引用 retreat 提交哈希） |
| `impact` | 是 | str | 不修的影响 |
| `recommendation` | 是 | str | 建议的处理方向 |
| `closure_criteria` | 是 | 非空 list | 关闭判据 |
| `source` | 是 | `retreat` / `review` / `retrospective` | 债的来源 |
| `created_at` | 是 | str | 登记日期 |
| `task_id` | 否 | str 或 null | 立项任务（`closed` 必填） |

## 三态语义

| status | 含义 | 准入 |
|--------|------|------|
| `open` | 已登记未立项 | 无（`task_id` 非空即视为已立项，属 `in_progress` 语义，schema 不拦截此组合） |
| `in_progress` | 已立项/进行中 | `task_id` 非空即视为 in_progress |
| `closed` | 已关闭 | **必须**含 `task_id` + `evidence` 同时引用该 task_id 与 P5/P6 证据（否则 schema 拦截） |

## 示例条目

### open（未立项）

```yaml
id: DEBT0001
category: technical
title: 模块耦合
status: open
priority: high
evidence:
  - path: docs/reviews/review-20260812-1204.md
impact: 未来变更更贵
recommendation: 拆分模块
closure_criteria:
  - 拆分完成
source: review
created_at: 2026-08-12
```

### closed（须 task_id + P5/P6 证据引用）

```yaml
id: DEBT0002
category: management
title: 验收流程遗留
status: closed
priority: medium
task_id: TAG0003
evidence:
  - path: agate-workspace/tasks/TAG0003-workspace-architecture/P6-acceptance.md
impact: 影响后续验收
recommendation: 补登记
closure_criteria:
  - 验收通过
source: review
created_at: 2026-08-12
```

### 回退强制（source: retreat）

回退落地（`agate-retreat-to.sh`）后**必须**建 `source: retreat` 条目，`evidence` 引用该次回退的 retreat 提交哈希（供 `check-debt.sh --retreat-coverage` 比对）：

```yaml
id: DEBT0003
category: management
title: 回退未建债
status: open
priority: medium
evidence:
  - ref: 023b28b
impact: 回退原因可能复发
recommendation: 补建债条目
closure_criteria:
  - 条目补齐
source: retreat
created_at: 2026-08-12
```

> 注意：示例条目占位（如 `023b28b`）仅为示意，真实条目应填实际 retreat 提交哈希；`{agate_root}` 等占位符会在 CHECK 1 中被 sanitize。

## DEBT0004

```yaml
id: DEBT0004
category: technical
title: 净化正则双实现（后端 purify.py + MCP purify.ts 兜底）可能漂移
status: open
priority: low
evidence:
  - path: agate-workspace/tasks/TPV0092-mcp-get-entry-fetch/P2-design.md
  - note: 净化主实现单点在后端 ?purify=，MCP 兜底仅老后端（不支持 ?purify=）触发；两套正则跨语言（Python/TS）需保持一致
impact: 老后端场景下净化行为可能偏离后端主实现；正则修复需双端同步
recommendation: 净化逻辑以 P3 正则测试为契约锚点，双端共用同一组测试用例；待后端版本统一支持 ?purify= 后评估移除 MCP 兜底
closure_criteria:
  - P3 双端净化测试共用同一数据样例
  - 后端所有支持 ?purify= 后 MCP 兜底路径被标记 deprecated 或移除
source: review
created_at: 2026-08-15
task_id: TPV0092-mcp-get-entry-fetch
```

## DEBT0005

```yaml
id: DEBT0005
category: technical
title: 前端移动端 FileTree e2e 3 例失败（预存，非 TPV0092 引入）
status: closed
priority: medium
evidence:
  - path: agate-workspace/tasks/TPV0092-mcp-get-entry-fetch/P6-evidence/debug-test-mcp.log
  - note: e2e/mcp-server.spec.ts Mobile Chrome 项目 3 例失败（FileTree 渲染），Desktop 全过；CDP 实跑复现；spec 自 v0.7.0 未改
  - note: 2026-08-28 关闭——根因是测试断言未按移动端 Files 抽屉行为编写（spec L146/L238/L280 无条件断言 .file-tree，移动端渲染在抽屉内默认关闭）；hotfix 改为移动端先点 [data-testid=mobile-bar-filetree-btn] 打开抽屉再断言。mcp-server.spec.ts 14 passed（含 Mobile Chrome 3 例）
impact: Mobile Chrome 下 MCP FileTree 相关 e2e 持续失败，掩盖移动端 FileTree 渲染与断言不符
recommendation: 前端任务跟进：核对移动端 .file-tree 渲染行为与 e2e 断言（viewer 布局/抽屉）
closure_criteria:
  - Mobile Chrome FileTree 3 例 e2e 转绿
source: review
created_at: 2026-08-15
task_id: TPV0092-mcp-get-entry-fetch
```

## DEBT0006

```yaml
id: DEBT0006
category: technical
title: backup/restore merge 模式不导入新表/新字段（entry_stars/entry_tombstones/teams/team_members/entries.team_id），恢复旧备份丢失星标/墓碑/团队归属
status: open
priority: medium
evidence:
  - path: agate-workspace/tasks/TPV0093-star-lifecycle/P2-design.md
  - note: _restore_merge（backend/peekview/services/admin_service.py:816-1073）只处理 users/entries/files/shares/reads/stats/apikeys；[SCOPE+] 已裁定为已知限制；replace 模式整体换库不受影响
  - path: docs/design-notes/260903-DEBT0006-restore-merge-scope-drift.md
  - note: 2026-09-03 核实缺口已扩大——entry_stars/entry_tombstones 仍缺失；teams/team_members（TPV0095 新增）完全不在覆盖列表；entries 重建逐字段构造未带 team_id（表恢复但字段被静默清空，比整表缺失更难发现）
impact: merge-restore 恢复功能上线前备份后星标/墓碑/团队归属数据静默丢失；其中 entries.team_id 丢失会使 team-visible 内容退化为"私有且无归属"（访问控制语义错位，性质接近权限问题，非纯数据完整性）；未来备份恢复相关变更更危险
recommendation: 一次性任务增补 _restore_merge 四表（entry_stars/entry_tombstones/teams/team_members）导入 + entries 重建补 team_id（依赖顺序：team 先于引用 entry 导入，旧 ID 走映射转换）+ RestorePreview 计数扩展，并在 P1 基线补恢复星标/墓碑/团队归属（含可见性语义不变）的验收用例
closure_criteria:
  - _restore_merge 导入 entry_stars/entry_tombstones/teams/team_members
  - entries 重建带 team_id，且 team 先于 entry 导入、旧 ID 映射转换
  - RestorePreview 含四表计数
  - 补恢复星标/墓碑/团队归属（含可见性语义不变）的验收用例
source: review
created_at: 2026-08-16
updated_at: 2026-09-03
```

## DEBT0007

```yaml
id: DEBT0007
category: technical
title: debug-server.spec.ts 3 例 auth 相关预存失败（theme toggle / owner tabs / API keys page）
status: open
priority: medium
evidence:
  - note: 2026-08-28 全量 e2e（CDP :18800 + debug :8888）复现。theme-toggle-works 等待 .btn-icon[title*=Switch to] 超时；owner-tabs-visible-when-authenticated 断言 .owner-tab.last() 为 Starred 而非 Mine；apikey-page-loads 等待 .apikey-page 超时。原始代码（stash mcp spec 后）同样失败，与 DEBT0005 hotfix 无关
impact: auth 相关 e2e 在 CDP 模式下持续失败，掩盖登录态/用户菜单/API keys 页面真实回归
recommendation: 排查 CDP 模式下登录 cookie 初始化/隔离（theme/owner-tab/apikey 页面均依赖已登录态）；参考 f6524e69 cookie isolation fix 方向
closure_criteria:
  - debug-server.spec.ts theme toggle / owner tabs / API keys 3 例在 CDP 模式转绿
source: review
created_at: 2026-08-28
```
```
