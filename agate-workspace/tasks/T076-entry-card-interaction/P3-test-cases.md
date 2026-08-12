---
phase: P3
task_id: T076-entry-card-interaction
type: test-cases
parent: P2-design.md
trace_id: T076-P3-20260730
status: draft
created: 2026-07-30
agent: test-designer
test_code_dir: frontend-v3/src/components/__tests__ + frontend-v3/src/views/__tests__ + frontend-v3/e2e
---

## 概述

为 T076 的 21 条 BDD 设计 TDD 红灯测试。两类测试：

- **vitest 单元/组件测试**（jsdom，`make test-frontend`）：mount 现有组件断言新 DOM 结构 + 纯逻辑断言。当前 **32 红 / 4 绿**，红灯全为 `AssertionError`（实现未写），无 collection/syntax error。
- **Playwright e2e**（CDP，`E2E_SPEC=e2e/entry-card-interaction.spec.ts make debug-test`）：真实浏览器覆盖 21 BDD × 2 viewport（chromium 桌面 + Mobile Chrome 移动端）= 42 test runs。需 debug backend :8888 + 已构建前端，P5/P6 执行。

## 测试代码文件

| 文件 | 类型 | 测试数 | 覆盖 BDD |
|------|------|--------|----------|
| `frontend-v3/src/components/__tests__/t076-entry-card.spec.ts` | vitest 组件 | 17 | 01,02,03,04,05,06,07,08,09,10,20,21 |
| `frontend-v3/src/components/__tests__/t076-entry-list-row.spec.ts` | vitest 组件 | 10 | 16,17,18,19 |
| `frontend-v3/src/components/__tests__/t076-base-tag.spec.ts` | vitest 组件 | 3 | 07,08（BaseTag 多态 href） |
| `frontend-v3/src/views/__tests__/t076-search-url-tags.spec.ts` | vitest 逻辑 | 6 | 11,13,14,15 |
| `frontend-v3/e2e/entry-card-interaction.spec.ts` | Playwright e2e | 21（×2 viewport） | 01–21 全覆盖 |

## 红灯验证（自跑结果）

```
vitest（4 个 T076 spec）：Tests 32 failed | 4 passed (36)
全量 make test-frontend：Tests 32 failed | 1026 passed | 1 skipped (1059)
                          Test Files 4 failed | 73 passed (77)
失败类型：全部 AssertionError（如 expected 'h3' to be 'a' / expected undefined to deeply equal ['python']）
collection error: 0   syntax error: 0   第三方 import 失败: 0
typecheck (vue-tsc --noEmit): EXIT=0
```

基线（P3 前）：73 文件 / 1022 passed | 1 skipped。新增 4 文件 / +4 绿 / +32 红，**无回归**。

### 4 个绿灯说明（非 TDD 违规）

红灯指向"新结构/契约未实现"，以下 4 项是**当前已成立的行为**，故意保留为绿（回归守卫）：

1. `t076-base-tag` "without href renders span" — 后向兼容（无 href 时 BaseTag 本就是 span）
2. `t076-search-url-tags` "mergeQuery removes tags param when undefined" — mergeQuery 通用逻辑已支持
3. `t076-entry-card` BDD-03 "clicking username navigates" — 现有 span click handler 已能导航（结构 span→a 断言另有红灯）
4. `t076-entry-list-row` BDD-18 "clicking username navigates" — 同上

T076 真正要求的新结构（span→anchor、card-body a→div、href、data-tags、tabindex、TAG_LIMIT 截断、parseRestoreQuery.tags）对应断言**全部红灯**。

## BDD → 测试映射（21 条全覆盖）

