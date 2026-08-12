---
phase: P2
task_id: T065
type: review
parent: P2-design.md
trace_id: T065-P2-review-20260722
status: approved
created: 2026-07-22
agent: plan-design-review
---

# T065 P2 设计评审

## 审查清单

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 候选方案 ≥2 | PASS | 3 个候选方案（A/B/C），满足 ≥2 要求 |
| 权衡分析 | PASS | 6 维度对比表（改动量/根治层/依赖/风险/语义/路径），每方案优缺点独立列出 |
| 选择理由 | PASS | 5 条理由，逐条对应权衡维度，无循环论证 |
| 四字段齐全 | PASS | packages/domains/ui_affected/gate_commands 均有 |
| gate_commands.P5_e2e | PASS | `E2E_SPEC=e2e/landing-auth.spec.ts make debug-test` |
| BDD 覆盖映射 | PASS | 6/6 BDD 均有方案覆盖说明 |
| 根因与代码一致 | PASS | 源码验证确认（见下方） |

## 源码验证

逐项核对 P2 声明与实际代码：

| P2 声明 | 源码位置 | 一致 |
|---------|---------|------|
| `app.use(router)` 在 `fetchMe` 之前 | `main.ts:20` vs `main.ts:24` | YES |
| `app.mount` 在 `fetchMe` 完成后 | `main.ts:24-25` `fetchMe().finally(() => app.mount('#app'))` | YES |
| LandingView watch 无 immediate | `LandingView.vue:206` `watch(authState, (state) => { ... })` 无第三参数 | YES |
| Sign in 按钮无条件渲染 | `LandingView.vue:19` `<button ... @click="showLogin = true">Sign in</button>` 无 v-if | YES |
| beforeEach 对 loading 不重定向 | `router.ts:61` 只检查 `=== 'authenticated'` | YES |
| authState computed: initializing→loading | `auth.ts:11-12` | YES |
| @vueuse/core 不在 package.json | `package.json` grep 结果 0 | YES |
| EntryListView 有认证态 UI 模式 | `EntryListView.vue:9-26` v-if/v-else-if 模式 | YES |

## 评分维度（0-10）

| 维度 | 评分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 8 | loading/anonymous/authenticated 三态均有处理方案；loading 态 UI（两个 template 都不匹配，只显示 ThemeToggle）在设计中说明但未显式写入 BDD 验收——BDD-6 覆盖了"正常渲染"但未指定 loading 态具体 UI 元素。可接受，因 loading 态极短 |
| AI Slop 风险 | 9 | 方案 A 改动极小（1 行 watch + 模板条件渲染），无"随便搞"空间。Sign in 条件渲染参照 EntryListView 现有模式，无设计自由度 |
| 移动端考虑 | 7 | LandingView 已有 `@media (max-width:860px)` 响应式样式。新增的 user-menu 组件需适配移动端——P2 提到"样式从 EntryListView.vue 复制，适配 LandingView 的设计系统变量"，但未显式说明移动端适配策略。EntryListView 的 user-menu 样式使用 CSS 变量，天然响应式，风险低 |
| 可访问性 | 6 | Sign in 按钮无 ARIA 变更（仍是 button，语义正确）。用户菜单 dropdown 缺少 `aria-expanded`/`aria-haspopup` 属性——但这是 EntryListView 的既有问题，非本任务引入。LandingView 的 watch 跳转对屏幕阅读器无影响（路由变化由 Vue Router 处理） |

## 方案审查细节

### 方案 A（选定方案）

**优点确认**：
- 改动量确实最小：`LandingView.vue:206` 加 `{ immediate: true }` + 模板条件渲染
- `immediate: true` 是 Vue 惯用模式，语义清晰
- 单一路径覆盖全页加载和 SPA 登录，无冗余

**风险确认**：
- P2 声明"watch immediate + router.replace 重复调用"风险已分析，结论正确：`authState` 从 `'authenticated'` 不再变化，immediate 只触发一次
- P2 声明"loading 态 UI"风险已分析，结论正确：loading 态极短，BDD-6 覆盖

**一个注意点**：P2 的 Sign in 条件渲染详细设计中，`v-if="authState === 'anonymous'"` 和 `v-else-if="authState === 'authenticated'"` 之间，`authState === 'loading'` 时两个 template 都不渲染，只显示 ThemeToggle。这是正确行为（BDD-6 要求 fetchMe 期间 landing 正常渲染），但 P4 implementer 应确保 loading 态下 nav-cta 布局不崩（ThemeToggle 独占时 flex 布局应正常）。

### 方案 B（beforeEach async）

**排除理由确认**：
- `@vueuse/core` 确认不在 package.json，需新增依赖或手写等待逻辑
- 异步守卫对其他路由的首屏影响是真实风险
- 当前 beforeEach 对 loading 态不重定向是正确行为（BDD-6），不需要修改守卫

### 方案 C（onMounted）

**排除理由确认**：
- 双路径（onMounted + watch）确实冗余，方案 A 的 immediate 单路径更清晰
- onMounted 和 watch 理论上不会同时触发（mount 时 authState 已确定，watch immediate=false 不触发），但语义上两条路径做同一件事不够干净

## BDD 覆盖逐条验证

| BDD | P2 覆盖 | 评审判定 |
|-----|---------|---------|
| BDD-1: 已认证全页加载重定向 | watch immediate 触发 `router.replace('/explore')` | PASS — immediate 在 watch 注册时检查当前 authState，全页加载时 authState 已为 'authenticated'，immediate 回调触发跳转 |
| BDD-2: 匿名态 Sign in 可见 | `v-if="authState === 'anonymous'"` | PASS |
| BDD-3: 已认证态 Sign in 不可见 | `v-else-if="authState === 'authenticated'"` 替换为用户菜单 | PASS — Sign in 按钮在 authenticated 态不渲染 |
| BDD-4: 已认证态可见用户标识 | 用户菜单含 `userName` | PASS |
| BDD-5: 匿名登录后跳转不回归 | watch 仍覆盖 anonymous→authenticated 变化 | PASS — immediate 不影响后续 watch 触发；immediate 只在注册时触发一次，后续 authState 变化仍由 watch 正常捕获 |
| BDD-6: fetchMe 期间正常渲染 | loading 态两个 template 都不渲染 | PASS — landing 首屏内容（hero section 等）不受 nav-cta 条件渲染影响 |

## 四字段审查

```yaml
packages:
  - frontend-v3/src/views/LandingView.vue  # 主要修改
  - frontend-v3/src/router.ts              # 确认不需要修改
```

**注意**：`router.ts` 列在 packages 中但方案 A 不修改它。这是合理的——列出是为了 P4 implementer 确认不需要修改，不是遗漏。

domains: [frontend] — 正确，纯前端 bug
ui_affected: true — 正确
gate_commands: P5 + P5_e2e 齐全 — 正确

## 综合评定

**status: approved**

方案 A（watch immediate + Sign in 条件渲染）是三个候选方案中改动最小、风险最低、语义最清晰的选择。根因分析经源码验证准确，BDD 覆盖完整，权衡分析充分。

P4 implementer 注意事项：
1. loading 态下 nav-cta 布局验证（ThemeToggle 独占时 flex 布局）
2. 用户菜单样式从 EntryListView.vue 复制时需适配 LandingView 的 CSS 变量体系（LandingView 使用自定义 CSS 变量而非 design system 变量）
3. `router.ts` 不需要修改
