---
phase: P6
task_id: T039-explore-ui-polish
type: acceptance
parent: P4-implementation/implementation.md
trace_id: T039-P6-20260630
status: draft
created: 2026-06-30
---

## BDD 验收结果

### R1: Badge 智能显隐

- PASS R1.1: Owner sees Public/Private badge on EntryCard
- PASS R1.2: Non-owner (anonymous) sees no badge on EntryCard
- PASS R1.3: Owner sees Public/Private badge on EntryListRow
- PASS R1.4: Non-owner (anonymous) sees no badge on EntryListRow

### R2: Summary 去重

- PASS R2.1: No `.entry-summary` element in list mode DOM
- PASS R2.2: Title row shows summary content (`entry.summary || entry.slug`)

### R3: 标签折叠上下文感知

- PASS R3.1: Card mode shows 3 tags + "+2" overflow
- PASS R3.2: List mode shows all 5 tags, no overflow
- PASS R3.3: Detail page shows all 5 tags, no overflow
- PASS R3.4: 0 tags → no tag area rendered

## 验证方法

Playwright CDP 脚本连接 localhost:18800，对 debug backend (127.0.0.1:8888) 实跑验证。

测试数据通过 debug backend API 创建：
- 公开 entry（5 tags: alpha/beta/gamma/delta/epsilon）
- 私有 entry（5 tags: foo/bar/baz/qux/quux）
- 无 tag entry

验证策略：
- R1.1/R1.3: 登录 owner → 检查 `.base-badge` 存在
- R1.2/R1.4: 登出 → 检查 `.base-badge` 不存在
- R2.1: 检查 `.entry-summary` DOM 节点 count === 0
- R2.2: 检查 `.entry-title` textContent 非空
- R3.1: 卡片模式检查 `.base-tag` count === 3 + `.tag-overflow` text === "+2"
- R3.2: 列表模式检查 `.base-tag` count === 5 + `.tag-overflow` 不可见
- R3.3: 详情页检查 `.base-tag` count === 5 + `.tag-overflow` 不可见
- R3.4: 详情页 `.header-tags` 不可见 + 卡片 `.card-tags` 不可见

## 证据文件

- `P6-evidence/verify.ts` — Playwright CDP 验证脚本
- `P6-evidence/screenshots/` — 各 BDD 条件截图
- `P6-evidence/test-output.log` — 脚本执行日志（主 Agent 运行后生成）

## 截图清单

| BDD | 截图文件 |
|-----|----------|
| R1.1 | R1.1-owner-card-badge.png |
| R1.2 | R1.2-anon-card-no-badge.png |
| R1.3 | R1.3-owner-listrow-badge.png |
| R1.4 | R1.4-anon-listrow-no-badge.png |
| R2.1 | R2.1-no-summary-element.png |
| R2.2 | R2.2-title-shows-summary.png |
| R3.1 | R3.1-card-3-tags-overflow.png |
| R3.2 | R3.2-list-all-5-tags.png |
| R3.3 | R3.3-detail-all-5-tags.png |
| R3.4 | R3.4-no-tags-no-area.png |
