---
phase: P3
task_id: T081-resizable-sidebars
type: test-cases
parent: P2-design.md
trace_id: T081-P3-20260804
status: draft
created: 2026-08-04
agent: test-designer
---

# P3 测试用例清单：详情页侧边栏可拖拽调整宽度

test_code_dir: `frontend-v3/src/composables/__tests__/`
e2e_code_dir: `frontend-v3/e2e/`

## 测试覆盖矩阵

| BDD | 类型 | 测试文件 | 测试函数 |
|-----|------|----------|----------|
| BDD-01 | composable 单测 | useSidebarResize.spec.ts | test_bdd_01_drag_file_sidebar_increases_width |
| BDD-02 | composable 单测 | useSidebarResize.spec.ts | test_bdd_02_drag_toc_sidebar_increases_width |
| BDD-03 | composable 单测 | useSidebarResize.spec.ts | test_bdd_03_drag_exceeds_max_clamps_to_upper |
| BDD-04 | composable 单测 | useSidebarResize.spec.ts | test_bdd_04_drag_exceeds_min_clamps_to_lower |
| BDD-05 | composable 单测 | useSidebarResize.spec.ts | test_bdd_05_width_restored_from_localstorage |
| BDD-06 | composable 单测 | useSidebarResize.spec.ts | test_bdd_06_invalid_localstorage_falls_back_to_default |
| BDD-07 | composable 单测 | useSidebarResize.spec.ts | test_bdd_07_out_of_range_localstorage_falls_back_to_default |
| BDD-08 | E2E | t081-resizable-sidebars.spec.ts | test_bdd_08_no_handle_below_1024px |
| BDD-09 | E2E | t081-resizable-sidebars.spec.ts | test_bdd_09_zen_mode_hides_handle |
| BDD-10 | E2E | t081-resizable-sidebars.spec.ts | test_bdd_10_file_sidebar_hidden_no_handle |
| BDD-11 | E2E | t081-resizable-sidebars.spec.ts | test_bdd_11_toc_sidebar_hidden_no_handle |
| BDD-12 | composable 单测 | useSidebarResize.spec.ts | test_bdd_12_drag_disables_user_select |
| BDD-13 | composable 单测 | useSidebarResize.spec.ts | test_bdd_13_drag_does_not_trigger_scroll |
| BDD-14 | composable 单测 | useSidebarResize.spec.ts | test_bdd_14_double_click_resets_file_sidebar |
| BDD-15 | composable 单测 | useSidebarResize.spec.ts | test_bdd_15_double_click_resets_toc_sidebar |
| BDD-16 | composable 单测 | useSidebarResize.spec.ts | test_bdd_16_keyboard_focus_visible |

## composable 单测用例详情

### TC-01: BDD-01 拖拽 file-sidebar 右边缘 handle 改变左栏宽度

- **测试函数**: `test_bdd_01_drag_file_sidebar_increases_width`
- **BDD 编号**: BDD-01
- **前置条件**: 桌面端，file-sidebar 可见，初始宽度 260px（default）
- **操作**: mousedown on handle → mousemove +50px (clientX 从 260 到 310)
- **预期**: CSS 变量 `--sidebar-width` 更新为 `310px`（260 + 50）
- **验证方式**: `document.documentElement.style.getPropertyValue('--sidebar-width')` === `'310px'`

### TC-02: BDD-02 拖拽 toc-sidebar 左边缘 handle 改变右栏宽度

- **测试函数**: `test_bdd_02_drag_toc_sidebar_increases_width`
- **BDD 编号**: BDD-02
- **前置条件**: 桌面端，toc-sidebar 可见，初始宽度 240px（default），side='right'
- **操作**: mousedown on handle → mousemove -30px (clientX 从 1000 到 970，向左拖使右栏增宽)
- **预期**: CSS 变量 `--toc-width` 更新为 `270px`（240 + 30，right side 反转 delta）
- **验证方式**: `document.documentElement.style.getPropertyValue('--toc-width')` === `'270px'`

