---
phase: P4
task_id: TPV0100
type: review
parent: P4-implementation.md
trace_id: TPV0100-P4-20261001
status: approved
created: 2026-10-01
agent: design-review
reviewer_role: design-review
ui_render_shape: layout
domains: [frontend]
---

# P4-review — TPV0100 网页发布入口（实现评审 · design-review）

**受评对象**：P4 前端实现（`frontend-v3/src/views/PublishView.vue` + 4 新组件/2 新 composable + `client.ts`/`types`/`router`/`UserMenu`/`EntryListView` + `DESIGN.md`）
**设计基准**：`P2-design.md`（v1.1/rev1，plan-design-review approved）
**需求基线**：`P1-requirements.md`（30 BDD）
**角色**：design-review（frontend 域 C8 映射），agent 非 main
**范围**：仅核对实现是否忠实落地 P1/P2——不重开方案、不改代码。

**结论：status: approved，0 BLOCKER。**

---

## 1. checklist 逐项结论

### 1.1 BDD 覆盖 —— PASS

30 条 BDD 逐条存在实现落点，无实现盲区。分类如下。

| BDD | 实现落点（文件:行） |
| :--- | :--- |
| BDD-1 | `UserMenu.vue:10,64-67`（Publish 项 + navigateToPublish）→ `PublishView.vue:2` 渲染根 |
| BDD-2 | `EntryListView.vue:64-70`（`.toolbar-right` 主按钮） |
| BDD-3 | `EntryListView.vue:66`（`!props.owner` 渲染 gate，props 定义 `EntryListView.vue:305-307`） |
| BDD-4 | `EntryListView.vue:66`（`authState === 'authenticated'` gate）+ `UserMenu.vue` 仅在 authenticated 渲染（`EntryListView.vue:9-10`） |
| BDD-5 | `router.ts:110-112`（`/publish` 守卫 `return '/'`） |
| BDD-6 | `useFileEncoding.ts:1-36`（判定+编码）+ `PublishView.vue:269-282`（addFiles） |
| BDD-7 | 复用既有详情渲染链路（P2 §1.2 Not Modify，本次不改渲染）——无需新实现 |
| BDD-8 | `useFileEncoding.ts:4-9`（`TextDecoder('utf-8',{fatal:true})` 失败→二进制） |
| BDD-9 | `PublishFileList.vue:22-32`（path 内联编辑）+ `PublishView.vue:288-291`（updatePath 写回） |
| BDD-10 | `PublishResultPanel.vue:5-25`（双链接块 + 复制按钮）+ `client.ts:218-219`（origin 拼链接） |
| BDD-11 | 复用后端 raw 端点（本次后端零改动）——无需新实现 |
| BDD-12 | `PublishResultPanel.vue:30`（view-detail）→ `PublishView.vue:341-343`（router.push('/'+slug)） |
| BDD-13 | `PublishView.vue:345-364`（publishAgain 重置全部表单 + `drafts=[]` + `idempotencyKey=null`） |
| BDD-14 | `usePublishValidation.ts:77-82`（summary trim 非空 + 长度） |
| BDD-15 | `usePublishValidation.ts:93-95`（files.length===0 → globalError） |
| BDD-16 | `usePublishValidation.ts:96-98`（文件数）/`136-142`（单文件，含 filename）/`100-103`（总量，含当前量） |
| BDD-17 | `usePublishValidation.ts:106-128`（空/以 `/` 开头/`..` 段/长度→fileErrors[fileId]） |
| BDD-18 | `usePublishValidation.ts:105,129-133`（Set 查重→fileErrors[fileId]） |
| BDD-19 | `usePublishValidation.ts:84-91`（SLUG_PATTERN + maxSlugLength） |
| BDD-20 | `PublishView.vue:215-216`（isPublic=true/expiresIn 默认）+ `370-376`（onMounted 取 limits.defaultExpiresIn）+ `usePublishValidation.ts:156` |
| BDD-21 | `PublishView.vue:158-165`（team）+ `111-120`（tags）+ `usePublishValidation.ts:158-179`（payload 组装） |
| BDD-22 | 归属由登录会话决定（后端契约；前端不传 owner）——无需新实现 |
| BDD-23 | `PublishView.vue:333-338`（catch 保留 phase=form + 表单态保留）+ `254-256`（指纹不变→复用 key） |
| BDD-24 | `PublishView.vue:252-256` + `usePublishValidation.ts:184-191`（指纹随载荷变） |
| BDD-25 | `client.ts:12-14`（429 固定文案） |
| BDD-26 | `client.ts:16-39`（400 `error.message` / 422 `detail[].msg` 拼接，无 `[object Object]`） |
| BDD-27 | `PublishView.vue:313`（submitting 早退）+ `234`（disabled 计算）+ `174`（按钮 disabled） |
| BDD-28 | 路由可达 + seed 下 `/explore` 有内容（既有）+ 发布流程 E2E 已覆盖 |
| BDD-29 | `PublishView.vue:134,236-238`（visibilityText 计算随开关） |
| BDD-30 | `useFileEncoding.ts:1-10`（纯函数，逐分支对齐后端） |

