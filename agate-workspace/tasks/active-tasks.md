# 任务看板 (Task Board)

> PeekView 项目任务管理主文件
> **核心原则**：所有任务必须走 [agate](https://github.com/randomgitsrc/agateon) 流程（P0-P8），每个阶段有文件产出
> **位置**：`agate-workspace/tasks/` 目录下每个任务一个子目录
> **任务编号**：`TPV{编号}`（项目代号 PV = PeekView，agate v0.40.0 起强制 `^T[A-Z]{2}\d+$` 格式）。已完成任务保留旧编号 `Txxx` 不变（历史记录）

---

## 活跃任务

| 编号 | 任务名称 | 状态 | 阶段 | 优先级 | 依赖 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|------|----------|----------|
| TPV0071 | docker-deploy | ⬜ 待开始 | P0 | 🟡 | T070✅ | 2026-07-24 | 2026-07-28 |
| TPV0090 | cli-remote-xdist-fix | ✅已完成 | DONE | 🟡 | 无 | 2026-08-12 | 2026-08-13 |
| TPV0091 | unicode-download-header-fix | ✅已完成 | DONE | 🟠 | 无 | 2026-08-12 | 2026-08-13 |
| TPV0092 | mcp-get-entry-fetch | ✅已完成 | DONE | 🟡 | 无 | 2026-08-12 | 2026-08-15 |
| TPV0093 | star-lifecycle | ✅已完成 | DONE | 🟢 | 无 | 2026-08-12 | 2026-08-16 |
| TPV0094 | treeview-default-expand | ✅已完成 | DONE | 🟡 | 无 | 2026-08-12 | 2026-08-15 |
| TPV0095 | team-visibility | 🔄 进行中 | P7 | 🟠 | 无 | 2026-09-02 | 2026-09-03 |
| T075 | structured-data-viewer | ✅已完成 | DONE | 🟠 | 无 | 2026-07-28 | 2026-08-01 |
| T085 | render-regression-fix | ✅已完成 | DONE | 🟠 | T075✅ | 2026-08-01 | 2026-08-02 |
| TPV0077 | timeline-mvp | ⬜ 待开始 | P0 | 🟡 | 无 | 2026-07-28 | 2026-07-28 |
| T078 | read-tracking-hardening | ✅已完成 | DONE | 🟠 | 无 | 2026-07-28 | 2026-08-03 |
| T079 | interaction-consistency | ✅已完成 | DONE | 🟠 | 无 | 2026-07-30 | 2026-07-31 |
| T080 | admin-user-management | ✅已完成 | DONE | 🟡 | 无 | 2026-07-30 | 2026-08-06 |
| T081 | resizable-sidebars | ✅已完成 | DONE | 🟡 | 无 | 2026-07-30 | 2026-08-05 |
| T082 | arch-refactor | ✅已完成 | DONE | 🟠 | 无 | 2026-07-30 | 2026-07-30 |
| T083 | cjk-search-fix | ✅已完成 | DONE | 🟡 | 无 | 2026-07-30 | 2026-07-31 |
| T084 | detail-scroll-architecture | ✅已完成 | DONE | 🟠 | 无 | 2026-07-31 | 2026-08-01 |
| T086 | admin-settings-consolidation | ✅已完成 | DONE | 🟡 | T080✅ | 2026-08-06 | 2026-08-07 |
| T087 | code-linenumber-offbyone | ✅已完成 | DONE | 🟠 | 无 | 2026-08-06 | 2026-08-07 |

### TPV0071: Docker 部署（合并原 T071+T072）

PeekView 后端镜像 + MCP Server 镜像 + docker-compose 模板 + CI 自动推送。合并理由：共用 CI workflow / ghcr.io 通道 / VERSIONS.json 同步逻辑，compose 模板跨依赖。roadmap #34/#36/#37 统一在此 task 交付。

### T074: display_name null 修复 ✅ hotfixed

≤3 行改动 + 现有测试覆盖，直接 hotfix 不走 agate。ProfileTab.vue `trim() || null`，BDD-03 测试已绿。

### T085: 详情页渲染回归修复

T075 上线后发现的 5 个渲染缺陷：①SVG 被渲染为 TreeView（调度链 isXml 截获 isImage）；②源码视图竖向无法滚动（T084 移除 code-body flex/min-height）；③Markdown 渲染边距丢失（T084 移除 markdown-body padding）；④滚动到底端抖动（setupScrollHide 无边界保护）；⑤TableView per-page 下拉框不符合 DESIGN.md 且真实点击无法选中（原生 select + E2E selectOption 绕过真实交互）。3 个是 T084 回归，2 个是 T075 缺陷。53 BDD 全 PASS 未覆盖——根因是测试数据丰富度不足 + E2E 程序化方法绕过真实点击。

### T075: 结构化数据查看器

TableView（CSV/TSV，TanStack Table headless，复用 Pagination.vue）+ TreeView（JSON/YAML/XML，统一树节点渲染）+ 源码/渲染切换（含 Markdown 补缺口）。5 种格式富渲染 + 统一切换机制。

### T076: EntryCard 交互修复

Card `<a>` 拆分：card-body 变 div，title/username/tag 各自独立 `<a>`，修复右键复制链接混乱。Tags 可点击跳转 `/?tags=xxx` 过滤页。EntryListRow 同步修复。

### TPV0077: 时间线 MVP

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
| TPV0090 | cli-remote-xdist-fix | v0.18.6 | 🟡 | 2026-08-13 |
| TPV0094 | treeview-default-expand | v0.19.0 | 🟡 | 2026-08-15 |
| TPV0092 | mcp-get-entry-fetch | v0.20.0 + mcp-v0.11.0 | 🟡 | 2026-08-15 |
| TPV0091 | unicode-download-header-fix | v0.18.5 | 🟠 | 2026-08-13 |
| TPV0088 | e2e-test-infra-hardening | v0.18.4 | 🟡 | 2026-08-12 |
| TPV0089 | unicode-filename-link-fix | v0.18.3 | 🟠 | 2026-08-12 |
| T091 | mobile-detail-visual-polish | v0.18.2 | 🟠 | 2026-08-09 |
| T090 | mobile-detail-ux-polish | v0.18.1 | 🟠 | 2026-08-10 |
| T086 | admin-settings-consolidation | v0.18.0 | 🟡 | 2026-08-07 |
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
2. `mkdir -p agate-workspace/tasks/T{xxx}-{task-name}`
3. 写 `P0-brief.md`（含 frontmatter: phase/task_id/task_name/trace_id/created/status/parent）
4. 写 `.state.yaml`（phase/status/created/updated/history）
5. 在本文件"活跃任务"表添加一行
6. 如相关 roadmap 条目存在，更新其状态指向新 task

---

## 更新日志

| 日期 | 操作 | 内容 |
|------|------|------|
| 2026-08-15 | 完成 TPV0092 | mcp-get-entry-fetch → v0.20.0 + mcp-v0.11.0（get_entry 接受任意 PeekView URL（页面/raw/分享/裸 slug）→ 跨 host 匿名读取 → 净化后结构化 JSON；publish_files 加 raw_url；后端 raw 补 ?share=/?purify=；SSRF 防护=协议白名单+响应结构校验+20MB 上限+超时；26/26 BDD PASS（:8889 跨 host 实测）；基础设施：make debug-extra 多实例 target + dev-server.sh PORT 参数化 + .gitignore lib/ 误伤修复；DEBT0004/0005 登记）|
| 2026-08-15 | 完成 TPV0094 | treeview-default-expand → v0.19.0（TreeView 默认全展开：节点 ≤2000 全展开 / 超阈值折叠+提示 banner；红线实测 5 量级确定阈值 2000——297ms 达标/5000 超预算；8/8 BDD PASS + E2E 98/98 + 单测 1232 + 后端 1078 全绿；P5→P4 retry1 修复 3 处 E2E spec locator；完整 agate P0-P8，P7 记录 1 条非核心 DEVIATION（perf 脚本位置））|
| 2026-08-13 | 完成 TPV0090 | cli-remote-xdist-fix → v0.18.6（test_cli_remote.py xdist 并发修复：worker 动态端口 18888+worker_index 消除 16 worker 端口竞争 + poll 死亡检测 + teardown 强化；4/4 BDD PASS（-n auto 连续 5 次全绿 + 全量 1078 passed 0 failed——known-failures 预存失败债还清）；完整 agate P0-P8）|
| 2026-08-13 | 完成 TPV0091 | unicode-download-header-fix → v0.18.5（中文/日文文件名下载与图片预览 500 修复：Content-Disposition 改 RFC 5987 filename*=UTF-8'' + ASCII fallback，ASCII header 字节级不变零回归；图片预览改走 /content 端点语义为读取；8/8 BDD PASS（后端 1071+1 预存 + E2E 12/12 + vision 全零 blocker）；完整 agate P0-P8）|
| 2026-08-12 | 立项 TPV0094 | treeview-default-expand（🟡）：TreeView 默认全展开 + 节点数阈值降级（红线实测确定）。纯前端单文件（TreeView.vue），零依赖零冲突，可与 TPV0090 并行。risk=low |
| 2026-08-12 | 立项 TPV0093 | star-lifecycle（🟢 长期）：基于 docs/specs/peekview-star-function-20260812.md（V2.0）。星标豁免删除 + 热度计数 + 墓碑 + 作者后台豁免提示。四决策点定稿：A archived 星标用户可读非星标不可见 / B 独立 EntryTombstone 表 / C Explore 加 [Starred] tab + 独立管理页 / D 存量起倒计时从上线条日起算。risk=high |
| 2026-08-12 | 立项 TPV0092 | mcp-get-entry-fetch（仅立项不实施）：消除 agent 读 PeekView 链接的摩擦——get_entry 接受任意 PeekView URL（页面/raw/分享链接/slug）跨 host 读取 + 净化后结构化 JSON；后端 raw 补 ?share=（私有分享一次读）与 ?purify=（base64 剥离）；SSRF 防护=协议白名单+响应结构校验；publish_files 加 raw_url。设计经多轮讨论定稿 |
| 2026-08-12 | 立项 TPV0091 | unicode-download-header-fix：TPV0089 验收补验发现（用户质疑截图盲区 → Playwright CDP 实跑暴露）——点击文件树里的中文图片.png/概要図.png 显示"图片加载失败"（500），café.png 正常。根因：后端 download_file 的 Content-Disposition header 直接放中文文件名（HTTP header 须 latin-1 编码 → UnicodeEncodeError），前端 getFileAsBase64/downloadFile 走该端点。非 TPV0089 引入，但修复内联路径后暴露。risk=medium |
| 2026-08-12 | 立项 TPV0090 | cli-remote-xdist-fix：known-failures.md 两次登记的同源预存失败（TPV0089/TPV0088）——test_cli_remote.py 在 make test-quick（-n auto 16 workers）下 4~7 failed + 3 errors（模块级 fixture 起的 :18888 server 未在 15s 就绪窗口内启动），单跑 17/17 全绿、CI 串行不受影响。用户确认立项（hotfix 条件"现成覆盖"不成立 + 方案选型有分歧 + 机制交叉）。方案候选：A 等待加长 / B 检测子进程死亡 / C 串行分组 |
| 2026-08-12 | 完成 TPV0088 | e2e-test-infra-hardening → v0.18.4（viewer.spec.ts 19 用例修复：路由 hash→history + slug 重映射 + 12 死选择器替换；e2e-safety-check.sh 加 Check 6 static mtime 校验。9 BDD 全 PASS（E2E 38/38 + mtime 三态）；P5 首轮 E2E 18 failed → 回 P4 重试修复 7 项；完整 agate P0-P8）|
| 2026-08-12 | 完成 TPV0089 | unicode-filename-link-fix → v0.18.3（path-map.ts resolvePath 加 raw 优先 + decode-once 兜底；非 ASCII 文件名图片/链接解析修复。13 BDD 全 PASS（单元 51/51 + E2E 12/12 + vision blocker 0）；P5 发现 BDD-11 断言绑定 SPA URL 实现细节 → BASELINE_CHANGE 改为内容区显示断言；P3 后 P7 从裁剪改保留（改动面扩展超 5 文件）；完整 agate P0-P8）|
| 2026-08-09 | 完成 T091 | mobile-detail-visual-polish → v0.18.2（meta-tags-bar padding16/16+换行不横滚/markdown-body移动端16px padding/底部栏padding对称性bug修复/Copy改icon-btn+Wrap改toggle-btn图标化；13 BDD 全PASS。过程含1次真实P6→P5→P4回退：P6视觉验收发现EntryMetaTagsBar.vue的flex-wrap与layout.css:466-478遗留全局规则冲突，content-area可滚动时meta-tags-bar坍缩到33px标签丢失——P5的50/50全绿因E2E测试BDD-1/2未加firstFileId落在默认svg文件从未触发；用agate-retreat-to.sh规范回退+定向修复(仅1行CSS)+重新走完整P5→P6独立验证，13/13 PASS）|
| 2026-08-07 | 立项 T089 | unicode-filename-link-fix：用户报告非 ASCII 文件名（中文等）本地图片/附件在 markdown 中链接解析失败，英文文件名正常。只读 Explore agent 已定位根因：`frontend-v3/src/utils/path-map.ts` 的 `resolvePath`/`normalizeRef` 未 decode markdown-it 已 percent-encode 的 href/src，与 pathMap 未编码的 Unicode key 不匹配。改动面单文件，零现成测试覆盖（不满足 hotfix 裁剪条件），用户选择新建独立小型 task，risk_level=low-medium |
| 2026-08-07 | 完成 T086 | admin-settings-consolidation → v0.18.0（AdminView 内容迁移为 SettingsView 第4个 tab「用户管理」+ UserMenu 管理员可发现入口 + /admin 路由删除一律404；17 BDD 全 PASS。过程含 2 次真实 P5 回退：①路由拦截 bug（P2 设计假设错误，/:slug 排在 catch-all 前拦截 /admin）②测试选择器 scope 缺陷（P5→P3 跨阶段 PAUSED，人工批准）；副产物：发现并推动修复了 agate 框架 pre-commit hook 的 exit-code 语义 bug）|
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