| BDD | 需求 | vitest 单元/组件测试 | e2e 测试 |
|-----|------|---------------------|----------|
| BDD-01 | 仅 title hover 下划线 | t076-entry-card › BDD-01（card-title 是 a；card-body 非 a）×2 | BDD-01（hover title 下划线，hover time 无） |
| BDD-02 | 点 title 进详情（SPA） | t076-entry-card › BDD-02（href=/{slug}；click→router.push）×2 | BDD-02（click→/{slug}） |
| BDD-03 | 点 username 进用户页 | t076-entry-card › BDD-03（a href=/users/alice；click→push）×2 | BDD-03（click→/users/{u}） |
| BDD-04 | 右键 title 复制 entry URL | t076-entry-card › BDD-04（href 含 /{slug}）×1 | BDD-04（href 含 /{slug}） |
| BDD-05 | 右键 username 复制 user URL | t076-entry-card › BDD-05（href 含 /users/alice）×1 | BDD-05（href 含 /users/{u}） |
| BDD-06 | hover 非链接区无下划线 | t076-entry-card › BDD-06（meta-time/meta-sep 无 a 祖先）×2 | BDD-06（hover time 无下划线+cursor default） |
| BDD-07 | 点 tag 跳过滤页 | t076-entry-card › BDD-07（a href=/explore?tags=vue；click→push）×2 + t076-base-tag（href 渲染 a）×2 | BDD-07（click→/explore?tags=） |
| BDD-08 | tag hover 下划线 | t076-entry-card › BDD-08（tag 是 a）×1 + t076-base-tag | BDD-08（hover 下划线+cursor pointer） |
| BDD-09 | tag-overflow hover tooltip | t076-entry-card › BDD-09（data-tags 列全部 5 tags）×1 | BDD-09（hover +2 → ::after 含全部 tags） |
| BDD-10 | 移动端 tap 触发 tooltip | t076-entry-card › BDD-10（tabindex=0）×1 | BDD-10（tap +2 → focused，Mobile Chrome 项目） |
| BDD-11 | URL ?tags= 过滤 | t076-search-url-tags › BDD-11（parseRestoreQuery.tags=['python']；无参=[]）×2 | BDD-11（?tags= 列表仅含该 tag） |
| BDD-12 | 过滤有视觉指示可移除 | t076-search-url-tags › BDD-15（mergeQuery 移除 tags，URL 层）×1 | BDD-12（filter-chip 显示+dismiss 后 URL 无 tags） |
| BDD-13 | 多 tag 过滤 | t076-search-url-tags › BDD-13（tags=python,cli → ['python','cli']）×1 | BDD-13（?tags=a,b 卡片同时含两 tag） |
| BDD-14 | tag+搜索组合 | t076-search-url-tags › BDD-14（tags+q 同存）×1 | BDD-14（?tags=&q= 交集） |
| BDD-15 | 刷新后恢复 | t076-search-url-tags › BDD-15（merge↔parse round-trip）×2 | BDD-15（reload 后仍过滤+URL 保持） |
| BDD-16 | list title 点击进详情 | t076-entry-list-row › BDD-16（entry-title 是 a href；click→push）×2 | BDD-16（list click→/{slug}） |
| BDD-17 | list tag 点击跳过滤 | t076-entry-list-row › BDD-17（a href；click→push；TAG_LIMIT=3 截断 +2）×3 | BDD-17（list click tag→/explore?tags=） |
| BDD-18 | list username 点击进用户页 | t076-entry-list-row › BDD-18（a href=/users/bob；click→push）×2 | BDD-18（list click→/users/{u}） |
| BDD-19 | list hover 语义同 grid | t076-entry-list-row › BDD-19（root 是 div；time 无 a 祖先；title/username/tag 是 a）×3 | BDD-19（list hover time 无/title 有下划线） |
| BDD-20 | Tab 聚焦 title/username/tag | t076-entry-card › BDD-20（三者皆是 a，原生可聚焦）×1 | BDD-20（Tab 遍历三者依次获焦） |
| BDD-21 | 卡片 hover 边框高亮保持 | t076-entry-card › BDD-21（entry-card 是 div；card-body 是 div 解耦链接）×1 | BDD-21（hover 后 borderColor 变化） |

**覆盖核对**：21/21 BDD 均有 ≥1 测试；UI 交互 BDD 均有 e2e（ui_affected=true 满足）。

## 红灯机制说明

- **组件测试**：mount 现有 EntryCard/EntryListRow/BaseTag（文件已存在），断言 T076 目标结构（`card-body` 是 `div`、`card-title`/`meta-username`/`base-tag` 是 `<a>` 带 href、`tag-overflow` 带 `data-tags`+`tabindex`、EntryListRow TAG_LIMIT 截断）。当前实现仍是旧结构（card-body=a、title=h3、username=span、BaseTag 无 href、无截断），故断言失败 = 真红灯。
- **逻辑测试**：`parseRestoreQuery` 当前返回 `{q,owner,status,page}` 无 `tags` 字段，断言 `result.tags` 用 `as RestoredQuery & { tags?: string[] }` cast（保持 typecheck 通过），运行时 `undefined` ≠ 期望数组 = 真红灯。
- **vue-router mock**：组件 spec 用 `vi.hoisted` + `vi.mock('vue-router')` 捕获 `router.push`，验证 SPA 导航行为（文件作用域，不污染其他 spec）。
- **不写实现 stub**：未修改任何实现文件（EntryCard.vue/EntryListRow.vue/BaseTag.vue/EntryListView.vue/searchUrl.logic.ts），实现留给 P4。

## e2e 约定

- BASE_URL 默认 `http://127.0.0.1:8888`（debug，隔离 DB）；beforeAll 安全检查拒绝 `:8080`/`prod`。
- 测试自给自足：通过 `POST /api/v1/entries`（含 `tags`）现造数据，tag 名带时间戳避免串扰。
- viewport：复用 `playwright.config.ts` 现有两项目（chromium 桌面 + Mobile Chrome 移动端），BDD-10 移动端 tap 由 Mobile Chrome 项目覆盖。
- 截图：遵循项目约定存 `/tmp/e2e-results/t076-bddNN-*.png`（与 search.spec.ts 一致），供 P6 vision 分析。
- hover/underline/cursor/tooltip 用 `getComputedStyle`（含 `::after`）实跑断言，非仅截图。

## 下游

- P4 implementer 看测试理解预期行为，实现后 32 红转绿。
- P5 gate：`make typecheck && make test-frontend`（全绿）+ `E2E_SPEC=e2e/entry-card-interaction.spec.ts make debug-test`。
- 注意：现有 `t031-entry-card.spec.ts`/`EntryListRow.spec.ts`/`BaseTag.spec.ts` 断言**旧**结构（card-body 是 a 等），P4 改结构后会变红，需 P4/P7 同步更新（P2 files_to_read 已列明）。
