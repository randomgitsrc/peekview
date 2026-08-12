---
phase: P7
task_id: T067-detail-page-framework
type: consistency
parent: P6-acceptance.md
trace_id: T067-P7-20260723
status: draft
created: 2026-07-23
agent: architect
---

# P7 Consistency — T067 detail-page-framework

## 1. DESIGN_GAP 配对审查

### DESIGN_GAP 1: 移动端 Sign in 用原生 button 而非 BaseButton

**原始标记行**（P4-implementation.md line 62）：
> [DESIGN_GAP: P2 §2.2 suggested BaseButton for mobile Sign in but also suggested native button as "simplified approach". Implemented native button approach per P2's own simplification note — BaseButton doesn't support icon+label slot pattern needed for ≤380px icon-only fallback.]

**审查**：
- P2 §2.2 确实先建议 BaseButton variant=primary，随后在同节给出"简化方案"用原生 button + CSS 控制 ≤380px icon-only
- BaseButton 当前不支持 icon+label slot 切换模式，原生 button 是唯一可行方案
- 实现与 P2 自身的简化建议一致，功能等价（primary 样式 + ≤380px icon-only）
- P2 §2.2 源文件节名：P2§2.2

> [DESIGN_GAP_REVIEWED: 已确认] — P2 自身提供了简化方案，实现选择合理。原生 button 功能等价于 BaseButton，≤380px icon-only 行为正确。

### DESIGN_GAP 2: zen mode 用 v-show 而非纯 CSS

