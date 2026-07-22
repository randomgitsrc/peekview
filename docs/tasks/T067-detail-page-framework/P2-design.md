---
phase: P2
task_id: T067-detail-page-framework
type: design
parent: P1-requirements.md
trace_id: T067-P2-20260723
status: draft
created: 2026-07-23
agent: architect
---

# P2 Design — T067 detail-page-framework

## 0. 影响域分析

### 改什么
| 文件 | 改动 |
|------|------|
| `EntryDetailView.vue` | 桌面 header 加品牌字标 + Sign in + Explore; 移动 sticky-header 加品牌 + Sign in + Explore; 移动 bottom-bar 文案修正; reads 计数统一; zen mode 隐藏新增元素 |
| `LandingView.vue` | Sign in 按钮从 btn-ghost btn-sm 升级为 BaseButton variant=primary; ≤380px 不隐藏 Sign in |
| `layout.css` | 新增品牌条/Sign in/Explore 相关 CSS 类; zen mode 规则扩展 |

### 不改什么
- 后端 API — 纯前端改动
- LoginDialog.vue — 复用，不改
- auth.ts — 依赖 T065 修好的 authState 响应式，本任务只消费 authState
- EntryListView.vue — 已有 logo+word+Login+ThemeToggle，不改
- router.ts — 不加新路由
- BaseButton.vue — 已有 variant=primary，直接用

### 风险在哪
- 品牌条占空间：桌面 header 当前 min-height: 56px (--header-height)，加品牌字标不增高度（字标放 logo 旁边，与现有 title-row 同行）
- 移动端 sticky-header 高度 52px，加品牌+Sign in 需紧凑布局，不能溢出
- T065 依赖：若 T065 未完成，Sign in 显隐无法验证——P4/P5 须确认 T065 已合入
- LandingView ≤380px Sign in 消失：当前 `.btn-ghost { display:none }` 是 CSS 规则，改用 BaseButton variant=primary 后需确保该规则不误杀

## 1. 候选方案

### 方案 A: 品牌字标内嵌 header（推荐）

**核心思路**：品牌字标 "PeekView" 放在桌面 header 的 logo 旁边（与现有 SVG 图标同行），移动端 sticky-header 加微型品牌标识。Sign in 放 actions-area（桌面）/ sticky-header 右侧（移动）。Explore 放 actions-area（桌面）/ bottom-bar（移动）。

**桌面端布局**：
```
[SVG logo] [PeekView] [title──────] [Sign in] [Explore] [actions...] [ThemeToggle]
```
- logo + "PeekView" 字标在 title-row 左侧，与现有 detail-logo 同行
- "PeekView" 字标 font-size: 16px, font-weight: 700, letter-spacing: -0.02em（与 EntryListView 的 explore-logo-word 一致）
- Sign in 按钮：BaseButton variant=primary size=small，v-if="authState === 'anonymous'"
- Explore：router-link to="/explore"，icon-btn 样式 + Compass icon + tooltip "Explore"
- 品牌区域总高度 = title-row 高度 ≤ 36px（logo 28px + padding，不超限）

**移动端布局**：
```
sticky-header: [←] [PeekView] [────] [Sign in]
bottom-bar:    [2 files] [spacer] [Explore] [TOC] [Copy] [Share] [···]
```
- sticky-header: back-btn + "PeekView" 字标（替代 sticky-title，或字标+标题共存——字标在左，标题截断在右）
- Sign in: 紧凑按钮，v-if="authState === 'anonymous'"，放在 sticky-header 最右
- Explore: 放 bottom-bar，icon-btn 样式，Compass icon
- ≤380px: Sign in 用 icon-only 按钮（人形图标），不隐藏

**zen mode**：品牌字标和 Sign in 在 header 内，zen mode 隐藏 header 时自动隐藏。

**首页 Sign in**：LandingView 的 Sign in 从 `btn btn-ghost btn-sm` 改为 `BaseButton variant="primary" size="small"`，≤380px 不隐藏（去掉 `.btn-ghost { display:none }` 规则，改用更精确的选择器或直接用 BaseButton）。

