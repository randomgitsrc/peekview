---
phase: P2
task_id: T069
type: review
parent: P2-design.md
trace_id: T069-P2-review-20260726
status: approved
created: 2026-07-26
agent: plan-design-review
---

## 评分维度

| 维度 | 评分 | 说明 |
|------|------|------|
| 交互状态覆盖率 | 7/10 | Auth guard 三态有覆盖；缺守卫等待期间页面视觉反馈方案；缺 fetchMe 错误（非超时）时 authState 具体行为 |
| AI Slop 风险 | 8/10 | CSS 变量/像素值/HTML 结构均具体锚定；§2.6 "可能需要微调尺寸" 留模糊空间 |
| 移动端考虑 | 8/10 | sticky header/bottom bar/drawer 均有详细设计；touch target 44px 有约束；缺横屏布局说明；drawer 头部数量样式缺 CSS 细节 |
| 可访问性 | 5/10 | toggle-btn 有 aria-label；brand-sep 无 aria 角色；logo icon 无 alt；mobile-signin-link 用 `<a>` 无 href 语义错误；badge 无 sr-only 上下文 |

## 逐项审查

### 1. 交互状态覆盖率

**通过项**：
- §2.1 Auth guard loading/timeout/ready 三态有明确处理路径
- §2.8 toggle-btn active 状态同步有 ref 绑定方案
- BDD-6 超时兜底有 5s 阈值

**问题**：
- **[MINOR] 守卫等待期间页面空白**：P1 隐含需求 §边界维度明确提到"需考虑是否显示 loading 指示"，但 §2.1 仅说"可接受"未给出方案。建议在 §2.1 补充说明：等待期间 Vue Router 暂停导航，用户看到的是上一页面（首次加载时为空白 HTML），这是 Vue Router async guard 的标准行为，无需额外 loading UI——但需在实现注释中标注此决策。
- **[MINOR] fetchMe 错误时 authState 值**：§2.1 第 5 点说超时后 authState 可能仍是 'loading'，但未说明 fetchMe 返回 401/500 时 authState 的值。需确认 authStore 在 fetchMe 失败时将 authState 设为 'anonymous'（而非停留在 'loading'），否则守卫逻辑会误判。这不是设计缺陷而是设计遗漏——实现时需验证 authStore 行为。

### 2. AI Slop 风险

**通过项**：
- CSS 变量名精确（`--c-text-tertiary`, `--c-accent`, `--c-border`）
- 像素值精确（1px/20px/8px/56px/24px/16px/12px/13px/44px）
- HTML 结构有模板代码示例
- badge 复用 share-badge 样式有锚定
- FileTree prop 有类型声明（`fileCount?: number`）

**问题**：
- **[MINOR] §2.6 "可能需要微调尺寸"**：移动端 bottom bar toggle-btn 样式适配留了模糊空间。建议明确：移动端 toggle-btn 尺寸与桌面端一致（28px），或给出具体差异值。

### 3. 移动端考虑

**通过项**：
- sticky header 56px + logo icon 24px + 两行标题 + Sign in 文本链接
- bottom bar toggle-btn 风格统一
- touch target min-height 44px
- 两行截断 `-webkit-line-clamp: 2`
- drawer 头部数量显示

**问题**：
- **[TRIVIAL] 横屏布局**：未提及移动端横屏时 sticky header/bottom bar 的行为。当前项目无横屏特殊处理，可视为一致。
- **[MINOR] drawer 头部数量样式**：§2.7 给出了文本格式 "Files · N" 但未给出 CSS 样式细节（字体大小、颜色、与关闭按钮的间距）。建议实现时参照 FileTree 面板头部的 `h3` 样式。

### 4. 可访问性

**问题**：
- **[MODERATE] mobile-signin-link 语义错误**：§2.5 使用 `<a class="mobile-signin-link" @click="showLogin = true">Sign in</a>`，`<a>` 无 `href` 属性时不是交互元素，屏幕阅读器不会将其识别为链接/按钮。应改为 `<button class="mobile-signin-link">` 或添加 `href="#"` + `@click.prevent`。
- **[MINOR] brand-sep 无 aria 角色**：§2.2 的 `<span class="brand-sep"></span>` 是纯装饰性分隔符，应加 `aria-hidden="true"`。
- **[MINOR] logo icon 无 alt 文字**：§2.5 移动端 logo icon 作为 router-link，需确保有 accessible name（SVG 内 `<title>` 或 `aria-label`）。
- **[MINOR] badge 无 sr-only 上下文**：§2.3 的文件数量 badge 对屏幕阅读器用户缺乏语义——"3" 单独读出无意义。建议加 `aria-label="3 files"` 或 sr-only 文字。

### 5. BDD 覆盖完整性

24 条 BDD 全部在 §3 覆盖矩阵中有对应实现位置。逐条核对无遗漏。

### 6. 候选方案评估

- 方案 A（async guard + Promise.race）和方案 B（延迟 router 安装）均有完整评估
- 选择理由 5 条，引用了 P0-brief 约束、Vue Router 官方推荐、超时机制、最小验证结果、风险隔离
- 方案 B 的风险分析准确（fetchMe 挂起则整个应用挂起）
- **同意选择方案 A**

### 7. 四字段检查

| 字段 | 状态 | 备注 |
|------|------|------|
| packages | ✅ | `frontend-v3` |
| domains | ✅ | `frontend` |
| ui_affected | ✅ | `true` + 7 个交互点 |
| gate_commands | ✅ | P5 + P5_e2e + P6 均有 |

### 8. files_to_read 检查

10 个文件条目，每个有 `why` 说明。范围合理，未过度膨胀。

### 9. minimal_validation

已确认 Vue Router 4.x async beforeEach 可行。验证方法合理，结果为 confirmed。

## 综合判定

**status: approved**

无 BLOCKER。4 个 MODERATE/MINOR 问题均为实现阶段可修正的细节，不影响方案选择和整体架构：

1. mobile-signin-link 语义（MODERATE）→ 实现时改用 `<button>`
2. 守卫等待期间页面空白说明（MINOR）→ 实现注释补充
3. fetchMe 错误时 authState 行为（MINOR）→ 实现时验证 authStore
4. 可访问性标注（MINOR）→ 实现时添加 aria 属性

## 建议实现时注意

1. §2.5 `mobile-signin-link` 改用 `<button>` 元素，保持 `min-height: 44px` touch target
2. §2.2 `brand-sep` 加 `aria-hidden="true"`
3. §2.5 logo icon SVG 内加 `<title>PeekView Home</title>`
4. §2.3 badge 加 `aria-label` 或 sr-only 文字
5. §2.1 实现时确认 authStore fetchMe 失败时 authState 转为 'anonymous'
