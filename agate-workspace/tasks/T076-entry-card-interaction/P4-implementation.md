---
phase: P4
task_id: T076-entry-card-interaction
type: implementation
parent: P3-test-cases.md
trace_id: T076-P4-20260730
status: draft
created: 2026-07-30
agent: implementer
implementation_dir: frontend-v3/src
---

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `frontend-v3/src/components/BaseTag.vue` | 重写 | 新增 `href` prop + `navigate` emit；有 href 渲染 `<a>`，无 href 保持 `<span>`；增加 `a.base-tag` hover/focus-visible 样式 |
| `frontend-v3/src/components/EntryCard.vue` | 重写 | card-body `<a>`→`<div>`；title `<h3>`→`<a>`；username `<span>`→`<a>`；BaseTag 传 href + @navigate；tag-overflow 改 `<button>` + data-tags + tabindex + aria-label + CSS tooltip；移除 navigate emit；内部 navigateToEntry（含 firstFileId）；card-title text-decoration:none + :hover underline |
| `frontend-v3/src/components/EntryListRow.vue` | 重写 | 整行 `<a>`→`<div>`；title `<div>`→`<a>`；username `<span>`→`<a>`；BaseTag 传 href；TAG_LIMIT=3 截断；tag-overflow 同 EntryCard；移除 navigate emit；内部 navigateToEntry；清理死 CSS `:focus-visible`（NOTE-7） |
| `frontend-v3/src/views/searchUrl.logic.ts` | 修改 | `RestoredQuery` 接口增加 `tags: string[]`；`parseRestoreQuery` 解析逗号分隔 tags 参数 |
| `frontend-v3/src/views/EntryListView.vue` | 修改 | 新增 `currentTags` ref；restoreFromURL 读 tags；所有 loadEntries 调用传 tags；toolbar 显示 tag FilterChips（可移除）；removeTag 函数；onBeforeRouteUpdate 同步 tags；移除两处 `@navigate` 绑定（NOTE-7）；移除死代码 navigateToEntry |
| `frontend-v3/src/components/__tests__/t031-entry-card.spec.ts` | 重写 | 适配新结构（card-body=div, title=a, username=a） |
| `frontend-v3/src/components/__tests__/t031-entry-list-row.spec.ts` | 重写 | 适配新结构（root=div, title=a, username=a） |
| `frontend-v3/src/components/__tests__/EntryListRow.spec.ts` | 重写 | 适配新结构（移除 navigate emit 断言，改 title link 断言） |
| `frontend-v3/src/__tests__/expired-warning.test.ts` | 修改 | TC-B15 改为断言 `<a>` 标签 + 增加 vue-router mock |
| `frontend-v3/src/__tests__/filter-tabs.test.ts` | 修改 | TC-B15 改为断言 `<a>` 标签 + 增加 vue-router mock |
| `frontend-v3/src/views/__tests__/searchUrl.logic.spec.ts` | 修改 | 7 处 toEqual 断言增加 `tags: []` 字段 |

## 关键决策

### P2-review 7 NOTE 处理

| NOTE | 处理 |
|------|------|
| 1（iOS tooltip） | 采纳：tag-overflow 用 `<button type="button">` 替代 `<span tabindex=0>`，button 在 iOS Safari tap 可靠获得 focus，CSS `:focus::after` 触发 tooltip |
| 2（P6 CDP 局限） | 记录，P6 阶段处理 |
| 3（aria-label） | 采纳：tag-overflow 增加 `:aria-label="'All tags: ' + entry.tags.join(', ')"` |
| 4（card-title 下划线） | 采纳：`.card-title { text-decoration: none }` + `.card-title:hover { text-decoration: underline }` |
| 5（tag 触摸目标） | 现状，非回归，不处理 |
| 6（空状态） | 复用现有 loadEntries 路径，P6 确认 |
| 7（死 CSS + @navigate） | 采纳：移除 `.entry-list-row:focus-visible` 死 CSS；移除 EntryListView 两处 `@navigate` 绑定；移除 `navigateToEntry` 死代码 |

### 其他决策

- `navigateToEntry` 从 EntryListView 迁入 EntryCard/EntryListRow 内部（保留 firstFileId query 逻辑），与现状 `navigateToUser` 已在两组件重复的约定一致
- `currentTags.value = restored.tags ?? []` 防御性赋值（兼容 mock 环境）
- EntryListRow 的 `.entry-title` 增加 `display: block` 确保 `<a>` 保持块级布局（原 `<div>` 行为）

## 自查结果

- `make test-frontend`：77 files passed, 1057 tests passed, 1 skipped
- `make typecheck`（vue-tsc --noEmit）：EXIT=0
- `make lint`（ruff）：All checks passed
