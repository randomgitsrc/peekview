# tech-debt 条目模板

> 用途：登记协议/项目技术债。文件落 `{AGATE_WORKSPACE}/debt/tech-debt.md`，每条 DEBT = 一个 ` ```yaml ` fenced block（机器校验）+ 可选正文（人读），标题按 id 编号（`## DEBT0001`）。
> 机器校验：`FILE={AGATE_WORKSPACE}/debt/tech-debt.md python3 {agate_root}/scripts/agate-debt-check.py`（schema 校验，无输出即通过；exit 0）。
> 回退覆盖比对：`python3 {agate_root}/scripts/agate-debt-check.py --covered-hashes FILE`（git log 的 retreat 提交 vs `source: retreat` 条目，缺失 WARNING）。

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
title: debug-server.spec.ts 用例在 CDP 模式下大面积预存失败（实测 18 例，登记时仅 3 例）——本地 E2E 信号失真
status: in_progress
priority: high
task_id: TPV0097-e2e-sharding-ci
evidence:
  - note: 2026-08-28 首次登记 3 例（theme toggle / owner tabs / API keys page，CDP :18800 + debug :8888）
  - note: 2026-09-14 复测扩大——`E2E_SPEC=e2e/debug-server.spec.ts make debug-test`（未改任何代码）18 failed / 34 passed，9 个用例 × chromium+Mobile Chrome 双 project 全红，耗时 4.0m。失败面覆盖 Theme/Mobile/All-Mine Tabs/API Keys 四组
impact: CDP 模式下 18 例（chrome+Mobile 双 project）长期红，掩盖登录态/用户菜单/API keys/移动端布局的真实回归；`run-e2e-tests.sh` 在本机检测到 CDP 即走该路径，故本地验证信号长期失真
recommendation: 先判定 18 例属「CDP 专属」还是「环境无关」（CI runner 无 CDP、走本地 Chromium）——若 CDP 专属则修 CDP 下登录 cookie 初始化/隔离（参考 f6524e69 cookie isolation fix 方向）并给 CI 侧 skip 理由；若环境无关则必须先修才能上线 CI E2E job。已并入 TPV0097「用例可信治理」子目标
closure_criteria:
  - debug-server.spec.ts 全量用例在判定适用环境下全绿（或对 CDP 专属失败正式 skip + 原因）
  - 明确记录 18 例的 CDP 归属判定结论（CDP 专属 / 环境无关）
source: review
created_at: 2026-08-28
updated_at: 2026-09-14
```

## DEBT0008

```yaml
id: DEBT0008
category: technical
title: agate BDD 只有正向路径，无「测试副作用/环境还原」gate——E2E 创建团队无清理导致残留污染 debug DB
status: open
priority: high
evidence:
  - note: TPV0095 交付后用户质疑 bob 能添加 dave（与 owner-only 权限模型矛盾）。后端实测验证权限逻辑正确（bob POST /api/v1/teams/frontend-team/members → 404）；真凶是 teams-page.spec.ts 无 afterEach 清理，多次跑 E2E 在 debug DB 残留 18 个 Alpha-*/Del-*/T-* 团队，bob 因残留成为自有团队的 owner，才"能添加 dave"。P6 验收 44 BDD 全 PASS 时无污染（残留是验收之后连续跑 E2E 累积的）——"测试是否弄脏环境"不在任何 gate 覆盖内
impact: 残留数据污染后的行为与权限模型矛盾（用户视角像权限 bug）；后续任何"清理"或"统计"类功能会在脏数据上验证；测试与原始环境难再区分
recommendation: agate 协议在 P6/CI 增加"测试后环境还原"检查（E2E 运行后 DB 条目数/团队数快照比对，或要求 spec 自带 fixture 清理钩子）；本仓至少把 E2E fixture 清理（afterEach 删除队列）固化为团队类 spec 模板
closure_criteria:
  - teams-page.spec.ts（及后续创建型 E2E）均带 afterEach 清理队列（已落地）
  - agate 侧有 post-test env 残留检查机制或协议规范
source: retrospective
created_at: 2026-09-03
```

## DEBT0009

```yaml
id: DEBT0009
category: management
title: P1 排除「seed 带 team」却无替代验收——BDD 只验 P3 fixture，人工体验路径（make debug-seed + Teams tab）存在真空带
status: open
priority: medium
evidence:
  - note: TPV0095 P1-requirements.md 记录"样例 seed 数据不纳入本次改动（team fixture 由 P3 自建）"——条目本身合规（样例 seed 确非生产路径），但 44 条 BDD 全用 P3 自建 fixture 验收，无一条验证"make debug-seed 后 explore Teams tab 应有内容"，导致用户 seed 后打开 Teams tab 看到 No entries found。P1 对"人工体验路径"无替代验收要求
impact: 自动化验收全绿 ≠ 用户按文档体验正确；凡涉及 debug-seed/演示数据的功能，"seed 后页面应有内容"成隐性验收项，靠用户肉眼发现
recommendation: P1 模板加"人工体验验收"节：凡改动涉及用户可见页面且 seed/演示数据影响其内容，强制补 1 条"Given seed 数据 When 打开 X 页 Then 有内容"的 BDD（或用 fixture 等价物）；本仓将 seed team + team entry（已落地 32e952da）设为 debug-seed 标配
closure_criteria:
  - debug-seed 含 team + team entry（已落地）
  - P1 dispatch-context 模板含"人工体验路径"验收要求
source: retrospective
created_at: 2026-09-03
```
```

## DEBT0010