**reads 计数统一**：移动端 meta-tags-bar 的 reads 格式改为与桌面一致——条件复数 + readStats 为 null 时不显示。

**移动端底栏文案**：`Files <badge>N</badge>` → `<badge>N</badge> files`。

**优点**：
- 品牌字标融入现有 header，不新增独立条带，零额外垂直空间
- 与 EntryListView 的 header 模式一致（logo+word+actions），用户心智模型统一
- zen mode 自动隐藏，无需额外处理
- 移动端 sticky-header 改动最小，只加字标+Sign in

**风险**：
- 桌面 title-row 已有 logo+title+actions，加品牌字标+Sign in+Explore 可能拥挤——但字标在 logo 旁（~70px），Sign in/Explore 在 actions-area（已有空间），实际不挤
- 移动端 sticky-header 52px 内放 back-btn+字标+Sign in，需字标和按钮都紧凑

**工作量**：中等——主要改 EntryDetailView.vue template + style，LandingView.vue 小改

### 方案 B: 独立品牌条带

**核心思路**：在 detail-header 上方新增一条极窄品牌条（~28px），包含 logo+字标+Sign in+Explore。桌面和移动端共用此条。

**桌面端布局**：
```
[brand-bar: SVG logo PeekView ──── Sign in Explore ThemeToggle]  ← 28px
[detail-header: title ──── actions]                                ← 56px
```

**移动端布局**：
```
[brand-bar: SVG PeekView ── Sign in]  ← 28px
[sticky-header: ← title]              ← 52px
[bottom-bar: 2 files ... Explore]     ← 48px
```

**优点**：
- 品牌条独立，视觉层次清晰
- 品牌条可全局复用（未来其他页面也加）

**风险**：
- 额外占 28px 垂直空间，内容区被挤压——P0 明确"不能挤压内容区"
- 移动端品牌条+sticky-header+bottom-bar = 128px，占 375px 屏幕的 34%，过高
- zen mode 需额外隐藏品牌条（不在 header 内，需新增 CSS 规则）
- 品牌条与 detail-header 视觉分离，可能显得割裂

**工作量**：较高——需新增品牌条组件/模板，调整 layout.css 多处

### 方案 C: 浮动品牌徽章

**核心思路**：品牌标识为固定定位的浮动徽章（左上角或左下角），不占文档流空间。

**优点**：
- 不占垂直空间
- 视觉独特

**风险**：
- 固定定位遮挡内容——移动端尤其严重
- 与 zen mode 交互复杂（zen mode 应隐藏但浮动元素需额外处理）
- 不符合常规 web 页面模式，用户可能困惑
- Sign in/Explore 放浮动徽章内不自然

**工作量**：中等——但交互复杂度高

### 权衡与选择理由

| 维度 | 方案 A (内嵌 header) | 方案 B (独立条带) | 方案 C (浮动徽章) |
|------|---------------------|-------------------|-------------------|
| 垂直空间 | 0 额外 | +28px | 0 额外 |
| 移动端友好 | 好 | 差 (128px chrome) | 差 (遮挡) |
| zen mode | 自动隐藏 | 需额外处理 | 需额外处理 |
| 一致性 | 与 EntryListView 一致 | 新模式 | 新模式 |
| 实现复杂度 | 中 | 高 | 中 |
| 品牌识别 | 好 (字标在 header) | 好 (独立条) | 一般 (小徽章) |

**选择方案 A**：零额外垂直空间 + 与现有 EntryListView header 模式一致 + zen mode 自动隐藏 + 移动端友好。方案 B 的额外 28px 违反 P0 "不能挤压内容区"约束；方案 C 的浮动定位在移动端遮挡内容且交互不自然。

## 2. 详细设计

### 2.1 桌面端 header 改动

**EntryDetailView.vue title-row**（当前 line 14-73）：

在 detail-logo 的 router-link 内，SVG 后加 `<span class="detail-logo-word">PeekView</span>`：
```html
<router-link to="/" class="detail-logo" title="Back to home">
  <svg .../>
  <span class="detail-logo-word">PeekView</span>
</router-link>
```