**原始标记行**（P4-implementation.md line 64）：
> [DESIGN_GAP: P2 §2.8 zen mode specified CSS-only hiding. Implemented v-show="!zenMode" on header elements because jsdom test environment doesn't apply global CSS rules, making isVisible() checks fail. v-show is functionally equivalent (sets display:none) and works in both jsdom and real browsers. layout.css zen-mode rules retained as belt-and-suspenders for real browser.]

**审查**：
- P2 §2.8 设计为纯 CSS 隐藏（`.zen-mode .detail-header { display: none }` 等）
- 实现采用双重机制：v-show="!zenMode"（template 层）+ layout.css zen-mode 规则（CSS 层）
- v-show 在 jsdom 中可被测试框架检测（设置 display:none inline style），CSS 规则在真实浏览器中生效
- 双重机制不冲突：v-show 设 inline display:none，CSS 规则也设 display:none，两者叠加无副作用
- P2 §2.8 源文件节名：P2§2.8

> [DESIGN_GAP_REVIEWED: 已确认] — v-show 是为 jsdom 测试兼容的务实选择，CSS 规则保留作为真实浏览器兜底。功能等价，无副作用。

## 2. 双向一致性检查

### 方向 1：设计→实现

| P2 设计项 | P4 实现 | 一致性 |
|-----------|---------|--------|
| §2.1 桌面 header 加 detail-logo-word "PeekView" | EntryDetailView.vue line 26: `<span class="detail-logo-word">PeekView</span>` | ✅ 一致 |
| §2.1 桌面 header Sign in: BaseButton variant=primary size=small | EntryDetailView.vue line 82-87: `<BaseButton variant="primary" size="small">` | ✅ 一致 |
| §2.1 桌面 header Explore: router-link + CompassIcon + tooltip | EntryDetailView.vue line 88-91: `<router-link to="/explore" class="icon-btn">` + CompassIcon + tooltip | ✅ 一致 |
| §2.1 detail-logo-word CSS: font-size 16px, font-weight 700, letter-spacing -0.02em | layout.css line 33-38: 完全匹配 | ✅ 一致 |
| §2.2 移动 sticky-brand "PeekView" | EntryDetailView.vue line 9: `<span class="sticky-brand">PeekView</span>` | ✅ 一致 |
| §2.2 移动 Sign in: 原生 button + LogInIcon + signin-label | EntryDetailView.vue line 11-18: 原生 button + LogInIcon + signin-label | ✅ 一致（见 DESIGN_GAP 1） |
| §2.2 sticky-brand CSS: font-size 13px, font-weight 700, flex-shrink 0 | layout.css line 362-367: 完全匹配 | ✅ 一致 |
| §2.2 mobile-signin-btn CSS + ≤380px .signin-label hide | layout.css line 369-394: 完全匹配 | ✅ 一致 |
| §2.3 移动 bottom-bar Explore: router-link + CompassIcon | EntryDetailView.vue line 260-262: `<router-link to="/explore" class="bottom-btn">` + CompassIcon | ✅ 一致 |
| §2.4 底栏文案 "N files" 格式 | EntryDetailView.vue line 257: `<span class="badge">N</span> files` | ✅ 一致 |
| §2.5 reads 计数条件复数 + null 不显示 | EntryDetailView.vue line 116, 243: `v-if="currentEntry?.readStats"` + 条件复数 | ✅ 一致 |
| §2.6 LandingView Sign in: BaseButton variant=primary size=small | LandingView.vue line 20: `<BaseButton variant="primary" size="small">` | ✅ 一致 |
| §2.6 ≤380px .btn-ghost 规则不影响 BaseButton | LandingView.vue line 447: `.btn-ghost { display:none }` 仍存在但不匹配 BaseButton 类名 | ✅ 一致 |
| §2.7 authState loading 态 Sign in 隐藏 | v-if="authState === 'anonymous'" — loading 不满足条件，自动隐藏 | ✅ 一致 |
| §2.8 zen mode CSS 规则扩展移动端 | layout.css line 610-617: +.mobile-sticky-header +.mobile-bottom-bar | ✅ 一致 |
| §2.8 zen mode v-show | EntryDetailView.vue line 5, 22, 255: v-show="!zenMode" | ⚠️ 偏差（见 DESIGN_GAP 2，已 REVIEWED） |
| §2.9 LoginDialog 集成 | EntryDetailView.vue line 342: `<LoginDialog v-model:visible="showLogin" :allow-registration="true" />` | ✅ 一致 |
| §2.10 新增 import | EntryDetailView.vue line 377-390: LoginDialog, BaseButton, CompassIcon, LogInIcon, storeToRefs | ✅ 一致 |

### 方向 2：实现→设计

| 实现项 | P2 设计覆盖 | 一致性 |
|--------|------------|--------|
| EntryDetailView.vue: authState storeToRefs 解构 | §2.10 提到 storeToRefs | ✅ 一致 |
| EntryDetailView.vue: showLogin ref | §2.9 提到 `const showLogin = ref(false)` | ✅ 一致 |
| LandingView.vue: import BaseButton | §2.6 提到 | ✅ 一致 |
| LandingView.vue: ≤380px .btn-ghost 规则保留 | §2.6 提到"可删除或保留（不影响）" | ✅ 一致 |
| layout.css: .detail-logo-word hover 变色 | §2.1 CSS 提到 `.detail-logo:hover .detail-logo-word { color: var(--c-accent) }` | ✅ 一致 |
| layout.css: zen-mode 规则含 .mobile-sticky-header + .mobile-bottom-bar | §2.8 + §7 SCOPE+ | ✅ 一致 |
| __tests__/landing-auth.spec.ts: selector 更新 | P2 未提及测试文件改动 | [EXTENSION] — 测试适配是必要维护，非设计偏差 |
| EntryDetailView.vue: v-show="!zenMode" 三处 | §2.8 设计为纯 CSS | ⚠️ 偏差（见 DESIGN_GAP 2，已 REVIEWED） |

## 3. SCOPE+ 闭环

P1 §8 SCOPE+ 增补：
> [SCOPE+] zen mode 未隐藏移动端 mobile-sticky-header 和 mobile-bottom-bar

P2 §7 确认：
> [SCOPE+] 发现: zen mode 未隐藏移动端 mobile-sticky-header 和 mobile-bottom-bar

P1 §8 标记：
> [SCOPE_RESOLVED] 已在 P2-design.md §2.8 和 §7 确认，新增 BDD-12 覆盖

实现验证：
- layout.css line 614-615: `.zen-mode .mobile-sticky-header, .zen-mode .mobile-bottom-bar { display: none }` ✅
- EntryDetailView.vue line 5, 255: v-show="!zenMode" on mobile-sticky-header + mobile-bottom-bar ✅
- P6 BDD-12: PASS ✅

**SCOPE+ 闭环确认**：P1→P2→P4→P6 全链路闭环，[SCOPE_RESOLVED] 标记存在。

## 4. P1 BDD ↔ P6 验收映射

| BDD | P1 条件 | P6 结果 | 映射 |
|-----|---------|---------|------|
| BDD-1 | 详情页 Sign in 入口（匿名） | PASS | ✅ |
| BDD-2 | 详情页 Sign in 隐藏（已登录） | PASS | ✅ |
| BDD-3 | Sign in 登录后响应式消失 | PASS | ✅ |
| BDD-4 | 品牌字标显示 | PASS | ✅ |
| BDD-5 | 移动端品牌元素 | PASS | ✅ |
| BDD-6 | Explore 导航入口 | PASS | ✅ |
| BDD-7 | 移动端底栏文案修正 | PASS | ✅ |
| BDD-8 | reads 计数格式统一 | PASS | ✅ |
| BDD-9 | 首页 Sign in 视觉权重 | PASS | ✅ |
| BDD-10 | 桌面端 tooltip hover | PASS | ✅ |
| BDD-11 | authState loading 态无闪烁 | PASS | ✅ |
| BDD-12 | zen mode 下品牌/Sign in 隐藏 | PASS | ✅ |

BDD 总数：12，P6 PASS 数：12。数量匹配，内容逐条对应。无中间态（无"调整/跳过/覆盖"）。

## 5. 跨文件一致性

| 检查项 | 结果 |
|--------|------|
| P2 §4 packages: [frontend-v3] ↔ P4 改动文件全在 frontend-v3/ | ✅ 一致 |
| P2 §4 domains: [frontend] ↔ P1 §6 domains: [frontend] | ✅ 一致 |
| P2 §4 ui_affected: true ↔ P6 有 8 张截图证据 | ✅ 一致 |
| P2 §4 gate_commands P5/P6 ↔ 实际执行 make test-frontend && make typecheck | ✅ 一致 |
| P1 §6 packages 含 LoginDialog.vue (复用不改) ↔ P4 未改动 LoginDialog | ✅ 一致 |
| P2 不改什么: 后端 API / LoginDialog / auth.ts / EntryListView / router / BaseButton ↔ P4 改动文件列表 | ✅ 一致 |

## 6. 未决项清零

| 检查项 | 结果 |
|--------|------|
| 全阶段产出中 [NEED_CONFIRM] | 无 |
| 全阶段产出中 [BLOCKER] | 无 |
| 全阶段产出中 [DEVIATION-CRITICAL] | 无 |

## 7. 一致性结论

- 双向一致性检查完成：设计→实现 18 项（16 ✅ + 2 ⚠️ 已 REVIEWED），实现→设计 8 项（6 ✅ + 1 ⚠️ 已 REVIEWED + 1 [EXTENSION]）
- 2 条 DESIGN_GAP 已逐条转抄 + 标记 [DESIGN_GAP_REVIEWED: 已确认]
- SCOPE+ 闭环确认：[SCOPE_RESOLVED] 存在，P1→P2→P4→P6 全链路闭环
- BDD 12 条 ↔ P6 12 PASS，数量匹配，无中间态
- 跨文件一致性确认
- 无 [BLOCKER] / [DEVIATION-CRITICAL] / [NEED_CONFIRM]
