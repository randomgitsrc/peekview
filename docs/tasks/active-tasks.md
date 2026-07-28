# 任务看板 (Task Board)

> PeekView 项目任务管理主文件
> **核心原则**：所有任务必须走 [agate](https://github.com/randomgitsrc/agate) 流程（P0-P8），每个阶段有文件产出
> **位置**：`docs/tasks/` 目录下每个任务一个子目录

---

## 活跃任务

| 编号 | 任务名称 | 状态 | 阶段 | 优先级 | 依赖 | 创建日期 | 更新日期 |
|------|----------|------|------|--------|------|----------|----------|
| T061 | t032-probe-data-review | ⬜ 待开始 | P0 | 🔴 | 无 | 2026-07-21 | 2026-07-28 |
| T071 | docker-deploy | ⬜ 待开始 | P0 | 🟡 | T070✅ | 2026-07-24 | 2026-07-28 |
| T074 | display-name-null-fix | ⬜ 待开始 | P0 | 🟠 | 无 | 2026-07-28 | 2026-07-28 |

### T061: 探针数据回顾

分析 entry_reads 数据，判断 Agent 读取行为是否出现信号。结论驱动后续决策（如 T062 Entry 引用关系是否立项）。

### T071: Docker 部署（合并原 T071+T072）

PeekView 后端镜像 + MCP Server 镜像 + docker-compose 模板 + CI 自动推送。合并理由：共用 CI workflow / ghcr.io 通道 / VERSIONS.json 同步逻辑，compose 模板跨依赖。roadmap #34/#36/#37 统一在此 task 交付。

### T074: display_name null 修复

T068 预存失败：Account Settings 清空 display_name 时 PATCH 发 `""` 不发 `null`。≤3 行改动 + 现成测试覆盖。

---

## 已归档/降级

| 编号 | 任务名称 | 原状态 | 处理方式 | 原因 |
|------|----------|--------|----------|------|
| T035 | ci-publish-pipeline | ⬜ P0 | 降级 roadmap | CI publish 已工作（OIDC+NPM_TOKEN），待改的只是 make publish 不上传（3 行），不需要 agate 流程 |
| T062 | entry-reference-fields | ⬜ P0 | 降级 roadmap | 依赖 T061 结论，T061 可能得出"无信号→不做" |
| T064 | storage-backend-abstraction | ⬜ P0 | 降级 roadmap | 依赖商业化决策，无触发条件 |
| T072 | peekview-docker-deploy | ⬜ P0 | 合并→T071 | 与 T071 共用 CI/发布/同步，compose 跨依赖 |

---

## 已完成

| 编号 | 任务名称 | 最终版本 | 优先级 | 完成日期 |
|------|----------|----------|--------|----------|
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