### TC-03: BDD-03 拖拽超出最大宽度时 clamp 到上限

- **测试函数**: `test_bdd_03_drag_exceeds_max_clamps_to_upper`
- **BDD 编号**: BDD-03
- **前置条件**: file-sidebar 初始宽度 260px，maxPx=500
- **操作**: mousedown → mousemove +300px (远超 500px 上限)
- **预期**: CSS 变量 `--sidebar-width` === `'500px'`（clamp 到 max）
- **验证方式**: getPropertyValue === '500px'

### TC-04: BDD-04 拖拽超出最小宽度时 clamp 到下限

- **测试函数**: `test_bdd_04_drag_exceeds_min_clamps_to_lower`
- **BDD 编号**: BDD-04
- **前置条件**: toc-sidebar 初始宽度 240px，minPx=150，side='right'
- **操作**: mousedown → mousemove +200px (向右拖使右栏变窄，240-200=40，低于 min 150)
- **预期**: CSS 变量 `--toc-width` === `'150px'`（clamp 到 min）
- **验证方式**: getPropertyValue === '150px'

### TC-05: BDD-05 拖拽后宽度从 localStorage 恢复

- **测试函数**: `test_bdd_05_width_restored_from_localstorage`
- **BDD 编号**: BDD-05
- **前置条件**: localStorage `peekview-sidebar-width` = '350'
- **操作**: 调用 useSidebarResize 初始化（loadWidth）
- **预期**: CSS 变量 `--sidebar-width` === `'350px'`
- **验证方式**: getPropertyValue === '350px'

### TC-06: BDD-06 localStorage 非法值回退到默认

- **测试函数**: `test_bdd_06_invalid_localstorage_falls_back_to_default`
- **BDD 编号**: BDD-06
- **前置条件**: localStorage `peekview-sidebar-width` = 'abc'
- **操作**: 调用 useSidebarResize 初始化（loadWidth）
- **预期**: CSS 变量 `--sidebar-width` === `'260px'`（defaultPx）
- **验证方式**: getPropertyValue === '260px'

### TC-07: BDD-07 localStorage 超范围值回退到默认

- **测试函数**: `test_bdd_07_out_of_range_localstorage_falls_back_to_default`
- **BDD 编号**: BDD-07
- **前置条件**: localStorage `peekview-toc-width` = '9999'
- **操作**: 调用 useSidebarResize 初始化（loadWidth）
- **预期**: CSS 变量 `--toc-width` === `'240px'`（defaultPx）
- **验证方式**: getPropertyValue === '240px'

### TC-12: BDD-12 拖拽期间内容区文字不被选中

- **测试函数**: `test_bdd_12_drag_disables_user_select`
- **BDD 编号**: BDD-12
- **前置条件**: file-sidebar 可见
- **操作**: mousedown on handle
- **预期**: `document.body.classList.contains('resize-active')` === true
- **验证方式**: 拖拽期间 body 有 `resize-active` class（CSS 中该 class 设置 `user-select: none`）

### TC-13: BDD-13 拖拽期间不触发内容区滚动

- **测试函数**: `test_bdd_13_drag_does_not_trigger_scroll`
- **BDD 编号**: BDD-13
- **前置条件**: file-sidebar 可见，content-area 有滚动内容（scrollTop=100）
- **操作**: mousedown → mousemove → mouseup（完整拖拽周期）
- **预期**: content-area 的 scrollTop 不变（仍为 100）
- **验证方式**: 拖拽前后 scrollTop 相等。P2 声明：mousemove 不直接触发滚动，验证 body resize-active class 即可覆盖语义

### TC-14: BDD-14 双击 file-sidebar handle 重置为默认宽度

- **测试函数**: `test_bdd_14_double_click_resets_file_sidebar`
- **BDD 编号**: BDD-14
- **前置条件**: file-sidebar 宽度已改为 350px
- **操作**: dblclick on handle
- **预期**: CSS 变量 `--sidebar-width` === `'260px'`（defaultPx）
- **验证方式**: getPropertyValue === '260px'