`P4-implementation.md §4` 的 E2E（40/40）+ `src/__tests__/tpv0100-publish.spec.ts`（12 单测）与上表落点对应，无「测试覆盖但实现缺失」项。

### 1.2 data-testid 契约 —— PASS

P2 §4.8 清单 26 个 testid **全部落地**且与 E2E spec 实际使用一致（逐项核对 `PublishView.vue` / 4 组件 / `EntryListView.vue` / `UserMenu.vue` 与 `e2e/tpv0100-publish.spec.ts:91-106` 常量表）。

- 结果态 7 个：`publish-result`(`PublishResultPanel.vue:2`)、`publish-page-link`(`:7`)、`publish-raw-link`(`:18`)、`publish-copy-page`(`:11`)、`publish-copy-raw`(`:22`)、`publish-view-detail`(`:30`)、`publish-again`(`:31`) ✓
- 文件行 4 个：`publish-file-row`/`publish-file-path-input`/`publish-file-badge-binary`/`publish-file-remove`（`PublishFileList.vue:9,24,17,36`）✓
- 错误/空态：`publish-error-summary`(`PublishView.vue:37`)、`publish-summary-error`(`:58`)、`publish-slug-error`(`:94`)、`publish-file-row-error`(`PublishFileList.vue:44`)、`publish-file-empty`(`:3`) ✓
- 入口：`user-menu-publish-item`(`UserMenu.vue:10`)、`explore-publish-button`(`EntryListView.vue:68`) ✓

行级 `publish-file-row-error` 用 `[data-testid]` + 行内 `data-file-id`（`PublishFileList.vue:10`）定位，与 P2 §4.8 注释一致。

### 1.3 a11y（P2 §3.4）—— PASS（1 处非阻塞偏离，见 §3）

- `aria-describedby` + `aria-invalid` + `role="alert"` 三件套：
  - summary：`aria-describedby` = 错误 id 或计数 id（`PublishView.vue:51`）、`aria-invalid`（`:52`）、错误 `role="alert"`（`:58`）✓
  - 文件行 path：`aria-label` + `aria-describedby="publish-file-error-{fileId}"` + `aria-invalid`（`PublishFileList.vue:28-30`）、行错误 `role="alert"`（`:45`）✓
  - 顶部汇总：`role="alert"` + `tabindex="-1"`（`PublishView.vue:37-40`）✓
- `aria-busy`：表单容器 `:aria-busy`（`PublishView.vue:30`）✓；提交中按钮 disabled（`:174-175`，含"发布中…"文案，不改 BaseButton，符合 P2 §3.4.2）✓
- `role="status" aria-live="polite"`：`sr-only` 公告区（`PublishView.vue:17`）+ 结果容器（`PublishResultPanel.vue:2`）✓
- 焦点迁移（P2 §3.2.2）：校验/后端失败→汇总条（`PublishView.vue:307-309,337`）；成功→结果标题（`:330-332`，`.result-title` `tabindex="-1"`）；再发一个→summary（`:362-363`）✓
- 颜色不单独传意：错误行/字段同时有文本 + `role="alert"` + `--c-error`（`PublishFileList.vue:40-46`、`PublishView.vue:450-458`）✓

### 1.4 数据流与编码（P2 §4.1/§4.4）—— PASS

`useFileEncoding.ts:1-10` 与后端 `backend/peekview/language.py:314-339` **逐分支一致**（实读核对）：

| 分支 | 后端 `is_binary_content` | 前端 `isBinaryContent` |
| :--- | :--- | :--- |
| 空字节 | `if not content: return False`（L326-327） | `if (bytes.length === 0) return false`（L2） |
| 含 NUL | `if b"\x00" in content: return True`（L330-331） | `if (bytes.includes(0)) return true`（L3） |
| 合法 UTF-8 | `content.decode("utf-8")` 成功 → `False`（L334-336） | `TextDecoder` 成功 → `false`（L4-6） |
| 非法 UTF-8 | `UnicodeDecodeError` → `True`（L337-339） | `catch → true`（L7-9） |

