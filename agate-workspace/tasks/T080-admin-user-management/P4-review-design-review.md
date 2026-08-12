---
phase: P4
task_id: T080-admin-user-management
trace_id: T080
type: review
parent: P4-implementation.md
status: needs-revision
agent: design-review
created: 2026-08-06
---

# T080 P4 — Design Review

## 四维度评分

| 维度 | 评分 | 说明 |
|------|------|------|
| AI Slop | PASS | 无紫色渐变、无泛化文案、布局有层级（标题+列表+分页），符合项目设计语言 |
| Typography | PASS | 字号层级清晰（H1 24px / body var(--font-sm) / badge var(--font-xs)），使用项目 CSS 变量 |
| Spacing | NEEDS-REVISION | 1 处无效 CSS 变量引用 (--space-8 不存在)，导致 loading/error state padding 塌陷为 0 |
| 交互状态 | NEEDS-REVISION | pendingOp 声明但未绑定到任何 disabled UI（P2 spec 明确要求）；按钮缺 :focus-visible；BDD-02 active 标记未实现 |
| 移动端 | PASS-WITH-NOTES | OverflowMenu variant 响应式切换正确（dropdown/sheet）；media query 含 no-op 规则（无害但冗余） |
| 可访问性 | NEEDS-REVISION | PasswordResetDialog/ConfirmDialog 按钮 :focus-visible 缺失；Escape 关闭缺失（沿袭现有 pattern，非 T080 新增但应补） |

## 问题清单

### [MUST-FIX] BDD-02 active 标记未实现 + "public" badge 语义错误

```
[VISUAL] 活跃非 admin 用户显示 "public" badge，语义错误且 BDD-02 不通过
  文件：frontend-v3/src/views/AdminView.vue:34
  问题：BaseBadge v-else status="public" —— "public" 是 entry 可见性术语，
        不是用户状态。BDD-02 Then 要求"active 用户显示 active 标记"。
        当前活跃非 admin 用户显示 "public"，既不满足 BDD-02 文案，
        也对 admin 造成困惑（用户不是 public/private 概念）。
  Fix：移除 v-else 行（活跃非 admin 用户不显示状态 badge，badge 仅用于
       标记异常状态：admin/disabled）。或如 BDD-02 严格要求 active 标记，
       新增 BaseBadge 'active' variant 显示 "active"。建议前者（无 badge =
       默认活跃状态），与 EntryList 的 archived badge 模式一致。
```

### [MUST-FIX] pendingOp 声明但未绑定到 disabled UI（P2 spec 明确要求）

```
[INTERACTION] 操作 in-flight 无防重复点击保护
  文件：frontend-v3/src/views/AdminView.vue:92, 187-252
  问题：pendingOp ref 在 doDisable/doEnable/doPromote/doDemote/doDelete 中
        set/clear，但模板中未绑定到任何 disabled 属性。OverflowMenu 触发器
        和菜单项在操作 in-flight 时仍可点击，用户可快速连续触发多个操作。
        P2-design.md §7（line 402）明确要求：
        "OverflowMenu 触发器 :disabled="!!pendingOp""
        "当前操作对应的菜单项 :disabled="item.actionKey === pendingOp""
  Fix：1. OverflowMenu.vue 新增 disabled prop（当前不支持），传递到 trigger button。
       2. AdminView 模板 :disabled="!!pendingOp" 绑定到 OverflowMenu。
       3. 或最低限度：pendingOp 非空时 getMenuItems 返回空数组 / 标记所有 item disabled。
```

### [MUST-FIX] --space-8 CSS 变量不存在，loading/error state padding 塌陷

```
[SPACING] loading-state 和 error-state padding 引用不存在的 CSS 变量
  文件：frontend-v3/src/views/AdminView.vue:288, 294
  问题：padding: var(--space-8) —— variables.css space scale 只到 --space-7 (48px)，
        --space-8 未定义，浏览器解析为空值，padding 塌陷为 0。
        loading/error state 文字紧贴卡片边缘，无呼吸空间。
  Fix：改为 var(--space-7)（48px，与 EntryListView.vue:625 loading-state 一致）。
```

### [SHOULD-FIX] 按钮缺 :focus-visible 样式（可访问性）