```yaml
id: DEBT0010
category: management
title: E2E 渲染类 spec（mermaid/mermaid-check/mermaid-visual）依赖已消失的老 seed entry——长期红灯掩盖真回归
status: closed
priority: medium
task_id: TPV0096-e2e-fixture-selfcontained
evidence:
  - note: 2026-09-05 定位「裸 SVG 渲染吞章节」回归排查时发现：mermaid.spec（test-mermaid-2）、mermaid-check.spec（playwright-test）、mermaid-visual.spec（e2e-test）依赖的 seed entry 全部 404（不在现行 seed-data/ 中），这批 spec 在任何代码状态下都失败（stash 修复前后失败集合不变、t084 两态同为 7 failed）。红灯常态化 = 真回归被淹没，E2E 信号失真
  - path: agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P5-progress.md
  - path: agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P6-acceptance.md
  - note: 由 TPV0096-e2e-fixture-selfcontained 关闭——3 spec 改自建 entry（e2e- 前缀 + afterEach 清理 + 防生产护栏），P5 五键全量重跑 5/5 绿、P6.5 judge 13/13，干净 debug 环境 14 用例双 project 全绿且可重复
impact: 渲染类 E2E 约 30+ 用例永久红，任何回归排查都要先做 stash 基线对照才能定性；CI 若接入 E2E 将直接堵死
recommendation: 二选一：①恢复/重造这批 spec 依赖的 seed fixture（test-mermaid-2/playwright-test/e2e-test 进 seed-data/）②重写 spec 用自建 entry（参照 render-regression.spec 的 createEntry 模式 + afterEach 清理）。同时把「spec 依赖的 entry 必须存在或自建」写进 E2E 编写规范
closure_criteria:
  - mermaid/mermaid-check/mermaid-visual 三 spec 在干净 debug 环境全绿（或正式标记 skip + 原因）
source: retrospective
created_at: 2026-09-05
```

## DEBT0011

```yaml
id: DEBT0011
category: technical
title: t022-diagram-refactor / verify-mermaid 两个 spec 同型缺陷（死 goto + 死选择器 + 消失 fixture）——TPV0096 P1 同类扫描延后项
status: in_progress
priority: medium
task_id: TPV0097-e2e-sharding-ci
evidence:
  - note: TPV0096 P1 同类扫描实证（P1 §4）：t022-diagram-refactor.spec.ts 7 test 全部 goto /entries/test-mermaid-2 等（均不在 seed）+ 死选择器 .mermaid-action-btn/.toolbar-btn；verify-mermaid.spec.ts goto /entries/test-mermaid-2-2（不存在）。主 Agent 采纳 SUGGEST-4 延后单独立项（超出 DEBT0010 closure criteria 三 spec 范围，避免扩大验收面）
  - note: 2026-09-14 复核确认死路由（静态证据）——`frontend-v3/src/router.ts` 无 `/entries` 路径，页面路由仅 `/:slug`（AGENTS 铁律 7），故两 spec 的 `goto('.../entries/...')` 在任何环境必 404
impact: 两 spec 在干净环境永久红灯，与 DEBT0010 同型信号失真；t022 家族 7 用例无法提供回归信号
recommendation: 按 TPV0096 同方案处理（自建 entry + afterEach 清理 + goto /:slug + 选择器迁移 .mermaid-action-btn→.diagram-action-btn）；已并入 TPV0097「用例可信治理」子目标
closure_criteria:
  - t022-diagram-refactor.spec.ts 与 verify-mermaid.spec.ts 在干净 debug 环境全绿或正式 skip + 原因
source: retrospective
created_at: 2026-09-07
updated_at: 2026-09-14
```

## DEBT0012

```yaml
id: DEBT0012
category: technical
title: debug seed 基建预存缺陷——seed-debug.py 团队创建先于成员添加缺重试，偶发 422 致部分 seed entry 未入库
status: in_progress
priority: medium
task_id: TPV0097-e2e-sharding-ci
evidence:
  - note: TPV0096 P6 验收与 P6.5 judge 复核两次独立观察到 make debug-seed 输出 HTTP 422（team_id 时序），3 条 seed entry 未入库（DB 全表真值证实非清理误删）；TPV0096 自建 fixture 不依赖该批 entry 故不影响本任务验收，但任何依赖全量 seed 的 E2E/人工体验会偶发缺数据
  - note: 2026-09-14 复测量化（比原登记更严重）——`make debug-seed` 后 DB 真值 entries=20 而 seed-data 有 24 条（缺 4 条）、teams=2 但 team_members 仅 1 行（frontend-team 应含 alice+bob、backend-solo 应含 carol，即 ≥3）、服务日志 3× HTTP 422
impact: 依赖 seed 完整性的验证路径缺 4 条 entry + 团队归属大面积缺失（随机性，重跑可能部分恢复）；干扰"seed 24 条全可访问"类断言；CI 侧表现为随机数据缺失，比本地更隐蔽（无人工观察）
recommendation: seed 脚本团队创建后同步等待/重试成员添加，或捕获 422 重试；改动点 scripts/seed-debug.py。已并入 TPV0097「用例可信治理」子目标
closure_criteria:
  - 连续 10 次 make debug-seed 零 422，seed 后 DB 全表 24 条稳定且 team_members ≥3
source: retrospective
created_at: 2026-09-07
updated_at: 2026-09-28
```

