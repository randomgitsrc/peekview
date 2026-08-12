# P4 评审进度 — T075 frontend design-review + backend review

## 输入文件读取进度（backend review）

- [x] P4-dispatch-context-backend-review.md（派发指引）
- [x] ~/.agate/assets/review-roles/review.md（角色定义）
- [x] P2-design.md §3.1 + 全文
- [x] P4-implementation-backend.md
- [x] backend/peekview/language.py L60-75, L255-270（含全文）
- [x] backend/tests/test_language.py（BDD-01~06 + TestPlainTextLanguages）

## 评审执行记录（backend review）

- [x] git diff 核对：language.py 仅 2 处改动（L69 `.tsv` + PLAIN_TEXT_LANGS 加 `tsv`）
- [x] 测试实测：test_language.py 63 passed（自跑）、全量 1008 passed 2 skipped（自跑）
- [x] ruff 实测：All checks passed（自跑）
- [x] 边界：`.TSV` 大写 → `tsv` 正确（suffix.lower()）
- [x] 消费者核对：entry_service.py:901/931、files.py:309、file_service.py:150 均为 pass-through 或 html-only 判断
- [x] MIME 核对：_TYPE_MAP/_LANGUAGE_TO_MIME 无 csv/tsv → text/plain 回退，与改动前一致（无回归）
- [x] 前端 Shiki 消费：LANG_IMPORT_MAP 无 tsv → ensureLanguage 回退 'text'（符合设计意图）
- [x] 环境隔离：未触碰生产，仅读写 language.py + pytest tmp_path
- [x] 产出 P4-review-backend.md

## 输入文件读取进度

- [x] P2-design.md（§3.2~3.13 + 全文）
- [x] P4-implementation-frontend.md
- [x] TableView.vue
- [x] TreeView.vue
- [x] DataTreeNode.vue
- [x] TruncationBanner.vue
- [x] useCsvParser.ts
- [x] useTreeData.ts
- [x] structured-data.ts
- [x] useEntryDetailComputed.ts
- [x] EntryDetailContent.vue
- [x] EntryDetailHeader.vue
- [x] EntryDetailMobileBar.vue
- [x] EntryDetailView.vue
- [x] DESIGN.md
- [x] variables.css（语义变量核对：--success-text/--warning-text/--error-*/--accent-light/--accent-hover 等均存在）
- [x] Pagination.vue（复用接口核对：page/perPage/total + update:page）

## 评审执行记录

- [x] AI Slop 检测（无紫色渐变/泛化文案/全居中布局）
- [x] 类型标签颜色对比度计算（深色/浅色双主题，WCAG 4.5:1）
- [x] 交互状态覆盖（loading/error/empty）
- [x] 移动端响应式（横向滚动/触摸目标/切换按钮可见性）
- [x] a11y 检查（aria-sort/aria-expanded/aria-label/aria-live/键盘可达性）
- [x] 滚动架构核对（.content-area 唯一纵向滚动，viewer 不抢滚动）
- [x] 产出 P4-review-frontend.md

## 环境隔离

[PROD_NOT_TOUCHED]

## P4 评审修订轮（implementer revision）— 2026-08-01

已读取 dispatch-context（revision）+ P4-review-frontend.md §3/§5。修复计划：
- BLOCKER A（DataTreeNode 复制按钮化）、B（TableView 排序按钮化）、C（type-tag 对比度/字级）
- MINOR D~N 逐项

开始逐项修复。

## P4 评审修订轮 — 修复完成（2026-08-01）

3 BLOCKER + 11 MINOR 全部落盘：
- A/B/C BLOCKER：DataTreeNode 复制按钮化、TableView 排序按钮化（测试选择器同步双副本）、type-tag 对比度 token（--tag-* 深浅双主题）
- D~N MINOR：parseError toggle 清空、th hover、type-tag token 化、0 匹配播报、TruncationBanner role=status、aria-pressed、44px 触摸目标、iOS font-md、treeExpandKey 独立模块、空容器文案、toast 截断

自查全绿：vue-tsc 零错误 / build 成功 / TableView+TreeView 26/26 / 相关回归 72+ 通过。

## P4 评审复验轮（design-review）— 2026-08-01

- [x] 读取 dispatch-context（复验轮）+ P4-review-frontend.md §3 A~N
- [x] BLOCKER A：DataTreeNode.vue:15-25 复制 button 化 + :152-155 focus-visible
- [x] BLOCKER B：TableView.vue:23-32 th 内嵌 button.th-sort-btn + :224-227 focus-visible；spec 选择器已同步（TableView.spec.ts:95）
- [x] BLOCKER C：type-tag `--font-xs` + `--tag-*` 深浅双主题（variables.css:91-94,155-158）；浅色复算 6.11/6.23/5.12/5.59:1 全达 AA
- [x] MINOR D~N 全部核对（parseError 清除 / th hover / token 化 / 0 匹配播报 / role=status / aria-pressed / 44px / iOS 16px / treeExpandKey 独立 / 空文案 / toast 截断）
- [x] 自跑：TreeView.spec 13/13、TableView.spec 13/13（BDD-22 固有 180s 耗时）、vue-tsc exit 0
- [x] 更新 P4-review-frontend.md status: needs-revision → approved（追加 §6 复验节）

## 环境隔离

[PROD_NOT_TOUCHED]