在 actions-area 内，ThemeToggle 前加：
```html
<BaseButton
  v-if="authState === 'anonymous'"
  variant="primary"
  size="small"
  @click="showLogin = true"
>Sign in</BaseButton>
<router-link to="/explore" class="icon-btn" title="Explore">
  <CompassIcon :size="16" />
  <span class="tooltip">Explore</span>
</router-link>
```

**CSS**：
```css
.detail-logo-word {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.02em;
}
.detail-logo:hover .detail-logo-word {
  color: var(--c-accent);
}
```

品牌区域高度 = logo SVG 28px，字标 line-height ~20px，均在 title-row 的 align-items: center 内，总高度 ≤ 36px。

### 2.2 移动端 sticky-header 改动

**EntryDetailView.vue mobile-sticky-header**（当前 line 5-10）：

```html
<div v-if="isMobile" class="mobile-sticky-header">
  <router-link to="/" class="back-btn" aria-label="Back">
    <ChevronLeftIcon :size="20" />
  </router-link>
  <span class="sticky-brand">PeekView</span>
  <span class="sticky-title">{{ entryTitle }}</span>
  <BaseButton
    v-if="authState === 'anonymous'"
    variant="primary"
    size="small"
    class="mobile-signin-btn"
    @click="showLogin = true"
  >Sign in</BaseButton>
</div>
```

- `sticky-brand`: font-size: 13px, font-weight: 700, flex-shrink: 0, color: var(--c-text)
- `sticky-title`: flex: 1, 截断如现
- `mobile-signin-btn`: ≤380px 时切换为 icon-only（人形图标），确保不消失

**≤380px 处理**：
```css
@media (max-width: 380px) {
  .mobile-signin-btn .btn-label { display: none; }
  .mobile-signin-btn .btn-icon { display: inline-flex; }
}
```
默认 Sign in 按钮显示文字，≤380px 只显示图标。BaseButton 需支持 slot 放图标——或直接用原生 button + icon，不依赖 BaseButton 的 slot 机制。

**简化方案**：移动端 Sign in 直接用原生 button，不依赖 BaseButton：
```html
<button
  v-if="authState === 'anonymous'"
  class="mobile-signin-btn"
  @click="showLogin = true"
>
  <LogInIcon :size="14" class="signin-icon" />
  <span class="signin-label">Sign in</span>
</button>
```
CSS: ≤380px 时 `.signin-label { display: none }`。

### 2.3 移动端 bottom-bar Explore 入口

在 mobile-bottom-bar 的 files-btn 后、flex-spacer 前加：
```html
<router-link to="/explore" class="bottom-btn" aria-label="Explore">
  <CompassIcon :size="14" /> Explore
</router-link>
```

### 2.4 移动端底栏文案修正

当前（line 237）：
```html
<FolderIcon :size="14" /> Files <span class="badge">{{ currentEntry?.files.length ?? 0 }}</span>
```

改为：
```html
<FolderIcon :size="14" /> <span class="badge">{{ currentEntry?.files.length ?? 0 }}</span> files
```

### 2.5 reads 计数格式统一

**桌面端**（line 96，已正确）：
```html
<span v-if="currentEntry?.readStats">{{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}</span>
```

**移动端**（line 223，需修正）：
当前：`{{ currentEntry?.readStats?.totalCount ?? 0 }} reads`
改为：与桌面一致——条件复数 + readStats 为 null 时不显示
```html
<span v-if="currentEntry?.readStats">{{ currentEntry.readStats.totalCount }} read{{ currentEntry.readStats.totalCount !== 1 ? 's' : '' }}</span>
```

### 2.6 首页 Sign in 视觉权重

**LandingView.vue**（当前 line 20）：
```html
<button class="btn btn-ghost btn-sm" @click="showLogin = true">Sign in</button>
```

改为：
```html
<BaseButton variant="primary" size="small" @click="showLogin = true">Sign in</BaseButton>
```

**≤380px 问题**：当前 LandingView 的 CSS（line 446）`.btn-ghost { display:none }` 会隐藏 btn-ghost 按钮。改用 BaseButton variant=primary 后，按钮类名变为 `base-button btn-primary btn-small`，不受 `.btn-ghost` 规则影响，自动解决 ≤380px 消失问题。