> **主 Agent 更正与补记（2026-09-28，TPV0099 P2 期实核）**——原始定性"**偶发** 422"实测**不成立**，应改为**确定性缺陷**；并补记四条新事实：
>
> 1. **不是偶发，是确定性时序缺陷**：`seed-debug.py` 先建 entry（L173）后建 team（L264），而 `entry_service._resolve_team_for_user` 对**不存在**的 team 抛 422 → **全新 DB 首次 seed 时，3 条带 `team_id` 的 entry（`csv-employees`/`markdown-test`/`mermaid-charts`）必定失败**；**重跑一次即恢复**（team 已存在）。已在**全新实例**（:8889）**双跑复现**：首跑 3×422 + `total=19` → 重跑无错 + `total=22`；TPV0099 期 debug 重启后**再次双跑复现**同一模式。
> 2. **`make debug-seed` 默认 `tail -10` 截断掉了 FAIL 行** → **用 Makefile 跑看不到失败**。这是该缺陷长期被当作"偶发/随机"的直接原因（失败被输出截断掩盖）。需完整输出请直接 `python3 scripts/seed-debug.py http://127.0.0.1:8888`。
> 3. **带 `team_id` 的 entry 匿名不可达（即使 `is_public: true`）**：`markdown-test`/`mermaid-charts`/`csv-employees` 均 `is_public: true` 但带 `team_id` → **匿名 404**（owner/admin 可读）。此**不是**本条 seed 时序问题，而是 TPV0095（`59182590`）给 seed entry 指派团队后引入的**可见性语义变更**。
> 4. **由上条衍生、但根因不同（不并入本条）**：`frontend-v3/e2e/viewer.spec.ts` 因此**预存红灯 18 failed / 20 passed**（其 `openMarkdownFile` 依赖 `markdown-test`）。证据链：`git log -S'"team_id": "frontend-team"' -- scripts/seed-data/markdown-test/meta.json` 唯一命中 `59182590`（TPV0095，2026-09-03）；`viewer.spec.ts` 最后一次全绿 = `d4b05ee4`（TPV0088，2026-08-12）；`git merge-base --is-ancestor d4b05ee4 59182590` = 真 → **TPV0095 是回归成因**。归属 **TPV0097/TPV0098「用例可信治理」**（E2E 用例与 seed 语义脱节）——本条是"入库失败、重跑可恢复"，前者是"数据完好但可见性变了、重跑不恢复"，**根因与修复面均不同，勿混同**。此处仅作指引，**勿据此关账 DEBT0012**。
>
> **对 `closure_criteria` 的影响**：第 1 条（连续 10 次零 422）**仍有效**；但"零 422"须在**全新 DB** 上验证才有意义（重跑本就无 422）。

## DEBT0013

```yaml
id: DEBT0013
category: technical
title: zen 隐藏集不含 archived/expired banner，使"全屏视图只剩纯内容"的产品承诺在归档/过期 entry 上不成立
status: open
priority: low
task_id: TPV0099-fullscreen-link
evidence:
  - path: agate-workspace/tasks/TPV0099-fullscreen-link/P2-design.md
    note: §1.3 R-04 与 §4 V7 结果 C——实测 archived entry（legacy-deploy，需 alice 登录，匿名 404）在 zen 态下 .archived-banner 仍为 1280×49、top=0 的满宽横条，且不在 BDD-3 的 A/B 排除集内、不在 zen 隐藏集内；该范围内可聚焦控件实测为 ["Reactivate"]
  - path: frontend-v3/src/styles/layout.css
    note: :208 与 :649-654 的 zen 隐藏规则（8 项规则 + 2 处 v-show 兜底）均不含 .archived-banner / .expired-warning-banner；二者唯一定义处为 frontend-v3/src/components/EntryDetailBanners.vue
  - path: agate-workspace/tasks/TPV0099-fullscreen-link/P1-requirements.md
    note: §4.2 补登行（:359）已把二者登入 zen 隐藏集清单，但同文件 :403（§5）又确认 legacy-deploy 确在 debug DB 中且 status=archived——P1 内部自相矛盾，P2 已以 [P1_CORRIGENDUM] 就地更正（未改 P1 文件）
impact: 经 /{slug}/f 分享的 archived/expired entry 顶部残留 49px 满宽横条且含可聚焦控件，与全屏视图"只剩纯内容"目标冲突；TPV0099 以"验证侧钉定非归档 seed（BDD-1/2/3 用 dsh-architecture）"规避，故不影响本次验收，但产品缺口留存——未来任何依赖"zen 态无 chrome"的断言（含 BDD-3 的 A/B 排除集与"内容区外可聚焦元素为 0"）都会再次踩到
recommendation: 在 EntryDetailView.vue 的 scoped zen 块为 .archived-banner / .expired-warning-banner 补 display:none（约 +2 行），并同步评估锁死态是否需保留 Reactivate 入口（P0 决策②"完全锁死"与可操作性存在张力）；改动面小但需独立验收（涉及 BDD-3 排除集与可聚焦元素清单，可参考 TPV0099 的 BDD-3 三态负向对照方法防恒真）
closure_criteria:
  - zen 态下 archived/expired entry 的 .archived-banner / .expired-warning-banner 均 display:none 且 bounding box 高度为 0
  - BDD-3 的 A/B 排除集判据与"内容区外可聚焦元素为 0"断言在归档 entry 上同样成立
  - 补入至少 1 条 E2E 断言覆盖 archived entry 的 zen 态无满宽横条（含三态负向对照，防恒真）
source: review
created_at: 2026-09-28
```

> **编号说明（主 Agent，2026-09-28）**：eng-review 建议用 `DEBT0014`，理由是"避开 `DEBT0013`"——但**本项目登记簿**实测最高为 `DEBT0012`、`DEBT0013`/`DEBT0014` 均 0 命中；`DEBT0013` 被占用的说法来自 **agate 协议层**（`~/.agate/v0.76.0/agate/rules/phases.yaml` 的 P8 时序注意），属**另一套登记簿**。主 Agent 采**本项目登记簿的连续性**（自增到 `DEBT0013`），理由：登记簿 id 的唯一边界是**同一文件内唯一**（`agate-debt-check.py` 的校验口径），为跨登记簿错开编号会让本项目编号出现**无解释的空洞**，反而降低可读性。若并置阅读时确有歧义，在两处各加一行来源标注即可。

## DEBT0014