```
[INTERACTION] AdminView 重试按钮 + PasswordResetDialog 所有按钮 + ConfirmDialog 按钮 无 focus 可见样式
  文件：frontend-v3/src/views/AdminView.vue:298-306
       frontend-v3/src/components/PasswordResetDialog.vue:182-205
       frontend-v3/src/components/ConfirmDialog.vue:101-129
  问题：按钮有 :hover 样式但无 :focus-visible。键盘 Tab 导航时无焦点指示器。
        PasswordResetDialog input 用 outline:none + border-color 替代（可接受），
        但按钮完全无 focus 反馈。
  Fix：补 :focus-visible { outline: 2px solid var(--accent-color); outline-offset: 2px; }
       参照 layout.css:279 .icon-btn:focus-visible 模式。
```

### [SHOULD-FIX] disabledAt 未展示（P2 spec 声明满足 BDD-02）

```
[VISUAL] 禁用时间未展示
  文件：frontend-v3/src/views/AdminView.vue:30-35
  问题：P2-design.md §1（line 201）声明"仅展示 disabled_at 即可满足 BDD-02
        disabled 标记"。User 类型已扩展 disabledAt 字段（types/index.ts:110），
        transformUser 已映射（client.ts:102），但 AdminView 模板未渲染。
        当前仅显示 "disabled" 文字 badge，无时间信息。
  Fix：disabled badge 旁或 user-row 内展示 disabledAt（相对时间或日期），
       如 "disabled · 3 天前"。或调整 P2 spec 声明（badge 即满足 BDD-02）。
```

### [NICE-TO-HAVE] 移动端 media query 含 no-op 规则

```
[SPACING] @media (max-width: 640px) .user-row { flex-direction: row } 与默认值相同
  文件：frontend-v3/src/views/AdminView.vue:346-349
  问题：.user-row 默认已是 flex-direction: row（:316），media query 重复声明
        同值，无效果。P2 spec §7（line 409）建议移动端单列布局，但实现
        桌面/移动端布局相同（username+badge 一行，OverflowMenu 右对齐）。
        当前布局在窄屏可用，但 media query 是死代码。
  Fix：移除 no-op 的 .user-row media query 规则，或实现真正的移动端布局调整
       （如 user-info 改 column、badge 换行）。
```

### [NICE-TO-HAVE] displayName 未展示

```
[VISUAL] P2 spec 要求 username + displayName，实现仅显示 username
  文件：frontend-v3/src/views/AdminView.vue:30
  问题：P2-design.md §7（line 396）"每行 username + displayName + BaseBadge"。
        实现仅 {{ user.username }}，displayName 未渲染。
  Fix：在 username 下方或右侧展示 displayName（如存在），用 text-secondary 色。
       或调整 P2 spec 声明（username 即足够）。
```

## 已确认正确的实现

- router.ts: /admin route 在 /:slug 前（:27-31），requiresAdmin 守卫在 waitForAuthInit 之后（:92-95）—— BDD-14/15 正确
- Toast.vue: aria-live 按 variant 动态（error=assertive，其他=polite），item 级（:9）—— 符合 P2 spec
- PasswordResetDialog: alertdialog role + aria-labelledby/describedby + focus input on open + ≥8 校验 + confirm disabled 联动 —— 符合 P2 spec
- ConfirmDialog 文案：删除/禁用两组文案与 P2 spec §7 一致
- OverflowMenu variant 响应式：isMobile ? 'sheet' : 'dropdown'（:38）—— 符合 DESIGN §9
- BaseBadge: disabled/admin variant 新增，复用现有色系变量（无 AI slop 紫色）
- transformUser: disabledAt/disabledBy 正确映射
- API client 方法组：listUsers/disableUser/enableUser/promoteUser/demoteUser/resetUserPassword/deleteUser 一一映射

## Summary

- 3 个 MUST-FIX（BDD-02 active 标记 + pendingOp 未绑定 + --space-8 无效变量）
- 2 个 SHOULD-FIX（focus-visible + disabledAt 展示）
- 2 个 NICE-TO-HAVE（media query no-op + displayName）

Status: needs-revision（3 个 MUST-FIX 阻断，修复后可推进 P5）

[PROD_NOT_TOUCHED]