需确认：LandingView 的 `@media (max-width:380px)` 规则中 `.btn-ghost { display:none }` 是否还有其他 btn-ghost 按钮需要隐藏——检查代码，LandingView 只有一个 Sign in 用 btn-ghost，改为 primary 后该规则可删除或保留（不影响）。

### 2.7 authState loading 态

Sign in 按钮条件：`v-if="authState === 'anonymous'"`。
authState 在 initializing 时为 'loading'，不满足 'anonymous'，Sign in 自动隐藏——无需额外处理。

### 2.8 zen mode

品牌字标和 Sign in 在 header 内（桌面 detail-header / 移动 mobile-sticky-header），zen mode 已有规则：
```css
.zen-mode .detail-header { display: none; }
```
移动端需新增：
```css
.zen-mode .mobile-sticky-header { display: none; }
.zen-mode .mobile-bottom-bar { display: none; }
```
（当前 zen mode 只隐藏了 detail-header，移动端 sticky-header 和 bottom-bar 未隐藏——这是一个现有 bug，本任务一并修复。）

### 2.9 LoginDialog 集成

EntryDetailView 需引入 LoginDialog：
```html
<LoginDialog v-model:visible="showLogin" :allow-registration="true" />
```
新增 ref：`const showLogin = ref(false)`

### 2.10 新增 import

- `LoginDialog` from `@/components/LoginDialog.vue`
- `BaseButton` from `@/components/BaseButton.vue`
- `Compass` icon from `lucide-vue-next`（Explore 图标）
- `LogIn` icon from `lucide-vue-next`（移动端 Sign in 图标，≤380px 用）
- `storeToRefs` from `pinia`（已有，需解构 authState）

## 3. 完成标志

- [ ] 桌面端 header 可见 "PeekView" 品牌字标（logo 旁），高度 ≤ 36px
- [ ] 桌面端 header 可见 Sign in 按钮（匿名时），点击弹出 LoginDialog
- [ ] 桌面端 header 可见 Explore 按钮，点击导航到 /explore
- [ ] 移动端 sticky-header 可见 "PeekView" 字标 + Sign in
- [ ] 移动端 ≤380px Sign in 仍可见（icon-only）
- [ ] 移动端 bottom-bar 可见 Explore 入口
- [ ] 移动端底栏文案 "N files" 格式
- [ ] reads 计数桌面/移动格式一致，null 时不显示
- [ ] 首页 Sign in 使用 primary 样式，≤380px 可见
- [ ] 登录后 Sign in 按钮消失（响应式）
- [ ] authState loading 时 Sign in 不可见
- [ ] zen mode 下品牌字标 + Sign in + Explore 均隐藏

## 4. 声明字段

```yaml
packages:
  - frontend-v3
domains:
  - frontend
ui_affected: true
ui_interaction_points:
  - 桌面端 header Sign in 按钮 → LoginDialog
  - 桌面端 header Explore 按钮 → /explore 导航
  - 移动端 sticky-header Sign in 按钮 → LoginDialog
  - 移动端 bottom-bar Explore 按钮 → /explore 导航
  - 首页 Sign in 按钮 → LoginDialog
  - 桌面端 tooltip hover (file tree / TOC / Copy / Explore)
gate_commands:
  P5: "make test-frontend && make typecheck"
  P5_e2e: "E2E_SPEC=e2e/detail-framework.spec.ts make debug-test"
  P6: "make test-frontend && make typecheck"
env_constraints:
  debug_env: "make debug-restart (127.0.0.1:8888, /tmp/peekview-debug/)"
  isolation_check: "sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' — 确认 debug DB 有数据"
  depends_on: "T065 (authState 响应式) — P4 前须确认 T065 已合入"
```

## 5. files_to_read

