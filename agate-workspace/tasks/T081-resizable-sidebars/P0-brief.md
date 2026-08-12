---
phase: P0
task_id: T081
task_name: resizable-sidebars
trace_id: T081
created: 2026-08-04
status: active
parent: none
---

# P0-brief: 详情页侧边栏可拖拽调整宽度

## task

详情页 file tree（左）和 TOC（右）侧边栏加可拖拽 resize handle，宽度持久化 localStorage，移动端不适用（已有 drawer）。

## known_risks

- 宽度定义双源冲突：`EntryDetailContent.vue` scoped 硬编码 `200px`/`240px` 覆盖 `variables.css` 的 `--sidebar-width: 260px`/`--toc-width: 240px`，必须先统一到 CSS 变量才能让 JS 动态控制
- 鼠标事件与内容区滚动冲突：拖拽 `mousemove` 期间需禁用 `content-area` 的 `user-select` 和滚动，否则文字被选中/页面抖动
- 与 zen mode 交互：zen mode 通过 `display: none` 隐藏侧边栏，resize 改的是 CSS 变量值，两者正交不冲突，但需验证
- 双击 reset 行为：用户双击 handle 重置默认宽度是常见交互预期，需明确是否纳入

## executor_env

```yaml
platform: "opencode"
has_task_tool: true
has_local_runtime: true
network: "full"
```

## env_constraints

```yaml
debug_env: "make debug-quick (:8888, /tmp/peekview-debug/)"
test_framework: "vitest 1.6.1 (frontend-v3/) + Playwright CDP (Chrome 151 :18800)"
build_cmd: "make build-frontend"
typecheck_cmd: "cd frontend-v3 && npx vue-tsc --noEmit"
```

## 代码审计结果

### 现有布局结构

```
EntryDetailView.vue (root: flex column)
  └── EntryDetailContent.vue (三栏 flex row)
        ├── <aside class="file-sidebar"> → FileTree.vue (左)
        ├── <main class="content-area"> (中, flex:1)
        └── <aside class="toc-sidebar"> → TocNav.vue (右)
```

### 宽度定义（双源冲突）

| 位置 | 选择器 | 属性 | 值 | 生效？ |
|------|--------|------|----|--------|
| `variables.css:31` | `:root` | `--sidebar-width` | `260px` | ❌ 被覆盖 |
| `variables.css:32` | `:root` | `--toc-width` | `240px` | ❌ 被覆盖 |
| `layout.css:99-104` | `.file-sidebar` | `width` | `var(--sidebar-width)` | ❌ 被覆盖 |
| `layout.css:121-128` | `.toc-sidebar` | `width` | `var(--toc-width)` | ❌ 被覆盖 |
| `EntryDetailContent.vue:174` | `.file-sidebar` (scoped) | `width` | `200px` | ✅ 胜出 |
| `EntryDetailContent.vue:177` | `.toc-sidebar` (scoped) | `width` | `240px` | ✅ 胜出 |

**根因**：scoped 样式硬编码宽度值，覆盖了全局 CSS 变量。必须移除 scoped 硬编码，统一到 CSS 变量。

### 组件内部无宽度逻辑

- `FileTree.vue`：`height: 100%; overflow-y: auto`，无 width 设置，填满父容器
- `TocNav.vue`：只有 padding/font-size，无 width 设置，填满父容器

### 移动端 drawer（已有，不改）

- `useResponsiveLayout.ts`：`isMobile = viewportWidth <= 640`
- CSS `@media (min-width: 1024px)`：侧边栏 `display: block`，以下 `display: none`
- 移动端通过 `showFileDrawer`/`showTocDrawer` 控制 drawer overlay（width: 280px, max-width: 80vw）
- **resize handle 只在 ≥1024px 显示**

### 无现有 resize/drag 基础设施

全项目无 splitter/gutter/drag-resize 组件。需从零实现。

### localStorage 持久化模式

项目用 `peekview-` 前缀：
- `peekview-theme`：Pinia store + watch 自动持久化
- `peekview-view-mode`：独立 composable `useViewMode.ts`，`loadViewMode()`/`saveViewMode()` 函数 + 值校验

T081 应遵循 `useViewMode.ts` 模式（独立 composable + load/save 函数 + 数值 clamp 校验）。

### zen mode 交互

`layout.css:601-608`：`.zen-mode .file-sidebar, .zen-mode .toc-sidebar { display: none }`
resize 改的是 CSS 变量值（width），zen mode 改的是 display，两者正交。

## P0-brief 质量自检

1. **需求真实性**：真实。长文件名/长标题在固定 200px 宽度下被截断，用户无法看清完整名称
2. **现状**：用户现在无法调整侧边栏宽度，只能忍受截断或靠 tooltip 查看
3. **绝望的具体性**：浏览含长文件名的 entry（如 k8s-deployment 有 3 个长路径文件）时最痛
4. **最窄切入点**：两个侧边栏各加一个 drag handle + localStorage 持久化，不含其他布局改动
5. **亲眼观察**：seed-data 中 k8s-deployment、multi-format-demo 等 entry 有长文件名
6. **未来契合**：可调整宽度是 IDE 级查看器的标准能力，长期成立

## 裁剪倾向

- P2 可简化（1 候选方案，follows_existing_pattern：CSS 变量 + composable 模式已有先例）
- P3 保留（drag 交互有边界条件需测试：min/max clamp、双击 reset、mousemove 性能）
- P6 不可跳（UI 交互任务，必须 Playwright 实跑验证拖拽效果）
