# P2-design.md

## 1. 方案设计 (UI/UX Polish)

### 1.1 OverflowMenu Refactor
**目标**：提升菜单的 UI 一致性与交互隔离。

- **候选方案 A (推荐)**：使用 Vue `scoped` CSS 结合 CSS 变量 `--c-surface` 强制隔离，Flexbox `align-items: center` 实现垂直对齐，替换为 Lucide 图标。背景色定义为 `var(--c-surface-menu)`，Light 模式 `#ffffff`，Dark 模式 `#1f1f1f`。
- **候选方案 B**：使用 CSS Modules，通过 BEM 命名空间隔离。
- **选择理由**：方案 A 符合 Vue 项目既有模式，风险最小且工作量可控。
- **UI 常量约束**：强制使用 Z-index 规范（遮罩层：200，组件内容层：210）。

### 1.2 ShareManagementPanel Refactor
**目标**：提升 Share 交互效率，简化状态展示。

- **候选方案 A (推荐)**：设计一个独立的 `SharePopover` 组件。触发按钮时计算气泡位置（引入 Floating-UI 保证防遮挡），在移动端使用 `Teleport` 将其挂载至 `body` 并添加遮罩，定义明确的状态机（Init/Loading/Sharing/Shared）。加入 `Toast` 提示组件处理操作反馈（如复制成功、链接撤销）。
- **候选方案 B**：直接在当前页面弹层（Dialog）展示，通过路由 query 参数控制状态。
- **选择理由**：方案 A 交互体验更现代，完全符合“Popover 交互”的需求。

## 2. 影响域分析
- **改什么**：`frontend-v3/src/components/OverflowMenu.vue`, `frontend-v3/src/components/ShareManagementPanel.vue`, `frontend-v3/src/assets/styles/vars.css`
- **不改什么**：后端接口、数据库 schema。
- **风险**：CSS 隔离可能破坏既有布局（需测试 `OverflowMenu` 在不同层级下的表现）。

## 3. 约束字段
```yaml
packages: [frontend-v3]
domains: [ui-polish, share-ux]
ui_affected: true
gate_commands:
  P5: "pytest -q --tb=no"
  P5_e2e: "npx playwright test e2e/share.spec.ts e2e/menu.spec.ts"
  P6: "make build-frontend && npx vue-tsc --noEmit && make test-frontend"
env_constraints:
  debug_env: "make debug-start"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries'"
files_to_read:
  - path: frontend-v3/src/components/OverflowMenu.vue
    why: 现有菜单结构参考
  - path: frontend-v3/src/components/ShareManagementPanel.vue
    why: 现有分享逻辑参考
minimal_validation:
  assumption: "Floating-UI 能正确处理容器内的 popover 位置"
  method: "在测试页面验证容器内外 popover 弹出位置"
  result: "confirmed"
  note: "已验证 Teleport 模式下，遮罩层覆盖正常"
  screenshot_validation: "P6 阶段执行 Playwright 截图对比，关键页面元素（OverflowMenu, SharePopover）视觉 Diff 对齐设计图"
```

## 4. 完成标志
1. OverflowMenu 实现样式隔离，图标更新为 Lucide。
2. ShareManagementPanel 支持 Popover 交互，正确展示生成/撤销链接状态，移动端 Teleport 遮罩正常。
3. Playwright E2E (`e2e/share.spec.ts`, `e2e/menu.spec.ts`) 测试通过。
