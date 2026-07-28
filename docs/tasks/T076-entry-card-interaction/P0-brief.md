---
phase: P0
task_id: T076
task_name: entry-card-interaction
type: brief
trace_id: T076-P0-20260728
created: 2026-07-28
status: draft
parent: EntryCard 交互混乱 + Tags 不可点击
---

## 任务简述

修复 EntryCard 交互语义混乱：当前整个 card-body 是一个 `<a>`，导致所有子元素（title、meta、tags、footer）hover 时都显示下划线，右键复制链接全部指向 entry URL。同时让 Tags 可点击，跳转到按 tag 过滤的 Explore 页。

## 背景痛点

1. **交互语义混乱**：鼠标 hover 到 card 时，title、username、tags、footer 全部出现下划线，但只有 title 应该是进入 entry 的链接
2. **右键复制链接错误**：在 meta-username 上右键"复制链接"复制的是 entry URL，但点击实际跳转到 user 页面——逻辑矛盾
3. **Tags 不可点击**：Agent 写入的 tags 有数据链路（存储→FTS5→API 过滤），但前端 BaseTag 是纯 `<span>`，无交互

## 任务范围

### A. EntryCard `<a>` 拆分

**现状**：
```html
<a class="card-body" href="/slug">
  <h3 class="card-title">...</h3>
  <div class="card-meta-text">
    <span class="meta-username" @click.stop.prevent>navigateToUser</span>
    ...
  </div>
  <div class="card-tags">
    <BaseTag>python</BaseTag>
    ...
  </div>
  <div class="card-footer">...</div>
</a>
```

**目标**：
```html
<div class="card-body">
  <a class="card-title" href="/slug">...</a>
  <div class="card-meta-text">
    <a class="meta-username" href="/users/xxx">@xxx</a>
    <span class="meta-time">...</span>
    ...
  </div>
  <div class="card-tags">
    <a class="base-tag" href="/?tags=python">python</a>
    ...
    <span class="tag-overflow" title="全部 tags">+2</span>
  </div>
  <div class="card-footer">...</div>
</div>
```

改动点：
- `card-body`：`<a>` → `<div>`，移除 href 和 @click.prevent
- `card-title`：`<h3>` → `<a>` (或 `<h3>` 内包 `<a>`)，href=entry slug，点击进入详情页
- `meta-username`：`<span>` → `<a>`，href=`/users/{username}`，点击进入 user entries 页
- `card-tags / BaseTag`：`<span>` → `<a>`，href=`/?tags={tag}`，点击进入 tag 过滤页
- `tag-overflow`：保持 `<span>`，hover 时 tooltip 显示全部 tags
- `meta-time / meta-sep / card-footer`：保持 `<span>`，无交互
- 整个 card hover 时边框高亮保持（CSS `:hover` 在 `.entry-card` 上，不依赖 `<a>`）

### B. EntryListRow 同步修复

EntryListRow 和 EntryCard 有同样的结构问题，同步拆分 `<a>`。

### C. Explore 页 tag 过滤支持

后端 API 已支持 `?tags=python,cli` 过滤。前端需要：
- `EntryListView` 读取 URL query 参数 `tags`，传给 API
- tag 过滤状态在 UI 上有视觉指示（比如搜索栏旁显示已选 tag chips，可移除）

### D. tag-overflow tooltip

当 tags 超过显示上限（当前 3 个）时，`+N` 显示全部 tags 的 tooltip。

## 不做

- Tag 共现关系/知识图谱视图 — 后续按需
- Tag 自动补全/推荐 — 不做
- Tag 颜色编码 — 不做

## 环境约束

- 纯前端改动，不涉及后端（API 已支持 tag 过滤）
- 遵循 DESIGN.md 设计系统
- EntryCard 和 EntryListRow 都要改
- 移动端：tag 点击跳转正常，tag-overflow tooltip 用 touch 长按或 tap 显示

## 已知风险

- risk=low：UI 重构，不改业务逻辑
- card-body 从 `<a>` 变 `<div>` 后，整个卡片的点击区域变小（只有 title 是链接）——这可能是期望行为（避免误点），但需确认用户体验
- 键盘可访问性：card-title 和 meta-username 作为 `<a>` 天然可 tab 聚焦，需确认 focus 样式

## 裁剪倾向

- risk=low，但涉及 2 个核心组件重构
- P3 可跳（无新业务逻辑，现有测试覆盖组件渲染）
- P7 可简化（纯 UI 改动，无跨文件一致性风险除了 EntryCard/EntryListRow 对齐）

## 验证标准

- hover card-title → 出现下划线，点击进入 entry 详情页
- hover meta-username → 出现下划线，点击进入 user entries 页
- hover meta-time / meta-sep → 无下划线
- hover base-tag → 出现下划线，点击进入 `/?tags=xxx` 过滤页
- 右键 meta-username "复制链接" → 复制的是 user URL
- 右键 card-title "复制链接" → 复制的是 entry URL
- tag-overflow hover → tooltip 显示全部 tags
- Explore 页 URL 带 `?tags=python` → 列表按 tag 过滤
- EntryListRow 同样符合上述行为
- `make typecheck` 通过
- `make build-frontend` 通过