```yaml
id: DEBT0014
category: protocol
title: agate 内置 vitest formatter 用环境变量传全量测试输出，超 MAX_ARG_STRLEN 致 formatter exit 126 → check-tdd-red.py 误判 A 类假红灯（CI 会误判 P3 FAIL）
status: open
priority: high
task_id: TPV0099-fullscreen-link
evidence:
  - path: /home/kity/.agate/v0.76.0/agate/assets/formatters/vitest.sh
    note: "第 6-8 行 `OUTPUT=\"$(cat)\"; export EXIT_CODE OUTPUT` 把整份测试输出经**环境变量**传给 python3；本仓前端全量输出 1,509,095 字节，11.5× 超 MAX_ARG_STRLEN=131072 → `/usr/bin/python3: 参数列表过长`，formatter exit 126（TPV0099 P3 实测复现）"
  - path: agate-workspace/tasks/TPV0099-fullscreen-link/P3-test-cases.md
    note: "§5.4 载有完整根因链与预存性证明；任务级 formatter 落在 `$task_dir/.agate/formatters/vitest.sh`（agate 官方扩展点，判定语义逐字等价、仅改输出传递方式）"
  - note: "预存性证明（主 Agent 独立复现）——**移出 TPV0099 全部 3 个 spec 后**跑全量 npx vitest run 输出 1,509,095 字节、含 15 处 matching（来自既有 spec 的 No diagram type detected matching given configuration）；把该真实输出直接喂内置 formatter → exit 126，与含本任务 spec 时完全一致 ⇒ 与本任务测试代码无关"
  - note: "误判路径——formatter 失败后 run_test_with_formatter 回退 _fallback_json(raw_output=全量)，check-tdd-red.py:110-121 的 exit_code==2 且 failed==0 且正则含 matching 的分支命中 → 误判 A 类 exit 1"
impact: "①本仓另有 4 个任务声明 P3_formatter vitest.sh（T081/T084/T086/T087，其中 T084/T087 仍为 READY，会实际命中）②**CI backstop 同源中招**——ci-gate-backstop.py:181-183 对 tdd_exit==1 判 FAIL（假红灯），故本仓任何前端任务的 P3 在 CI 上都会被误判 FAIL ③主 Agent 排查期间 check-tdd-red.py 首轮即返回 exit 1（假红灯），若不追根因会误退回 P3 改测试（错误方向）"
recommendation: "上游修 agate 内置 assets/formatters/vitest.sh——把输出经临时文件而非环境变量传递（TMP=$(mktemp); cat > \"$TMP\"; python3 - \"$TMP\"），判定语义不变；这与 TPV0099 任务级 formatter 的改法逐字一致，可直接采用。项目侧临时缓解：受影响任务各自补 $task_dir/.agate/formatters/vitest.sh"
closure_criteria:
  - 内置 assets/formatters/vitest.sh 改为经临时文件传输出；以 ≥1.5MB 输入实测 exit 0 且 JSON 可解析
  - check-tdd-red.py 在本仓前端全量输出上返回语义正确的 exit（真红灯 0 / 绿灯 2），不再误判 A 类
  - CI backstop P3 分支在本仓前端任务上不再因该缺陷判 FAIL
