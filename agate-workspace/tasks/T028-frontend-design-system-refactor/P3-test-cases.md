---
phase: P3
task_id: T028
task_name: frontend-design-system-refactor
type: test-cases
trace_id: T028-P3-20260629
created: 2026-06-29
status: draft
parent: T028-P2-20260629
---

# T028 Frontend Design System Refactor — P3 Test Cases

## 测试策略

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 组件级 | vitest + Vue Test Utils (jsdom) | 7 个共享组件的 props/emits/slots/render |
| 页面级 | Playwright (CDP) | dark/light 切换、移动端响应式、token 验证、旧组件兼容 |
| 构建级 | gate command | vue-tsc + build + vitest run（TC-47..TC-49，不在测试代码中） |

## BDD 场景 → 测试用例映射

| TC-ID | BDD 场景 | 测试类型 | 预期 | 测试文件 |
|-------|---------|---------|------|----------|
| TC-01 | S1: 页面背景使用 var(--c-bg) | Playwright | Explore 页面 body computed background-color 解析为 --c-bg 对应值 | design-system.spec.ts |
| TC-02 | S1: entry 卡片背景使用 var(--c-surface) | Playwright | entry 卡片 computed background-color 解析为 --c-bg 对应值 | design-system.spec.ts |
| TC-03 | S1: 卡片边框使用 var(--c-border-strong) | Playwright | entry 卡片 border-color 解析为 --c-border-strong 对应值 | design-system.spec.ts |
| TC-04 | S1: 搜索框使用 var(--c-surface-lower) + focus ring | vitest (SearchInput) + Playwright | SearchInput bg 为 --c-surface-lower；focus 时 border-color --c-accent + box-shadow 含 --c-glow | SearchInput.spec.ts + design-system.spec.ts |
| TC-05 | S1: entry 标题使用 var(--c-text) + 16px/600 | Playwright | entry 标题 computed color/font-size/font-weight 正确 | design-system.spec.ts |
| TC-06 | S1: meta 文字使用 var(--c-text-secondary) | Playwright | meta 文字 computed color 解析为 --c-text-secondary 对应值 | design-system.spec.ts |
| TC-07 | S1: hover-only 操作按钮在触控设备始终可见 | vitest (EntryListRow) + Playwright | EntryListRow actions 不被 @media(hover:hover) 隐藏 | EntryListRow.spec.ts + design-system.spec.ts |
| TC-08 | S2: 左侧文件树 width: 240px | Playwright | 文件树侧栏宽度 240px（viewport ≥1024px） | design-system.spec.ts |
| TC-09 | S2: 文件树背景 var(--c-surface-lower) | Playwright | 文件树 computed background-color 解析为 --c-surface-lower 对应值 | design-system.spec.ts |
| TC-10 | S2: 文件树 active 项 rgba(77,141,255,.14) + --c-accent | Playwright | active 项 computed background/color 正确 | design-system.spec.ts |
| TC-11 | S2: 右侧内容渲染区存在 | Playwright | 内容区 DOM 存在且可见 | design-system.spec.ts |
| TC-12 | S2: 操作按钮使用 BaseButton | vitest (BaseButton) | BaseButton variant/size/disabled/focus ring 正确 | BaseButton.spec.ts |
| TC-13 | S2: header 背景 var(--c-surface) + border-bottom var(--c-border) | Playwright | header computed background/border 正确 | design-system.spec.ts |
| TC-14 | S3: 文件树侧栏不可见 | Playwright | viewport ≤640px 时文件树 display:none 或 width:0 | design-system.spec.ts |
| TC-15 | S3: 存在文件下拉选择器 | Playwright | viewport ≤640px 时存在 select/下拉元素 | design-system.spec.ts |
| TC-16 | S3: 底部固定操作栏 var(--c-surface) + safe-area-inset | Playwright | 操作栏 position:fixed + computed bg 正确 | design-system.spec.ts |
| TC-17 | S3: 操作栏按钮高度 ≥44px | Playwright | 按钮计算高度 ≥44px | design-system.spec.ts |
| TC-18 | S4: dark→light 切换后 --c-* token 正确映射 | Playwright | 切换后 computed styles 对应 light 主题值 | design-system.spec.ts |
| TC-19 | S4: 无 hard-coded hex 颜色（除 LandingView） | Playwright + grep | 重构页面 CSS 无 # 开头 6 位颜色值 | design-system.spec.ts |
| TC-20 | S4: 文本对比度满足 WCAG AA | Playwright | body text ≥4.5:1, large text ≥3:1 | design-system.spec.ts |
| TC-21 | S5: LandingView 视觉与重构前一致 | Playwright | LandingView 截图与基线一致（token 提升后无回退） | design-system.spec.ts |
| TC-22 | S5: .stage 局部 token 与全局无冲突 | Playwright | LandingView computed styles 正确，无 token 覆盖异常 | design-system.spec.ts |
| TC-23 | S6: BaseButton 支持 primary/secondary/ghost/danger + small + disabled + focus ring | vitest | 各 variant 渲染正确 class/style；disabled 阻止 click；focus ring 存在 | BaseButton.spec.ts |
| TC-24 | S6: BaseTag 使用 --c-tag-bg + --c-accent-secondary + 6px radius | vitest | 渲染 span 含正确 class；slot 内容显示 | BaseTag.spec.ts |
| TC-25 | S6: BaseBadge 支持 public/private/shared 三种状态色 | vitest | 各 status 渲染对应 class/style | BaseBadge.spec.ts |
| TC-26 | S6: SearchInput 支持 v-model/clear/placeholder/focus | vitest | modelValue 双向绑定；clear emit；placeholder；focus ring | SearchInput.spec.ts |
| TC-27 | S6: EmptyState 包含 icon/heading/description/CTA | vitest | 各 prop 渲染对应元素；cta emit | EmptyState.spec.ts |
| TC-28 | S6: EntryListRow 支持桌面 grid + 移动 stacked + navigate emit | vitest | entry prop 渲染；isOwner 显示 actions；navigate emit | EntryListRow.spec.ts |
| TC-29 | S6: PageHeader 包含 title/backTo/slots | vitest | title 渲染；backTo 链接；meta/actions slots | PageHeader.spec.ts |
| TC-30 | S7: 旧组件（LoginDialog/ConfirmDialog/FileTree/CodeViewer/Pagination）视觉不变 | Playwright | 触发旧组件后 computed styles 仍使用旧 token 别名值 | design-system.spec.ts |
| TC-31 | S8: BaseButton focus ring 可见 | vitest | focus 时 outline: 2px solid --c-accent-secondary; outline-offset: 2px | BaseButton.spec.ts |
| TC-32 | S8: SearchInput focus ring 可见 | vitest | focus 时 box-shadow 含 --c-glow | SearchInput.spec.ts |
| TC-33 | S8: EntryListRow Enter/Space 键激活导航 | vitest | keydown Enter/Space 触发 navigate emit | EntryListRow.spec.ts |
| TC-34 | S9: prefers-reduced-motion 下卡片无 translateY | Playwright | reduced-motion 时 hover 无 transform | design-system.spec.ts |
| TC-35 | S9: prefers-reduced-motion 下按钮无 transform | vitest (BaseButton) | reduced-motion media query 下 hover 无 transform | BaseButton.spec.ts |
| TC-36 | S9: prefers-reduced-motion 下骨架屏无 shimmer | Playwright | reduced-motion 时 shimmer animation: none | design-system.spec.ts |
| TC-37 | S10: API Key 页面背景 var(--c-bg) | Playwright | 页面 computed bg 正确 | design-system.spec.ts |
| TC-38 | S10: API Key 卡片 var(--c-surface) + var(--c-border-strong) | Playwright | 卡片 computed bg/border 正确 | design-system.spec.ts |
| TC-39 | S10: Create Key 按钮使用 BaseButton primary | Playwright | 按钮含 BaseButton primary class | design-system.spec.ts |
| TC-40 | S10: Revoke 按钮使用 BaseButton danger | Playwright | 按钮含 BaseButton danger class | design-system.spec.ts |
| TC-41 | S10: 创建对话框 var(--c-surface) + 14px radius | Playwright | 对话框 computed bg/border-radius 正确 | design-system.spec.ts |
| TC-42 | S10: empty state 使用 EmptyState 组件 | Playwright | 空 key 列表含 EmptyState DOM 结构 | design-system.spec.ts |
| TC-43 | S11: 404 页面背景 var(--c-bg) | Playwright | 页面 computed bg 正确 | design-system.spec.ts |
| TC-44 | S11: 标题使用 var(--c-text) | Playwright | 标题 computed color 正确 | design-system.spec.ts |
| TC-45 | S11: 路径显示 var(--c-text-secondary) + monospace | Playwright | 路径 computed color/font-family 正确 | design-system.spec.ts |
| TC-46 | S11: 返回链接使用 BaseButton secondary | Playwright | 返回按钮含 BaseButton secondary class | design-system.spec.ts |
| TC-47 | S12: vue-tsc --noEmit 退出码 0 | gate | 类型检查通过 | gate command |
| TC-48 | S12: make build-frontend 成功 | gate | 构建成功 | gate command |
| TC-49 | S12: vitest run 全部通过 | gate | 单测全绿 | gate command |

## 红灯分类

所有测试当前应为 **B 类红灯**（import 未实现的组件/页面尚未重构），非 A 类（测试代码 bug）。

- vitest 组件测试：import 路径指向尚未创建的组件文件 → Module not found
- Playwright E2E：页面尚未使用新 token/组件 → computed style 断言失败
