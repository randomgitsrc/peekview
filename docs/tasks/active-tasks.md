# 任务看板 (Task Board)

> PeekView 项目任务管理主文件
> **核心原则**：所有任务必须走 [agate](https://github.com/randomgitsrc/agate) 流程（P0-P8），每个阶段有文件产出
> **位置**：`docs/tasks/` 目录下每个任务一个子目录

---

## 活跃任务

| 编号 | 任务名称 | 状态 | 阶段 | 优先级 | 依赖 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|------|----------|----------|
| T071 | docker-deploy | ⬜ 待开始 | P0 | 🟡 | T070✅ | 2026-07-24 | 2026-07-28 |
| T075 | structured-data-viewer | ✅已完成 | DONE | 🟠 | 无 | 2026-07-28 | 2026-08-01 |
| T085 | render-regression-fix | ✅已完成 | DONE | 🟠 | T075✅ | 2026-08-01 | 2026-08-02 |
| T077 | timeline-mvp | ⬜ 待开始 | P0 | 🟡 | 无 | 2026-07-28 | 2026-07-28 |
| T078 | read-tracking-hardening | ✅已完成 | DONE | 🟠 | 无 | 2026-07-28 | 2026-08-03 |
| T079 | interaction-consistency | ✅已完成 | DONE | 🟠 | 无 | 2026-07-30 | 2026-07-31 |
| T080 | admin-user-management | ✅已完成 | DONE | 🟡 | 无 | 2026-07-30 | 2026-08-06 |
| T081 | resizable-sidebars | ✅已完成 | DONE | 🟡 | 无 | 2026-07-30 | 2026-08-05 |
| T082 | arch-refactor | ✅已完成 | DONE | 🟠 | 无 | 2026-07-30 | 2026-07-30 |
| T083 | cjk-search-fix | ✅已完成 | DONE | 🟡 | 无 | 2026-07-30 | 2026-07-31 |
| T084 | detail-scroll-architecture | ✅已完成 | DONE | 🟠 | 无 | 2026-07-31 | 2026-08-01 |
| T086 | admin-settings-consolidation | 🔄 进行中 | P8 | 🟡 | T080✅ | 2026-08-06 | 2026-08-07 |
| T087 | code-linenumber-offbyone | ✅已完成 | DONE | 🟠 | 无 | 2026-08-06 | 2026-08-07 |
| T088 | e2e-test-infra-hardening | ⬜ 待开始 | P0 | 🟡 | 无 | 2026-08-07 | 2026-08-07 |

### T071: Docker 部署（合并原 T071+T072）

PeekView 后端镜像 + MCP Server 镜像 + docker-compose 模板 + CI 自动推送。合并理由：共用 CI workflow / ghcr.io 通道 / VERSIONS.json 同步逻辑，compose 模板跨依赖。roadmap #34/#36/#37 统一在此 task 交付。

### T074: display_name null 修复 ✅ hotfixed

≤3 行改动 + 现有测试覆盖，直接 hotfix 不走 agate。ProfileTab.vue `trim() || null`，BDD-03 测试已绿。

### T085: 详情页渲染回归修复

T075 上线后发现的 5 个渲染缺陷：①SVG 被渲染为 TreeView（调度链 isXml 截获 isImage）；②源码视图竖向无法滚动（T084 移除 code-body flex/min-height）；③Markdown 渲染边距丢失（T084 移除 markdown-body padding）；④滚动到底端抖动（setupScrollHide 无边界保护）；⑤TableView per-page 下拉框不符合 DESIGN.md 且真实点击无法选中（原生 select + E2E selectOption 绕过真实交互）。3 个是 T084 回归，2 个是 T075 缺陷。53 BDD 全 PASS 未覆盖——根因是测试数据丰富度不足 + E2E 程序化方法绕过真实点击。

### T075: 结构化数据查看器

TableView（CSV/TSV，TanStack Table headless，复用 Pagination.vue）+ TreeView（JSON/YAML/XML，统一树节点渲染）+ 源码/渲染切换（含 Markdown 补缺口）。5 种格式富渲染 + 统一切换机制。

### T076: EntryCard 交互修复

Card `<a>` 拆分：card-body 变 div，title/username/tag 各自独立 `<a>`，修复右键复制链接混乱。Tags 可点击跳转 `/?tags=xxx` 过滤页。EntryListRow 同步修复。

### T077: 时间线 MVP

entry 新增 project_slug 字段 + timelines 表。MCP publish_files 自动推断 project（git remote → cwd → null）+ listEntries 支持 project 过滤。Agent 通过 `listEntries(project=xxx)` 读取项目演进脉络，等价 git log。前端无改动（Phase 1）。

### T078: 读取追踪强化

先修探针准确性（window_key 跨 action 合并 / share channel 错误 / discover 无查询），再加聚合表（O(1) 查询）+ 扩展统计维度（by_action/by_channel/by_source）+ 原始事件 90 天清理 + admin stats 全局读取概览 + 来源分类（Referer 推断）。删 entry 时保留聚合统计（存在即合理）。display_name null 修复已由 T074 hotfix 完成，不再纳入。

### T079: 交互一致性修复

DESIGN.md §6 定义了规则但代码未遵守。①登录按钮/文案不一致→抽共享 AuthButton 组件，按规则统一 variant + 文案 "Sign in"；②用户菜单不一致→抽共享 UserMenu 组件，统一为 Settings + Logout；③Detail 页 Explore 按钮冗余→移除（logo 已覆盖）；④详情页 tag 不可点击→改用 BaseTag 组件。后端无改动。

### T080: Admin 用户管理

后端补 disable/enable + promote/demote API + CLI `user disable/enable`。前端新增 /admin 路由 + 用户管理页面（列表、禁用/启用、删除、重置密码、角色变更）。Phase 1 不含 backup/restore（保留 CLI-only）。MCP 不暴露。

### T081: 详情页侧边栏可拖拽调整宽度

桌面端 file tree 和 TOC 侧边栏固定宽度，长文件名/长标题被遮挡。加拖拽 handle 调整横向宽度，最小/最大宽度约束，宽度持久化 localStorage，移动端不适用（drawer）。

### T082: 架构重构

后端 DI 三种模式统一为 `app.state` 注入（files.py 走 service、跨 service 调用用注入实例、去掉 fallback new）。错误格式统一为 PeekError。重复代码提取（_looks_like_jwt 等 3 处）。create_entry 事务完整性修复。前端 entry store 拆分为 EntryListStore + EntryDetailStore。EntryDetailView 1003 行 god component 拆分为子组件（目标 < 300 行）。

### T084: 详情页滚动架构统一

详情页多层 overflow:auto 导致滚动容器不明确，引发 scroll-hide 失效 + padding 双层叠加 + TOC 锚点偏移三个连锁问题。统一为 content-area 唯一滚动容器，viewer 组件不抢滚动。补充 DESIGN.md §9 滚动架构决策。

---

## 已归档/降级

| 编号 | 任务名称 | 原状态 | 处理方式 | 原因 |
|------|----------|--------|----------|------|
| T061 | t032-probe-data-review | ⬜ P0 | 降级 roadmap | 已有结论（跨 Agent 读取信号极弱），3 个月后复查 |
| T074 | display-name-null-fix | ⬜ P0 | ✅ hotfixed | ≤3 行改动直接修复，不走 agate |
| T035 | ci-publish-pipeline | ⬜ P0 | 降级 roadmap | CI publish 已工作（OIDC+NPM_TOKEN），待改的只是 make publish 不上传（3 行），不需要 agate 流程 |
| T062 | entry-reference-fields | ⬜ P0 | 降级 roadmap | 依赖 T061 结论，T061 可能得出"无信号→不做" |
| T064 | storage-backend-abstraction | ⬜ P0 | 降级 roadmap | 依赖商业化决策，无触发条件 |
| T072 | peekview-docker-deploy | ⬜ P0 | 合并→T071 | 与 T071 共用 CI/发布/同步，compose 跨依赖 |
| T076 | code-search (旧编号已复用为 entry-card-interaction) | — | 降级 roadmap | 浏览器 Ctrl+F 可用，内置搜索体验好但非必要 |

---

## 已完成

| 编号 | 任务名称 | 最终版本 | 优先级 | 完成日期 |
|------|----------|----------|--------|----------|
| T085 | render-regression-fix | v0.14.1 | 🟠 | 2026-08-02 |
| T075 | structured-data-viewer | v0.14.0 | 🟠 | 2026-08-01 |
| T079 | interaction-consistency | v0.13.0 | 🟠 | 2026-07-31 |
| T083 | cjk-search-fix | v0.12.3 | 🟡 | 2026-07-31 |
| T076 | entry-card-interaction | v0.12.0 | 🟠 | 2026-07-30 |
| T073 | ruff-sqlalchemy-regression | v0.11.1 | 🔴 | 2026-07-26 |
| T069 | detail-page-header-polish | v0.11.2 | 🟠 | 2026-07-26 |
| T070 | mcp-docker-deployability | mcp-v0.10.0 | 🔴 | 2026-07-25 |
| T068 | account-settings | v0.11.0 | 🟠 | 2026-07-23 |
| T067 | detail-page-framework | v0.10.1 | 🟠 | 2026-07-23 |
| T065 | login-state-bug | v0.9.5 | 🔴 | 2026-07-22 |
| T031 | cold-open-performance | v0.10.0 | 🔴 | 2026-07-22 |
| T060 | archived-visibility-auth-refresh | v0.9.4 | 🟠 | 2026-07-21 |
| T059 | markdown-extensions | v0.9.3 | 🟠 | 2026-07-20 |
| T058 | overflow-share-redesign | v0.9.0 | 🟠 | 2026-07-17 |
| T056 | prometheus-metrics | v0.8.0 | 🟡 | 2026-07-17 |
| T055 | admin-backup-export | v0.7.0 | 🔴 | 2026-07-17 |
| T054 | api-safety-idempotency | v0.6.3 | 🔴 | 2026-07-14 |
| T053 | agent-raw-discovery | P8裁剪 | 🔴 | 2026-07-13 |
| T052 | entry-detail-header-redesign | DONE | 🟠 | 2026-07-10 |
| T051 | entry-lifecycle-gaps | v0.5.4补充 | 🟠 | 2026-07-09 |
| T050 | mobile-header-diagram-sanitize-fix | v0.5.6 | 🟠 | 2026-07-08 |
| T049 | mobile-header-diagram-sanitize | v0.5.5 | 🟠 | 2026-07-08 |
| T048 | entry-lifecycle | v0.5.4 | 🟠 | 2026-07-07 |
| T047 | content-link-fix | v0.5.3 | 🔴 | 2026-07-05 |
| T045 | code-block-rendering-fix | v0.5.2 | 🟠 | 2026-07-01 |
| T044 | frontend-interaction-fixes | v0.5.1 | 🟠 | 2026-07-01 |
| T041 | html-sibling-inject-fix | v0.5.0 | 🟡 | 2026-06-30 |
| T040 | shiki-language-coverage | v0.5.0 | 🟡 | 2026-06-30 |
| T039 | explore-ui-polish | v0.5.0 | 🟠 | 2026-06-30 |
| T037 | search-content-expansion | v0.5.0 | 🟡 | 2026-06-30 |
| T036 | detail-info-completeness | v0.4.0 | 🟠 | 2026-06-30 |
| T033 | share-semantic-security-fixes | v0.4.0 | 🟡 | 2026-06-30 |
| T032 | entry-read-tracking | v0.4.0 | 🟡 | 2026-06-30 |
| T030 | frontend-interaction-enhancements | v0.4.0 | 🟡 | 2026-06-30 |
| T029 | card-list-layout-polish | v0.4.0 | 🟠 | 2026-06-30 |
| T028 | frontend-design-system-refactor | v0.3.1 | 🟠 | 2026-06-29 |
| T027 | share-link | v0.3.0 | 🟠 | 2026-06-29 |
| T026 | search-url | v0.3.0 | 🟡 | 2026-06-28 |
| T024 | landing-page | v0.2.5 | 🟠 | 2026-06-28 |
| T025 | user-page | P7 | 🟠 | 2026-06-28 |
| T023 | page-basics | P6 | 🟠 | 2026-06-28 |
| T020 | svg-codeblock-viewer | v0.2.4 | 🟠 | 2026-06-28 |
| T021 | zen-mode | P8 | 🟡 | 2026-06-25 |
| T019 | html-viewer-srcdoc-csp | P8 | 🔴 | 2026-06-23 |
| T018 | plantuml-start-markers | P8 | 🟠 | 2026-06-21 |
| T017 | theme-media-query-fix | P8 | 🟠 | 2026-06-21 |
| T016 | plantuml-rendering | P8 | 🟠 | 2026-06-20 |
| T015 | mcp-config-verify | P8 | 🟠 | 2026-06-16 |
| T014 | mcp-namespace-cli | P8 | 🔴 | 2026-06-16 |
| T011 | user-management | P8 | 🔴 | 2026-06-16 |
| T010 | apikey-local | P8 | 🔴 | 2026-06-15 |
| T009 | raw-shortlink | P8 | 🟡 | 2026-06-15 |
| T008 | mcp-stateless | P8 | 🟠 | 2026-06-14 |
| T007 | entry-raw-api | P6 | 🟠 | 2026-06-14 |
| T006 | admin-stats-cleanup | P5 | 🟠 | 2026-06-13 |
| T005 | admin-perm-fix | P5 | 🔴 | 2026-06-13 |
| T004 | captcha-wasm-root-cause | P6 | 🟠 | 2026-06-12 |
| T002 | fix-db-migration | P7 | 🔴 | 2026-06-12 |
| T001 | mcp-namespace-map | P8 | 🟠 | 2026-06-15 |

## 已取消/失败/合并

| 编号 | 任务名称 | 处理 | 原因 |
|------|----------|------|------|
| T066 | explore-card-display-config | ❌ 取消 | 范围方向反，defer backlog |
| T063 | task-category-field | ❌ 取消 | 不需要 |
| T046 | content-link-resolution | ❌ 失败 | Content-Type 返回 text/plain |
| T043 | html-inject-ux-polish | 🔀 合并→T041 | |
| T042 | html-module-script-inject | 🔀 合并→T041 | |
| T038 | csharp-highlight-description-api | 🔀 合并→T040 | |
| T022 | diagram-renderer-refactor | ❌ 回退 | P8→REVERTED |
| T003 | csp-captcha-wasm | ❌ 取消 | |
| T072 | peekview-docker-deploy | 🔀 合并→T071 | 共用 CI/发布/同步逻辑 |

---

## 状态说明

| 状态 | 符号 | 定义 | 触发条件 |
|------|------|------|----------|
| **待开始** | ⬜ | 任务已创建，P1 尚未开始 | 任务目录 + P0-brief 已创建 |
| **进行中** | 🔄 | 正在执行某个阶段 | 正在执行 P1-P7 中某个阶段 |
| **暂停** | ⏸️ | 被阻塞，等待外部条件 | 等待评审/用户确认/外部依赖 |
| **待验证** | ⏳ | 阶段完成，等待评审或验证 | P2 评审完成 / P5 验证完成 |
| **失败** | ❌ | 评审不通过或验证失败 | P2 评审 rejected / P5 有失败项 |
| **已完成** | ✅✅ | P8 发布完成 | 已生成 P8-release.md 或 bump-version |

---

## 优先级说明

| 优先级 | 符号 | 定义 |
|--------|------|------|
| 🔴 | 紧急 | 阻塞性问题/安全/数据丢失，必须立即处理 |
| 🟠 | 近期 | 影响功能发布，近期需要完成 |
| 🟡 | 中期 | 可以安排在当前迭代 |
| 🟢 | 长期 | 可以后续处理 |

---

## 任务创建流程

1. 读取本文件，找最大序号 N，新编号 = N+1
2. `mkdir -p docs/tasks/T{xxx}-{task-name}`
3. 写 `P0-brief.md`（含 frontmatter: phase/task_id/task_name/trace_id/created/status/parent）
4. 写 `.state.yaml`（phase/status/created/updated/history）
5. 在本文件"活跃任务"表添加一行
6. 如相关 roadmap 条目存在，更新其状态指向新 task

---

## 更新日志

| 日期 | 操作 | 内容 |
|------|------|------|
| 2026-08-07 | 立项 T088 | e2e-test-infra-hardening：源自 T087 复盘（3.1/3.2 节）。子任务 A 修复 `viewer.spec.ts`（路由 `/#/entry/{slug}` 过时 + `lu4prg`/`ngajri` slug 失效，选择器已核实未过时）；子任务 B 在 `make debug-test` 前置检查加 static mtime 校验（防前端改动未 build-frontend 导致验收假通过）|
| 2026-08-02 | 完成 T085 | render-regression-fix → v0.14.1（SVG调度/源码滚动/Markdown边距/滚动抖动/per-page下拉框 5项修复；11 BDD 全 PASS）|
| 2026-08-01 | 立项 T085 | render-regression-fix：SVG→TreeView / 源码视图不滚动 / Markdown 边距丢失 / 滚动抖动（T084 回归 + T075 调度链缺陷）|
| 2026-08-01 | 完成 T075 | structured-data-viewer → v0.14.0（TableView CSV/TSV + TreeView JSON/YAML/XML + 源码/渲染切换 + .tsv 映射修正；53 BDD 全 PASS + 1008 backend + 1177 frontend + E2E 84/84）|
| 2026-07-31 | 完成 T079 | interaction-consistency → v0.13.0（AuthButton + UserMenu 共享组件 + 移除 Explore + tag 改 BaseTag；17 BDD 全 PASS + 1125 passed 零回归）|
| 2026-07-31 | 完成 T083 | cjk-search-fix → v0.12.3（json_each 精确匹配 + jieba 预分词 + 连字符→空格 + trigger 降级 + backfill 版本标记；17 BDD 全 PASS + 1001 passed 零回归）|
| 2026-07-30 | 立项 T082 | arch-refactor：后端 DI 统一+错误格式统一+重复代码提取+create_entry 事务；前端 entry store 拆分+EntryDetailView 拆分。多维度架构审计发现 6 项结构性问题 |
| 2026-07-30 | 立项 T079+T080+T081 | T079 交互一致性修复（AuthButton/UserMenu 统一 + tag 可点击 + Explore 按钮移除）；T080 admin 用户管理（后端 disable/enable/promote/demote + CLI + 前端 /admin 页面）；T081 详情页侧边栏可拖拽调整宽度；roadmap #46 删除（需求弱）/#47→T081 |
| 2026-07-30 | 完成 T076 | entry-card-interaction → v0.12.0（EntryCard/EntryListRow <a> 拆分 + BaseTag 可点击 + Explore tag 过滤 + tooltip；完整 agate P0-P8，21 BDD 验收全 PASS，vision×19 全 blocker=0） |
| 2026-08-03 | 完成 T078 | read-tracking-hardening → v0.15.0（探针修复+聚合表+by_action/by_source+来源分类+90天清理+admin stats reads+删entry保留统计；34 BDD 全 PASS，1042 passed 0 failed）|
| 2026-08-03 | P0 T078 | read-tracking-hardening P0 更新：代码审计发现 5 个探针准确性问题（window_key 不含 action / share channel 错误 / discover 无查询 / files.py channel 不走 _detect_channel / 测试名矛盾），范围前置探针修复。display_name null 已由 T074 hotfix 移除。删 entry 保留聚合统计 |
| 2026-07-28 | 立项 T078 | read-tracking-hardening：聚合表+by_action+清理+admin stats+迁移 |
| 2026-07-28 | 立项 T076+T077 | T076 entry-card-interaction（Card a拆分+Tags可点击）；T077 timeline-mvp（project_slug+timelines表+MCP推断/过滤）；roadmap 新增 #40-45 |
| 2026-07-28 | 立项 T075 | structured-data-viewer：TableView(CSV/TSV)+TreeView(JSON/YAML/XML)+源码切换+Markdown补缺口；T076 code-search 降级 roadmap |
| 2026-07-28 | 任务整理 | T071+T072 合并→T071-docker-deploy；T035/T062/T064 降级 roadmap；新建 T074-display-name-null-fix；roadmap #2 标完成/#6 降级/#29 降级/#33 决策/#34+36+37→T071/#10 非 task |
| 2026-07-26 | 完成 T073 | ruff-sqlalchemy-regression → v0.11.1（19 处修复 + E711/E712 ignore） |
| 2026-07-26 | 完成 T069 | detail-page-header-polish → v0.11.2（auth guard async wait + header/bottom bar UI polish） |
| 2026-07-25 | 完成 T070 | mcp-docker-deployability → mcp-v0.10.0 |
| 2026-07-23 | 完成 T068 | account-settings → v0.11.0 |
| 2026-07-23 | 完成 T067 | detail-page-framework → v0.10.1 |
| 2026-07-22 | 完成 T065 | login-state-bug → v0.9.5 |
| 2026-07-22 | 完成 T031 | cold-open-performance → v0.10.0 |
| 2026-07-21 | 完成 T060 | archived-visibility-auth-refresh → v0.9.4 |
| 2026-07-20 | 完成 T059 | markdown-extensions → v0.9.3 |
| 2026-07-17 | 完成 T058 | overflow-share-redesign → v0.9.0 |
| 2026-07-17 | 完成 T056 | prometheus-metrics → v0.8.0 |
| 2026-07-17 | 完成 T055 | admin-backup-export → v0.7.0 |
| 2026-07-14 | 完成 T054 | api-safety-idempotency → v0.6.3 |