### TC-15: BDD-15 双击 toc-sidebar handle 重置为默认宽度

- **测试函数**: `test_bdd_15_double_click_resets_toc_sidebar`
- **BDD 编号**: BDD-15
- **前置条件**: toc-sidebar 宽度已改为 180px
- **操作**: dblclick on handle
- **预期**: CSS 变量 `--toc-width` === `'240px'`（defaultPx）
- **验证方式**: getPropertyValue === '240px'

### TC-16: BDD-16 resize handle 可通过键盘聚焦

- **测试函数**: `test_bdd_16_keyboard_focus_visible`
- **BDD 编号**: BDD-16
- **前置条件**: handle 元素已创建
- **操作**: handle.focus()
- **预期**: handle 元素存在且可聚焦（tabindex >= 0），focus 后 `document.activeElement === handle`
- **验证方式**: activeElement 引用相等 + handle 有 aria 属性（role=separator, aria-orientation=vertical）

## E2E 用例详情（BDD-08 ~ BDD-11）

### TC-08: BDD-08 视口 <1024px 时不显示 resize handle

- **测试文件**: `frontend-v3/e2e/t081-resizable-sidebars.spec.ts`
- **测试函数**: `test_bdd_08_no_handle_below_1024px`
- **viewport**: 390x844（mobile project）
- **操作**: 打开多文件 markdown entry 详情页
- **预期**: `.resize-handle` 元素数量为 0（display:none 或不渲染）
- **截图**: `mobile_390x844_bdd08.png`

### TC-09: BDD-09 进入 zen mode 后 resize handle 不可见

- **测试文件**: `frontend-v3/e2e/t081-resizable-sidebars.spec.ts`
- **测试函数**: `test_bdd_09_zen_mode_hides_handle`
- **viewport**: 1280x800（desktop project）
- **操作**: 打开详情页 → 按 `f` 键进入 zen mode
- **预期**: `.resize-handle` 不可见（随 aside display:none 一起消失）
- **截图**: `desktop_1280x800_bdd09.png`

### TC-10: BDD-10 file-sidebar 条件渲染关闭时 handle 不显示

- **测试文件**: `frontend-v3/e2e/t081-resizable-sidebars.spec.ts`
- **测试函数**: `test_bdd_10_file_sidebar_hidden_no_handle`
- **viewport**: 1280x800（desktop project）
- **操作**: 打开单文件 entry（isMultiFile=false，file-sidebar 不渲染）
- **预期**: `.file-sidebar .resize-handle` 元素不存在
- **截图**: `desktop_1280x800_bdd10.png`

### TC-11: BDD-11 toc-sidebar 条件渲染关闭时 handle 不显示

- **测试文件**: `frontend-v3/e2e/t081-resizable-sidebars.spec.ts`
- **测试函数**: `test_bdd_11_toc_sidebar_hidden_no_handle`
- **viewport**: 1280x800（desktop project）
- **操作**: 打开非 markdown entry（toc-sidebar 不渲染）
- **预期**: `.toc-sidebar .resize-handle` 元素不存在
- **截图**: `desktop_1280x800_bdd11.png`

## composable 接口契约（P4 implementer 参照）

```typescript
interface SidebarResizeConfig {
  storageKey: string        // e.g. 'peekview-sidebar-width'
  cssVar: string            // e.g. '--sidebar-width'
  defaultPx: number         // e.g. 260
  minPx: number             // e.g. 160
  maxPx: number             // e.g. 500
  side: 'left' | 'right'    // left: delta=+move; right: delta=-move
}

interface UseSidebarResizeReturn {
  currentWidth: Ref<number>
  loadWidth: () => number
  saveWidth: (px: number) => void
  startDrag: (event: MouseEvent) => void
  onDoubleClick: () => void
  cleanup: () => void
}

function useSidebarResize(config: SidebarResizeConfig): UseSidebarResizeReturn
```

## 红灯预期

所有 composable 单测因 `import { useSidebarResize } from '../useSidebarResize'` 失败而红灯（模块不存在）。