- 文本→`content`、二进制→`content_base64`：`usePublishValidation.ts:168-172` ✓
- base64 分块 0x8000（`useFileEncoding.ts:14-20`）避免大文件爆栈 ✓
- 数据流与 P2 §4.1 一致：`File[]→drafts→validate→POST→PublishResult`（`PublishView.vue:269-282,298-339`）✓

### 1.5 幂等键（P2 §4.2）—— PASS

- 绑载荷指纹：`payloadFingerprint` computed = `computePayloadFingerprint(currentInput(), limits)`（`PublishView.vue:252`），`watch` 变化即 `idempotencyKey = null`（`:254-256`）✓
- 变则换键：指纹由 canonical payload（含 summary/slug/tags/is_public/expires_in/team_id/每文件 path+encoded）决定（`usePublishValidation.ts:184-191`）✓
- 再发一个重置：`drafts=[]` + `idempotencyKey=null`（`PublishView.vue:353,359`），且**无模块级编码缓存**（drafts 置空即释放，符合 P2 §4.3 ⑤ 约束）✓
- 同载荷重试复用旧键：失败路径不改任何输入、不重置 key（`PublishView.vue:333-338`）✓
- 幂等键不出现在 DOM ✓

### 1.6 错误提取（P2 §4.6）—— PASS

`client.ts:7-44` 依次：429 固定文案 → `data.error.message`（400）→ `data.detail` 字符串 → `data.detail` 数组 `map(d => d.msg ?? JSON.stringify(d))` 拼接（422）→ `err.message` → 兜底。禁 `[object Object]` 由 `msg` 优先 + `JSON.stringify` 保障（单元测试 `tpv0100-publish.spec.ts:311` 显式断言）。与 P2 §4.6 形状表逐行一致。

### 1.7 结果态链接（P2 §4.3）—— PASS

`client.ts:218-219` 用 `window.location.origin`（**非** `response.url`），`PublishResult` 在提交成功唯一构造点（`PublishView.vue:327`）赋值。P2 R4 / `[SCOPE+]` 已闭合。

### 1.8 UI 视觉 / 移动端（P2 §3.1/§3.3）—— PASS

- 单列 720px 居中：`.publish-content { max-width:720px; margin:0 auto; padding:var(--space-4) }`（`PublishView.vue:430-436`），与 P2 §3.1.1 偏离记录一致 ✓
- 移动端 `≤640px`：主按钮全宽 `min-height:44px`（`:547-552`）；文件行 `flex-wrap` + path 全宽（`PublishFileList.vue:195-204`）；结果态按钮纵向全宽（`PublishResultPanel.vue:147-156`）✓
- 44px 触控目标：`.text-input/.summary-input min-height:44px`（`PublishView.vue:479`）、`.file-copy min-height:44px`（`PublishResultPanel.vue:120`）、`.submit-button min-height:44px`（`:544`）✓
- 链接不溢出：`.result-link-value { word-break:break-all; overflow-wrap:anywhere }`（`PublishResultPanel.vue:113-114`）✓
- 行错误在输入下方不重叠：`.file-row-error { flex-basis:100% }`（`PublishFileList.vue:190-193`）✓
- mono 场景：文件 path 输入与文件名 `var(--font-mono)`（`PublishFileList.vue:119,155`）、结果链接 `var(--font-mono)`（`PublishResultPanel.vue:110`）✓

### 1.9 设计系统一致性（DESIGN.md）—— PASS

- 全部色值/token 来自既有 CSS 变量（实读 `variables.css` 确认 `--c-badge-private-bg`/`--c-badge-public-bg`/`--c-error-surface`/`--c-surface-lower`/`--c-border-strong` 均在 light/dark 双分支登记）——无未登记新 token、无组件内 `color-mix()` ✓
- 复用既有组件：`UserMenu`/`ThemeToggle`/`BaseButton`；`BaseButton` 无 `loading` prop，提交文案由页面 slot 自管（`PublishView.vue:175`，实读 `BaseButton.vue:32-48` 确认）✓
- 表单节奏与 `ProfileTab`/`TeamsView` 同构：`<label>` + input + `.field-error` 三段式（`PublishView.vue:42-59,465-513`）✓
- 过渡档 150ms：`var(--transition-fast)`（`FileDropZone.vue:110`、`PublishResultPanel.vue:128`）；状态跃迁无入场动画（符合 P2 §3.2.1）✓
- `.explore-publish-button`（`EntryListView.vue:1089-1115`）样式与 `BaseButton.btn-primary`（`BaseButton.vue:83-93`）逐属性等价（height 40 / radius-lg / `--c-accent` / glow / hover `--c-accent-secondary`）——用 `<router-link>` 而非 `BaseButton` 以走 SPA 导航，视觉无偏离 ✓
- `DESIGN.md:216` 已同步为 `(Publish, Settings, Teams, Logout)`（实读）✓