source: review
created_at: 2026-09-28
```

> **登记理由（主 Agent，2026-09-28）**：命中登记判据 2——"不修会让未来变更更贵/更危险"。它**已实际威胁 CI 判定**（非假设：`ci-gate-backstop.py` 会把假红灯判成 FAIL），且影响 4 个既有任务 + 未来所有前端任务。**性质**：`category: protocol`（缺陷在 agate 协议层内置脚本，非本项目代码）。**不在 TPV0099 修复**（修复点是协议层 `~/.agate/**` 属 agate 上游；本项目仅以任务级 formatter 规避）。主 Agent 未改协议本体。

## DEBT0015

```yaml
id: DEBT0015
category: protocol
title: check-scope-resolved.py 对粗体包裹的行首 SCOPE+ 不可见致真空早退；且 check-gate.py 不调用它 → P7 gate 通过 ≠ SCOPE+ 被校验过
status: open
priority: medium
task_id: TPV0099-fullscreen-link
evidence:
  - path: /home/kity/.agate/v0.76.0/agate/scripts/check-scope-resolved.py
    note: "SCOPE_PLUS_RE = `^\\s*-?\\s*\\[SCOPE\\+\\]`（行首匹配）。TPV0099 的 P2-design.md:120 实际形态为 `**[SCOPE+]** 发现：…`（粗体包裹、行首非 `[`）→ 主 Agent 实测 re.search 该行 = False；逐文件扫描（排除 dispatch-context/progress）→ 行首 SCOPE+ 命中 0"
  - path: /home/kity/.agate/v0.76.0/agate/scripts/check-scope-resolved.py
    note: "第 83-84 行为 `if not scope_found: sys.exit(0)` 早退 → scope_found 为空时直接 exit 0，**从未进入 [SCOPE_RESOLVED] 判定分支**。即该 exit 0 对本案恒真（vacuous pass）：与『已闭环』无因果关系"
  - path: /home/kity/.agate/v0.76.0/agate/scripts/check-gate.py
    note: "grep -c check-scope-resolved = 0 → check-gate.py（含 gate_p7）**根本不调用**该脚本；真实调用方是 pre-commit-gate.py:439，且该行有 `if gate_exit != 1 and …` 前置条件 → 当 gate 本身 exit 1 时该项被跳过"
  - note: "反向对照矩阵（P7 reviewer 复审轮，临时副本，单变量）：A 原样 → exit 0 且 stderr 空（复现真空早退）；B 副本改为行首 [SCOPE+] + P1 有标记 → exit 0 且 stderr 报「P1 有 1 个 [SCOPE_RESOLVED]」（真正走通判定分支）；C 在 B 上仅移除 P1 标记 → exit 1；D 还原 → exit 0 ⇒ 该检查**有区分力**，但**仅当 SCOPE+ 以行首形态书写时**才被触发"
impact: ①产出里用粗体 `**[SCOPE+]**` 等行首非 `[` 形态声明新隐含需求时，该脚本静默真空早退，SCOPE+ 闭环**实际未被机械校验**，存在"标记缺失却一路绿灯"的盲区（TPV0099 即如此：BLOCKER 由 P7 consistency-reviewer 人工发现，而非脚本）②check-gate.py 不调用它 → **P7 gate 通过 ≠ SCOPE+ 被校验过**（本次 TPV0099 P7 gate exit 0 时该盲区依然存在）③方法论层面：被引作"闭环证据"的 exit 0 可能是真空通过——本任务因此出现第 10 例"验证声明需要被验证"
recommendation: 上游修 check-scope-resolved.py——SCOPE_PLUS_RE 放宽以覆盖粗体/列表/引用等常见包裹形态（如允许行内 `**[SCOPE+]**`），或在早退分支输出显式提示（如 "no line-start SCOPE+ found; resolved-check skipped"）以免 exit 0 被误读为"已校验通过"；并评估是否需将本脚本纳入 check-gate.py P7 分支（当前仅 pre-commit-gate.py 条件调用）
closure_criteria:
  - 产出以粗体/引用等常见包裹形态写 [SCOPE+] 时，该脚本不再真空早退（能检出并进入 SCOPE_RESOLVED 判定）
  - 早退分支有显式 stderr 提示，"未检出 SCOPE+" 与 "SCOPE+ 已闭环" 在输出上可区分
  - 明确 check-gate.py P7 与 pre-commit-gate.py 对该脚本的调用关系与前置条件，消除"gate 通过即已校验"的误读
source: review
created_at: 2026-09-29
```

> **登记理由（主 Agent，2026-09-29）**：命中登记判据 2——"不修会让未来变更更贵/更危险"。它构成**静默盲区**（真空通过 + gate 不调用），且已被实证导致一次真实误判（主 Agent 把 `exit 0` 当作 SCOPE+ 闭环证据，被 P7 reviewer 推翻）。**性质**：`category: protocol`（缺陷在 agate 协议层脚本）。**不在 TPV0099 修复**（修复点属 agate 上游）。主 Agent 未改协议本体；本任务已按协议要求补齐 `[SCOPE_RESOLVED]` 标记，并在 P7 记录该盲区。

## DEBT0016

```yaml
id: DEBT0016
category: protocol
title: check-p6-provenance.py 剥离 frontmatter 用 --- 逐对配对，奇数个 --- 时末个 --- 吞掉其后至 EOF，致审计 2 对尾部行漏检（同一违规因位置不同判定相反）
status: open
priority: medium
task_id: TPV0099-fullscreen-link
evidence:
  - path: /home/kity/.agate/v0.76.0/agate/scripts/check-p6-provenance.py
    note: "第 372-382 行剥离顶部 frontmatter 的实现：遇 `---` 则 i+=1 后向后找到下一个 `---`，若找不到则 i 越界到 EOF——**奇数个 `---` 时最后一个 `---` 会把其后所有行一并删除**"
  - path: agate-workspace/tasks/TPV0099-fullscreen-link/P6-dispatch-context-verifier.md
    note: "主 Agent 实测：该文件剥离 AGATE_CARD 块后剩 179 行、含 `^---$` **9 个（奇数）** → 第 142 行的 `---` 吞掉其后 38 行（原始行 383-419 在被剥离卡片前的编号域内）→ 该区间整体不参与审计 2（行首 PASS/FAIL 预判扫描）"
  - note: "反向对照（主 Agent 独立复现，临时副本）：把同一违规行 `- PASS BDD-99: …` 放入**被吞区间**（文件尾部）→ check-p6-provenance.py **exit 0（漏检）**；改放入**存活区间**（卡片块后早期行）→ **exit 1（检出）** ⇒ **同一违规因位置不同判定相反**"
  - note: "TPV0099 本任务未因此出错：主 Agent 实测该文件被吞尾部（38 行）行首 PASS/FAIL 命中 **0**，存活区间亦 0 → P6 provenance 结论（exit 0）不依赖该盲区"
impact: ①dispatch-context 等被审计文件若含奇数个 `---` 分隔线（常见：多个水平分隔线/子 frontmatter 示例），其**尾部区间静默逃过审计 2**（行首验收结论预判扫描）→ 存在"违规写在尾部即不被检出"的盲区 ②判定**非确定性**（同一输入因行位置不同结论相反）③当前影响面有限（仅审计 2 受该剥离影响，其余 6 道审计不受），但属审计完整性缺口
recommendation: 上游修 check-p6-provenance.py 的 frontmatter 剥离——改为**只剥离文件顶部第一对 `---`**（用 `if stripped[0]=='---'` 起点判定 + 找不到闭合对时**不删除**并给出显式提示），而非"任意位置遇 `---` 即开始配对"；或在剥离后校验行数守恒（删行数 > 0 且尾部被吞时报警）
closure_criteria:
  - 文件含奇数个 `---` 时，尾部区间仍参与审计 2（同一违规在任意位置均被检出）
  - 剥离逻辑有"未闭合对"的显式告警，不静默吞掉至 EOF
  - 反向对照：同一违规行放文件任意位置，判定一致
source: review
created_at: 2026-09-29
```

> **登记理由（主 Agent，2026-09-29）**：命中登记判据 2。属审计完整性缺口且判定非确定性（位置依赖）。**性质**：`category: protocol`。**不在 TPV0099 修复**；本任务未因此出错（已实证被吞区间无违规）。主 Agent 未改协议本体。


## DEBT0017

```yaml
id: DEBT0017
category: protocol
title: make bump-version 的 Step 4 直接 git add -A，会把工作区未忽略的临时目录（含明文凭证）扫进 release commit，无提交前暂存面防护
status: open
priority: high
task_id: TPV0099-fullscreen-link
evidence:
  - path: Makefile
    note: "bump-version 的 Step 4 为 `git add -A` 后直接 `git commit`（TPV0099 实测 Makefile:262-266 区间），对暂存面不做任何审查或提示"
  - note: "TPV0099 实测 `git add -A --dry-run` 会 stage 162 条路径，其中 158 条在 `.agate-tmp/` 下（该目录当时未被 .gitignore 覆盖），含 10 个明文凭证文件：alice-token.txt / bob-token.txt / alice-cookies.txt / login.json / ck.txt 等"
  - note: "若不处置，release commit 会把明文 token/cookie 写入 git 历史（且 release commit 通常在 tag 上，清理成本高）。TPV0099 已实证 `git log --all -- .agate-tmp/` 为空即历史上从未入库，属尚未发生的风险"
  - path: .gitignore
    note: "TPV0099 的临时缓解：新增 `.agate-tmp/` 规则后复验 `git add -A --dry-run | grep -c agate-tmp` = 0、staged 总数 162→5。但这是**项目侧**规避，未改变 bump-version 本身无防护的事实"
impact: ①任何 agent 编排任务只要在仓库内留下未被 .gitignore 覆盖的临时目录/文件（探针脚本、日志、凭证、备份），`make bump-version` 就会把它们一并提交并在 tag 上固化；②明文凭证入 git 历史属**不可逆**（需 filter-branch/BFG 重写历史）；③当前防护完全依赖"该项目的 .gitignore 恰好覆盖了临时目录"这一偶然条件
recommendation: 二选一或并用——① `bump-version` 在 `git add -A` 之后、`git commit` 之前加"暂存面审查"步骤：打印 `git diff --cached --name-only` 并校验不含未忽略的临时/敏感路径（可配置白名单/黑名单），异常则中止并要求确认；② 改为按路径白名单 `git add`（只加 version 文件 + 静态产物 + CHANGELOG），而非 `git add -A`。另建议模板层为项目 `.gitignore` 预置常见 agent 临时目录（如 `.agate-tmp/`）
closure_criteria:
  - bump-version 提交前对暂存面有显式校验或按白名单 add，未忽略的临时目录不会静默进入 release commit
  - 有可配置的敏感路径黑名单（或与 .gitignore 联动），命中时中止并提示
  - 项目模板 `.gitignore` 预置 agent 常见临时目录
source: retrospective
created_at: 2026-09-29
```

> **登记理由（主 Agent，2026-09-29）**：命中登记判据 2（"不修会让未来变更更贵/更危险"），且**后果不可逆**（凭证入 git 历史需重写历史）。**性质**：`category: protocol`——缺陷在 agate 上游命令模板（`bump-version` 属协议/项目模板层）。**本任务已做项目侧缓解**（`.gitignore` 新增 `.agate-tmp/`），但**未改协议本体**。**优先级 high**：与其余 protocol 债不同，本条的失败模式是"静默泄漏"，无 gate 会在泄漏前提示。


## DEBT0018

```yaml
id: DEBT0018
category: protocol
title: check-judge-verdict.py 证据引用路径形态与行首预判扫描的鲁棒性缺口——P6.5 judge 产出高概率机械失败（TPV0100 实测两处）
status: open
priority: medium
task_id: TPV0100-web-publish
evidence:
  - path: agate/scripts/check-judge-verdict.py
    note: "_evidence_md5_dedup 以 os.path.join(evidence_dir, ref) 解析证据引用，evidence_dir 已是 .../P6-evidence；judge 若按直觉写 P6-evidence/assert-bdd-1.json 前缀 → 路径重复 → 判'引用不存在' exit 1（TPV0100 实测首次 P6.5 gate exit 1）"
  - path: agate/assets/review-roles/judge.md
    note: "角色文件只说'引用须在 verdict_evidence 清单内且指向真实存在、非空的证据文件'，未声明引用相对何目录解析，也未规定 P6-evidence/ 外证据（如 vision-reports/）的引用形式"
  - note: "TPV0100 的 vision YAML 落任务根 vision-reports/（P6-evidence/ 之外），无法以 P6-evidence/ 相对路径表达；改用 ../vision-reports/bdd-NN.yaml 方通过——该形态无任何文档依据"
  - path: agate/scripts/check-judge-verdict.py
    note: "_check_prediction 扫全文行首 `- (PASS|FAIL)`（仅排除 AGATE_CARD/frontmatter，未排除 fenced code block）；P6.5-dispatch-context-judge.md 内的结论行**格式示例** `- PASS BDD-1: {描述}` 被误判为验收结论预判（TPV0100 实测 gate 报'含 2 处行首验收结论预判' exit 1）"
  - path: agate/scripts/check-judge-verdict.py
    note: "TPV0101 实测第三例：verdict 结论行证据引用**括号全角/半角不配对**（开全角 `（` + 闭半角 `)`）时，`_REF_GROUP_RE`（仅匹配 ASCII 配对括号）与全角变体均不匹配 → 该行全部证据被判『未被任何结论引用』exit 1；judge 正文用中文全角标点属自然书写，开闭混用风险高，且报错信息（未被引用）不指向真正原因（括号宽度）"
impact: ①每有 P6.5 judge 的任务，judge 或主 Agent 若按直觉书写证据路径/示例行，必然机械失败并多耗一轮修正——非确定性、位置依赖的摩擦；②dispatch-context 的格式示例（模板化产物）天然含 `- PASS`/`- FAIL` 示例行，是对扫描器的系统性误报源
recommendation: ①judge.md 显式声明 verdict_evidence 引用**相对 P6-evidence/ 解析**，并给出 P6-evidence/ 外证据的 `../<dir>/<file>` 约定与示例；②check-judge-verdict.py 对已知前缀（`P6-evidence/`）做容错剥离，或改用"任一基准可解析"的宽松匹配；③_check_prediction 排除 fenced code block（复用 AGATE_CARD/frontmatter 的双排除模式）
closure_criteria:
  - judge 角色文件明确规定 verdict_evidence 引用的解析基准与外置目录引用形式
  - check-judge-verdict.py 对证据路径前缀歧义有容错或明确报错定位
  - _check_prediction 不再把 dispatch-context 代码块内的格式示例误判为预判
source: retrospective
created_at: 2026-10-02
```

> **登记理由（主 Agent，2026-10-02）**：命中登记判据 2（"不修会让未来变更更贵"）。属性为 `category: protocol`——缺陷在 agate 上游脚本（`check-judge-verdict.py`）与角色文件（`judge.md`）的契约约定。**本任务已做任务侧绕过**（主 Agent 机械修正 judge 产出的路径前缀 + 改写自身 dispatch-context 的示例行为无前缀），但**未改协议本体**。非 high：失败是"阻断 + 可机械修正"，无静默错误/不可逆后果；但**复现率高**（任何 P6.5 任务都可能命中），故记 medium。


## DEBT0019

```yaml
id: DEBT0019
category: technical
title: sqlmodel 0.0.47 起将裸 datetime 列映射为 tz-aware 的 UTCDateTime 并在绑定 naive 值时抛错，项目多处 naive-UTC 时间写入（Entry.archive_delete_at / User.disabled_at 等）在 CI 全新装依赖下大面积失败
status: closed
priority: high
task_id: TPV0101-sqlmodel-datetime-compat
evidence:
  - path: backend/peekview/models.py
    note: "EntryBase.archive_delete_at (L103) 用裸 datetime 标注，但全代码库按 naive UTC 写入：backfill_archive_delete_at 用 launch_naive (database.py:755)、admin_service 用 now_naive (L158/264)、star_service._naive_utc docstring 明写 'matching the archive_delete_at storage'。列迁移 SQL 亦为 DATETIME（database.py:102）"
  - path: backend/pyproject.toml
    note: "dependencies 声明 sqlmodel>=0.0.14 无上限；CI 用 pip install -e '.[test]' 装最新 → 实测拉到 sqlmodel 0.0.47 + sqlalchemy 2.0.54 + pytest 9.1.1，本地 venv 为 0.0.38 + 2.0.51"
  - note: "CI run 36985737250（TPV0100 push）Backend Tests 失败：38 failed + 502 errors；TPV0099 的 run 36585567238/36584856939 同样失败——属预存，非 TPV0100 引入（本任务后端零改动）"
  - note: "根因：sqlmodel/sql/sqltypes.py:34 UTCDateTime.process_bind_param 对 value.utcoffset() is None 抛 ValueError；sqlmodel 0.0.47 main.py:757 将裸 datetime 映射为 UTCDateTime(timezone=True)，仅 NaiveDatetime 标注映射为 DateTime(timezone=False)"
  - note: "隔离复现（/tmp/ci-repro-venv，精确匹配 CI 版本）实测失败 SQL 形态：UPDATE entries SET archive_delete_at=?, updated_at=CURRENT_TIMESTAMP ... / UPDATE users SET disabled_at=?, ... updated_at=CURRENT_TIMESTAMP ...；局部修 archive_delete_at 后暴露 disabled_at 同类问题；读路径 expires_at 比较、restore/备份恢复亦命中——缺陷面跨 Entry/User/备份/清理/star 生命周期"
  - note: "NaiveDatetime 标注在 0.0.38 会 'ValueError: has no matching SQLAlchemy type'（本地不可用），故修模型标注会破坏本地；跨版本稳定修法为显式 sa_column=Column(DateTime(timezone=False))（0.0.38 与 0.0.47 均验证通过）"
  - path: agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P5-test-results/unit.md
    note: "TPV0101 关闭证据：本地 0.0.38 全量 1186 passed / 3 skipped；隔离 0.0.47（CI 等价）全量 1186 passed / 0 failed（基线 550 failed/errors）——closure_criteria #1 满足"
  - path: agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P6-acceptance.md
    note: "TPV0101 关闭证据：P6 18/18 PASS（BDD-16 ORM 枚举 25 列/11 表全 DateTime(timezone=False)，无裸列）——closure_criteria #2/#4 满足"
  - note: "criteria #3 差异说明：未把本地与 CI 钉到同一版本，以 sqlmodel 上限 <1.0.0 + 双版本（0.0.38/0.0.47）行为一致全量各自全绿按满足处理（留痕）"
  - note: "由 TPV0101-sqlmodel-datetime-compat 关闭（2026-10-03，v0.26.1）：后端 models.py 25 列显式 naive + pyproject 依赖上限 + 守卫测试；P8 发布检查 make lint/typecheck/test-quick/0.0.47 全量全 exit 0；tag v0.26.1"
impact: ①CI Backend Tests 长期红（自 TPV0099 起），安全网失效——真实回归无法从 CI 区分；②任何人 clone 后 pip install -e 装到新 sqlmodel 即触发大面积失败，开发体验与 onboarding 受损；③本地与 CI 依赖漂移使'本地全绿'不可信；④修法涉及 Entry/User 核心表 + 备份恢复/清理/star 生命周期，回归面广
recommendation: ①单独立项（非本轮顺手修）：全代码库甄别时间字段存储约定（naive vs aware），统一策略后逐字段显式声明列类型（先例：sa_column=Column(DateTime(timezone=False)) 跨 sqlmodel 版本稳定）；②pyproject 为 sqlmodel 加上限或改用 UV/lock 钉住 CI 依赖版本，消除本地/CI 漂移；③补 CI 依赖版本与本地一致的检查；④先做失败面清单（38+502）→ 分组修复 → 全量回归
closure_criteria:
  - CI Backend Tests 在最新 sqlmodel 下全绿（或依赖已钉住且解释一致）
  - 全代码库时间字段存储约定统一且显式（naive 列显式 DateTime(timezone=False)，aware 列显式 timezone=True）
  - pyproject / CI 依赖版本可控，本地与 CI 不再漂移
  - 备份恢复/清理/star 生命周期等受影响域的回归测试通过
source: retrospective
created_at: 2026-10-02
```

> **登记理由（主 Agent，2026-10-02）**：命中登记判据 1（"不修它，验收声明会变成假的"）—— CI Backend Tests 是项目的安全网，长期红意味着"CI 通过=可发布"的声明失真。**性质**：`category: technical`（依赖行为变更暴露的既有编码缺陷），非本任务引入（TPV0100 后端零改动，失败早于本任务）。**不在 TPV0100 修复**：①本任务已 DONE 且范围是纯前端，根因与之无关；②修复面跨 Entry/User 核心表与备份/清理/star 域，属新非平凡任务（跨子系统 + 数据语义），按 agate 规则应立项走流程，不在已完成任务里顺手改。**紧急度**：high——CI 安全网失效 + 新环境 onboarding 直接失败。

## DEBT0020

```yaml
id: DEBT0020
category: management
title: 任务新增测试文件未纳入 lint 门禁面——agate P2 gate_commands 无 lint key，P5/P6/P7 全绿仍可能在 P8 才撞 make lint 红灯
status: open
priority: medium
task_id: TPV0101-sqlmodel-datetime-compat
evidence:
  - path: backend/tests/test_datetime_naive_compat.py
    note: "TPV0101 P3 新增测试文件含 3 处 F401 未用 import（SQLModel/Team/TeamMember）；同批 backend/tests/test_dependency_guard.py 含 1 处 I001 import 排序"
  - path: agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P2-design.md
    note: "gate_commands 的 P3/P5/P5_ci_repro/P5_dep_guard/P5_schema_guard 全为 pytest，无 ruff/lint key → P5/P6/P7 全程不跑 lint"
  - path: agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P8-gate-diagnosis.md
    note: "P8 发布检查 make lint exit 1（4 项）→ 需插一轮 ruff autofix + 双环境全量回归重跑；CI 门禁（.github/workflows/ci.yml）不含 ruff，lint 仅由 AGENTS.md 铁律 #10 强制，故 gate 链无覆盖"
impact: 任务可在 lint 红灯状态下走完 P0–P7 全部 gate（P4 orchestrator-log 曾记『ruff 全绿』但自查范围未含 tests/），到 P8 才发现；同类漏检对未来任何新增测试文件的任务均会复现
recommendation: ①P2-design.md 的 gate_commands 增加 lint key（如 P5_lint 执行 `backend/.venv/bin/ruff check backend/`），把 lint 纳入 P5 技术验证；②或把 ruff 纳入 CI backend job；③P4 自查范围明确为 `ruff check backend/`（含 tests/）
closure_criteria:
  - gate_commands（或 CI）含 lint 检查，任务在 P7 前即可发现 lint 红灯
source: retrospective
created_at: 2026-10-03
```

> **登记理由（主 Agent，2026-10-03）**：命中登记判据 2（"不修会让未来变更更贵"）。`category: process`——缺口在项目侧 gate_commands 的覆盖范围（非 agate 协议本体）。**本任务已就地修复**（P8 补跑 lint 并复跑双环境全量），但**门禁面本身未补**，未来新增测试文件仍会漏检，故登记待办。

## DEBT0021

```yaml
id: DEBT0021
category: management
title: 发布流程「bump-version 后 git commit --amend」使 tag 停留在 pre-amend 提交——tag 指向的提交缺少 CHANGELOG 正文
status: open
priority: medium
task_id: TPV0101-sqlmodel-datetime-compat
evidence:
  - path: Makefile
    note: "`make bump-version` 内部完成 sync_versions + build-frontend-fast + git add -A + commit + `git tag vX.Y.Z`（第 5 步）；此时提交仅含 CHANGELOG 版本节标题（sync_versions.ensure_changelog 插入），正文尚未填"
  - path: AGENTS.md
    note: "发布流程写明『填 CHANGELOG（bump 后必须做）→ git add CHANGELOG.md && git commit --amend --no-edit』——amend 重写提交后 tag 仍指向旧提交（缺 CHANGELOG 正文），流程未含 tag 重指步骤"
  - note: "TPV0101 实测：bump 产生 tag→3f0c5bb3（CHANGELOG 正文为空）；amend 后 HEAD=8450d044（含正文）但 tag 仍指向 3f0c5bb3，须手动 `git tag -f v0.26.1 HEAD` 纠正。若未纠正并直接 push tag，远端 tag 将永久缺正文"
impact: 按项目文档流程执行的每次发布都会产出「tag 提交缺 CHANGELOG 正文」的失真制品；若已 push 才发现，纠正需 force-push tag（影响他人）
recommendation: 二选一：①调整流程为「先写 CHANGELOG 正文 → make bump-version（正文随 bump 提交）」，去 amend；②保留 amend 流程但在其后补 `git tag -f vX.Y.Z HEAD`，并写入 AGENTS.md / docs/process/release.md
closure_criteria:
  - 按文档流程发布后，tag 指向的提交含完整 CHANGELOG 版本正文（无手工纠正步骤）
source: retrospective
created_at: 2026-10-03
```

> **登记理由（主 Agent，2026-10-03）**：命中登记判据 1（"不修会让未来变更更贵"）。`category: management`——缺口在项目发布流程文档与 Makefile 的衔接。**本任务已就地纠正**（tag 重指 HEAD），但流程本身未补，下次发布仍会复现。
