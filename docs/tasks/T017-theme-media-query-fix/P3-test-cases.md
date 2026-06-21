---
phase: P3
task_id: T017
task_name: theme-media-query-fix
trace_id: T017-P3-2026-06-21
parent: T017-P1-2026-06-21
type: test-cases
created: 2026-06-21
status: ready
---

# P3 测试用例：主题切换 @media 冲突修复

## 门槛说明（重要）

本任务的 bug 在 **CSS 层**（`github-markdown-css` 的 `@media (prefers-color-scheme: dark)` 越权），不在 store 逻辑层。`frontend-v3/src/stores/theme.ts` 的 `getInitialTheme` / `setTheme` / `toggle` 逻辑本身正确——它确实把 `data-theme` 属性写到了 `document.documentElement`，也确实优先读 localStorage。

因此 P3 单元测试的目标是**回归守护**：锁定 store 层现有正确行为，防止 P4 改 CSS 时误改 store。预期**全绿**（不是 TDD 传统红灯），因为测的是现有 store 逻辑，bug 在 CSS 层无法被 jsdom 单测覆盖。

**BDD 的真正验收在 P6**——必须用 Playwright `page.emulateMedia({ colorScheme: 'dark' })` + vision 截图实跑，jsdom 无法模拟 `@media (prefers-color-scheme)` 对渲染的影响。

## BDD → 测试用例映射

| BDD | 描述 | P3 单测覆盖 | P6 Playwright 覆盖 |
|-----|------|-------------|---------------------|
| BDD-1 | 系统黑夜 + data-theme=light → 内容区 light | TC-01（store 层：localStorage 优先于 system dark） | ✅ 必须 |
| BDD-2 | 系统白天 + data-theme=dark → 内容区 dark | TC-02（store 层：无 localStorage 时跟随 system） | ✅ 必须 |
| BDD-3 | 切换主题后内容区即时跟随 | TC-03（setAttribute）+ TC-05（toggle） | ✅ 必须 |
| BDD-4 | Shiki 代码块跟随 data-theme | ❌ 渲染层，jsdom 无法测 | ✅ 必须 |
| BDD-5 | Mermaid/PlantUML 跟随 data-theme | ❌ 渲染层，jsdom 无法测 | ✅ 必须 |
| BDD-6 | 无 data-theme 默认 light 不回归 | ❌ store 总是设 data-theme，无此分支 | ✅ 必须 |

## 测试用例清单

测试文件：`frontend-v3/src/composables/__tests__/theme.spec.ts`

### TC-01：getInitialTheme — localStorage 优先于 system preference
- **对应 BDD**：BDD-1（store 层）
- **Given** localStorage 已设为 `'light'`，系统 matchMedia 返回 dark（`matches: true`）
- **When** `useThemeStore()` 初始化
- **Then** `store.theme === 'light'`
- **意义**：用户显式选 light 时，store 不会因系统黑夜而覆盖。CSS 层是否尊重此 `data-theme=light` 由 P6 验。

### TC-02：getInitialTheme — 无 localStorage 时跟随 system preference
- **对应 BDD**：BDD-2（store 层反向）
- **Given** localStorage 为空
- **Subcase a**：matchMedia `matches: true`（系统 dark）→ `store.theme === 'dark'`
- **Subcase b**：matchMedia `matches: false`（系统 light）→ `store.theme === 'light'`
- **意义**：无用户偏好时跟随系统，是 BDD-2 的前提。

### TC-03：setTheme — 更新 data-theme 属性到 document.documentElement
- **对应 BDD**：BDD-3（store 层：切换即写入 DOM）
- **Given** store 已初始化
- **When** `store.setTheme('dark')`
- **Then** `document.documentElement.setAttribute` 被以 `('data-theme', 'dark')` 调用
- **意义**：保证切换后 DOM 属性立即更新，CSS `[data-theme=xxx]` 选择器才能命中。初始化时的 setAttribute 调用需 `mockClear` 排除。

### TC-04：setTheme — 持久化到 localStorage
- **对应 BDD**：BDD-3（store 层：切换后状态留存）
- **Given** store 已初始化
- **When** `store.setTheme('dark')` + `await nextTick()`
- **Then** `localStorage.getItem('peekview-theme') === 'dark'`
- **意义**：保证刷新后主题不丢失。watch 回调异步触发，需 nextTick。

### TC-05：toggle — light↔dark 切换
- **对应 BDD**：BDD-3（store 层：toggle 语义）
- **Given** store 初始 theme 为 `'light'`
- **When** `store.toggle()` 两次
- **Then** 第一次后 `'dark'`，第二次后 `'light'`
- **意义**：切换按钮的核心语义，双向可逆。

## Mock 策略

- `vi.stubGlobal('matchMedia', ...)`：返回 `{ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }`，控制系统主题偏好
- `vi.spyOn(document.documentElement, 'setAttribute')`：监控 DOM 属性写入
- `localStorage.clear()` in `beforeEach`：jsdom 默认提供 localStorage，但需清理前序测试残留
- `setActivePinia(createPinia())` in `beforeEach`：每个测试用独立 pinia 实例，避免 store 缓存污染

## 预期结果

- vitest 收集成功（无语法错误）
- 5 个测试用例**全绿**（store 逻辑正确）
- bug 的真正验证移交 P6 Playwright + vision

## 门槛判定

- ✅ 测试代码能被 vitest 收集
- ✅ 每条 P1 BDD（store 层可覆盖部分）有对应测试用例
- ✅ BDD-4/5/6（纯渲染层）明确移交 P6，本阶段不强行造红灯
- ⚠️ 非 TDD 传统红灯——因 bug 在 CSS 层而非 store 层，单测无法触达；P6 是真正的红灯→绿灯闭环