### 1.10 3 条 DESIGN_GAP 合理性 —— PASS

- **§2.5 limits 双拼写**：`usePublishValidation.ts:22-68` 的 `resolveLimits` 同时接受 snake/camel（snake 优先），`api.getLimits()` 仍返回 M6 的 camelCase `PublishLimits`（`client.ts:224-235`）。两侧可工作，属契约缺口的最小平滑处理，未引入新问题。合理性成立。
- **§2.6 UserMenu 类名**：已按主 Agent 裁决回归 `.dropdown-item`（`UserMenu.vue:10`：`dropdown-item dropdown-item-publish`），下拉 3→4 项，既有单测同步。实读确认**取巧类名已移除**（`.dropdown-item` 选择器会计入 Publish 项），无残留。裁决无新引入问题。
- **§4 BDD-22 端点**：E2E 改用 `GET /api/v1/entries/{slug}`（`tpv0100-publish.spec.ts:558`），响应含 `owner_id`（`api/types.ts:46` `EntryResponse.owner_id`）。裁决无新引入问题。
- 三条均标 `[DESIGN_GAP_RESOLVED]` 且有主 Agent 授权痕迹（`P4-implementation.md §2.6/§4`），处理合规。

---

## 2. BLOCKER 清单

**无 BLOCKER。** 实现忠实落地 P1 的 30 条 BDD 与 P2 §3/§4 的 UI、交互、a11y、数据流、编码、幂等、错误提取、结果态设计；data-testid 契约完整；无实现盲区；3 条 DESIGN_GAP 处理合规。RM-AG0046 无 violations（`check-maintainability.py` → `god_file_count:0 / fuzzy_boundary_count:0`），不构成放行障碍。

---

## 3. 建议（非阻塞）

1. **a11y：slug 输入未把错误元素纳入 `aria-describedby`。** `PublishView.vue:87` 仅指向 `publish-slug-hint`；P2 §3.4.1 slug 行要求 `aria-describedby="publish-slug-error"`。错误元素仍有 `role="alert"`（`:94`）会在出现时播报、`aria-invalid` 已置（`:88`），故可访问性实质保留；建议后续将错误时 describedby 指向 `publish-slug-error`（与 summary 的 `:51` 写法统一）。不影响任何 BDD 判定。
2. **`FileDropZone` 未实现 `accept` 过滤分支。** P2 §4.10.2 描述"`accept` 非空时按扩展名/MIME 过滤"，实现仅做同名同 size 去重（`FileDropZone.vue:79-93`）；`accept` 在本任务恒为空（PublishView 不传），分支从未触发，无 BDD 受影响。属 P2 组件契约的未落地细节，记为未来若启用 accept 时的补齐项。
3. **`FileDropZone` 未在"全重复"时 emit `reject`。** P2 §4.10.2 写"超 maxFiles 截断**或全重复**"均 emit reject；实现仅在超 maxFiles 时 emit（`FileDropZone.vue:87-91`），全重复时静默过滤。无 BDD 判定依赖（BDD-6 只要求多文件落库），非阻塞。
4. **P6 需留意 BDD-3 的菜单入口张力（非 P4 缺陷）。** `/users/:username` 在已登录时渲染 `UserMenu`（`EntryListView.vue:10`），其 Publish 项在展开菜单后可点击到 `/publish`。P2 §1.1 M2 将该菜单定义为**全局入口**、`!props.owner` gate 仅作用于 Explore 主按钮，implementation 忠实于此。但 BDD-3 字面为"页面内不存在跳转到 `/publish` 的可点击入口"，当前 E2E 仅验证**未展开**菜单（`tpv0100-publish.spec.ts:201-203`）。该张力在 P1/P2 层已存在，**非本次实现的偏离**；建议 P6 若深测展开态时与需求侧确认口径，勿据此判 P4 失败。

---

## 4. 总评

P4 前端实现与 P2 设计基准、P1 的 30 条 BDD 高度一致：编码判定与后端逐分支对齐、幂等键绑载荷指纹语义正确、错误提取双形状可读、结果态链接用当前源、a11y 三件套与焦点迁移落地、715/720px 窄栏与移动端 390 无溢出设计已备（E2E 40/40 佐证）、设计系统 token 与组件复用无反模式。3 条 DESIGN_GAP 均由主 Agent 裁决并已闭合（含 Publish 项回归 `.dropdown-item`、BDD-22 端点改 `GET /entries/{slug}`），无残留取巧实现，后端零改动约束成立。§3 的 4 条均为非阻塞建议，其中建议 4 为 P1/P2 层既有张力、与本次实现无关。

**判定：approved（0 BLOCKER）。**