```yaml
files_to_read:
  - path: frontend-v3/src/views/EntryDetailView.vue
    why: 主改动文件 — template + script + style 全部需改
  - path: frontend-v3/src/views/LandingView.vue:19-21
    why: Sign in 按钮改为 BaseButton primary
  - path: frontend-v3/src/views/LandingView.vue:440-458
    why: ≤380px 媒体查询，确认 btn-ghost 规则影响范围
  - path: frontend-v3/src/styles/layout.css:1-30
    why: detail-header / title-row 布局，品牌字标 CSS 加在此
  - path: frontend-v3/src/styles/layout.css:307-348
    why: mobile-sticky-header 布局，品牌+Sign in CSS 加在此
  - path: frontend-v3/src/styles/layout.css:420-513
    why: mobile-bottom-bar 布局，Explore + files 文案 CSS
  - path: frontend-v3/src/styles/layout.css:564-569
    why: zen mode 规则，需扩展移动端隐藏
  - path: frontend-v3/src/stores/auth.ts:11-15
    why: authState computed 逻辑，确认 loading/anonymous/authenticated 状态
  - path: frontend-v3/src/components/BaseButton.vue
    why: 复用 variant=primary size=small
  - path: frontend-v3/src/components/LoginDialog.vue:118-122
    why: v-model:visible + allow-registration props
  - path: frontend-v3/src/views/EntryListView.vue:3-29
    why: 参考 header 模式 (logo+word+Login+ThemeToggle)
  - path: frontend-v3/src/styles/variables.css:30
    why: --header-height: 56px，确认品牌区域高度约束
```

## 6. minimal_validation

```yaml
minimal_validation:
  assumption: "品牌字标放在 detail-logo router-link 内不增加 title-row 高度 (≤36px)"
  method: "检查现有 title-row: align-items:center, logo SVG 28px, 字标 font-size:16px → line-height ~20px, 均在 28px 高度内，不超 36px"
  result: "confirmed"
  note: "title-row 已有 align-items:center, logo 28px 是最高元素, 16px 字标 line-height ~20px < 28px, 不增加行高。与 EntryListView 的 explore-logo-word (font-size:20px) 模式一致但更紧凑"
```

```yaml
minimal_validation:
  assumption: "LandingView ≤380px .btn-ghost { display:none } 改用 BaseButton primary 后自动不受影响"
  method: "检查 BaseButton 渲染的 CSS 类: base-button btn-primary btn-small — 不含 btn-ghost, 不匹配隐藏规则"
  result: "confirmed"
  note: "BaseButton variant=primary 渲染 class='base-button btn-primary btn-small', LandingView 的 @media (max-width:380px) .btn-ghost { display:none } 不匹配"
```

```yaml
minimal_validation:
  assumption: "zen mode 当前只隐藏 .detail-header, 移动端 sticky-header 和 bottom-bar 未隐藏"
  method: "grep layout.css zen-mode 规则: line 564-569 只隐藏 .detail-header, .file-sidebar, .toc-sidebar, .mobile-actions — 无 .mobile-sticky-header 和 .mobile-bottom-bar"
  result: "confirmed"
  note: "这是现有 bug, 本任务一并修复: .zen-mode .mobile-sticky-header, .zen-mode .mobile-bottom-bar { display: none }"
```

## 7. [SCOPE+] 发现

```yaml
[SCOPE+] 发现: zen mode 未隐藏移动端 mobile-sticky-header 和 mobile-bottom-bar
         必须做的理由: BDD-12 要求 zen mode 下品牌标识和 Sign in 不可见, 但当前 zen mode 只隐藏桌面端 header, 移动端 sticky-header (含品牌+Sign in) 和 bottom-bar (含 Explore) 仍可见
         影响: layout.css 需新增 2 条 zen mode 规则; BDD-12 验收范围扩展到移动端
         packages: [frontend-v3]
```

## 8. coupling_checklist

```yaml
coupling_checklist:
  - [api-schema: checked] — 纯前端改动, 不改后端 API
  - [auth-state: checked] — 依赖 authState computed (loading/anonymous/authenticated), T065 须先完成
  - [router: checked] — 不加新路由, Explore 用现有 /explore
  - [component-reuse: checked] — LoginDialog/BaseButton/ThemeToggle 复用, 不改
  - [css-scope: checked] — 新增 CSS 在 layout.css (全局) 和 EntryDetailView.vue scoped, 不冲突
  - [zen-mode: checked] — 需扩展 zen mode 规则覆盖移动端
```
