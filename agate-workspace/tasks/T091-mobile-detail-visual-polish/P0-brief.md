---
phase: P0
task_id: T091
task_name: mobile-detail-visual-polish
trace_id: T091
created: 2026-08-10
status: pending
parent: T090 发布后用户视觉走查发现的问题，会话内讨论定型
---

# P0-brief — T091 移动端详情页视觉打磨（T090 后续修正）

## task

T090（移动端详情页 UX 打磨，v0.18.1 已发布）上线后，用户实机走查发现视觉观感差——"机械性改需求，没有在审美/呼吸感受上做有意义的事"。orchestrator 用 Playwright CDP 截图 + 实测 DOM 数值复核，确认了 4 处具体问题，并与用户逐条讨论定型了修复方案（含两个真实实现 bug，不只是审美偏好）。本任务把这轮已确认的方案落地。

**范围扩展（用户明确要求，P1 派发前已定型，非事后 [SCOPE+]）**：`content-area`/`meta-tags-bar`/底部操作栏这套布局是详情页**全部 9 种 viewer 共用的公共骨架**（Markdown/CodeViewer/TableView(CSV+TSV)/TreeView(JSON+YAML+XML)/ImageViewer/HtmlViewer/SvgRenderer/MermaidRenderer/PlantUmlRenderer）。T090 当初 P6 只截图验证过 markdown + code 两种 viewer（对应 BDD-1/BDD-2 的"跨 viewer 范围收窄声明"），其余 7 种 viewer 在新布局下从未被真正截图看过。本任务的 P6 视觉验收范围必须扩大到**全部 9 种 viewer**，不能只验 markdown。

**这不是重新设计，是把上一轮会话里已经拍板的具体数值/方案原样实现**——P1/P2 不需要重新探索候选方案，只需要把下面"已确认的实现规格"转成规范的 BDD/设计文档，重点精力放在 P4 实现和 **P6 真实截图验收**（T090 的教训是 BDD 数值达标但没人真正看过效果，这次必须补上视觉验收这一环，不能只验数字）。

## 已确认的实现规格（会话内逐条讨论 + 用户确认，非待定）

### 1. meta-tags-bar（`EntryMetaTagsBar.vue`）

- `padding`: `var(--space-2) var(--space-3)`（8px 12px）→ `var(--space-4) var(--space-4)`（16px 16px）
- 去掉 `overflow-x: auto`，改为 `flex-wrap: wrap`——内容（@用户名/时间/阅读数/Public/标签）该换几行换几行，不再强制单行横向滚动
- 实测依据：当前 `scrollWidth 461px` vs `clientWidth 354px`，溢出 107px，整条被压缩到 17px 高，横向滚动条常驻可见

### 2. markdown-body 移动端边距（`MarkdownViewer.vue`）

- mobile 断点（≤640px）：`margin: 0; padding: 0` → `margin: 0; padding: var(--space-4)`（16px，只加 padding 不加 margin）
- **margin vs padding 已排除 margin**：`EntryMetaTagsBar` 和 `MarkdownViewer`（根节点 `.markdown-body`，外层还有个无样式的 `.markdown-viewer` wrapper）在 DOM 里是 `.content-area` 下的直接相邻块级兄弟节点（`.content-area` 本身非 flex），相邻块级元素的 margin 会发生折叠（取较大值不是相加），用 margin 会导致间距不确定；padding 不折叠，语义更可靠
- 效果对照：content-area 保留现有 8px 水平 padding 不变（用户明确认可"8px 可以"），markdown-body 顶头再加 16px padding，正文总留白 8+16=24px；同理 meta-tags-bar 自身 padding 也是 16px，两者水平起始位置对齐（content-area 8px + 各自 16px = 24px，标签行和正文左边缘视觉对齐）

### 3. 底部操作栏 padding 不对称 bug（`EntryDetailMobileBar.vue`）

**这是一个真实现 bug，不是审美问题**——实测：
```
paddingTop: 8px
paddingBottom: 0px   ← 不是感觉，是真的 0
```
根因：
```css
padding: var(--space-2) var(--space-3);              /* 上下都设了 8px */
padding-bottom: env(safe-area-inset-bottom, 0px);      /* 这行把 bottom 直接替换掉了，不是叠加 */
```
`env(safe-area-inset-bottom, 0px)` 的本意是"在原有 padding 基础上叠加安全区高度"，但写成了直接覆盖——在无刘海/Home Indicator 的设备上 `env()` 求值为 0，把原本设的 8px 覆盖没了。

修复（同时用户要求"上部分空间可以减小"，一并把基准值降低）：
```css
padding: var(--space-1) var(--space-3);   /* 4px 12px，原 8px 12px */
padding-bottom: calc(var(--space-1) + env(safe-area-inset-bottom, 0px));  /* 相加不替换 */
```
效果：无安全区设备上下都是 4px（对称），有安全区设备下方在 4px 基础上再加安全区高度。

### 4. 底部操作栏按钮风格统一（`EntryDetailMobileBar.vue`）

实测 5 个按钮高度：file-tree/toc/source-toggle（`.toggle-btn`，图标）44×44px 达标；Copy（`.bottom-btn.primary`，图标+文字+蓝底）38px；Wrap（`.bottom-btn`，纯文字）预期同 38px；overflow 更多菜单（`OverflowMenu.vue` 内部 `.icon-btn.overflow-trigger`）38px。

**根因排查到 DESIGN.md 本身**：`DESIGN.md` 第 153-160 行已经明确规定"带文字标签的按钮走 `BaseButton` 组件；纯图标按钮走 `.icon-btn`（无 active 态）或 `.toggle-btn`（带 active 态）"。file-tree/toc/source-toggle 走 `.toggle-btn` 是对的；但 Copy/Wrap 两个既没有走 `BaseButton`，也没有走 `.icon-btn`/`.toggle-btn`，是 `EntryDetailMobileBar.vue` 自己另起的一套 `.bottom-btn` 样式，违反了 DESIGN.md 第 154 行"No new variants without design review"。而且桌面端 `EntryDetailHeader.vue` 的 Copy 按钮本来就是纯图标 `.icon-btn`（没有文字）——移动端这次相当于凭空多出一种桌面端都没有的按钮风格。

**已确认修复方向（用户已拍板，不是待定选项）**：
- **Copy**：`.bottom-btn.primary`（文字+蓝底）→ `.icon-btn`（纯图标，去掉"Copy"文字，跟桌面端 `EntryDetailHeader.vue` 的 Copy 按钮视觉一致）。`EntryDetailMobileBar.vue` 当前**没有**本地定义 `.icon-btn` class（`overflow-trigger` 的 `.icon-btn` 是 `OverflowMenu.vue` 自己 scoped 定义的，Vue scoped CSS 不跨组件生效），需要新增本地 `.icon-btn`——参照 `EntryDetailHeader.vue` 的视觉定义（`background:none; border:none; padding:var(--space-1); border-radius:var(--radius-sm); color:var(--c-text-secondary); hover 态`），但**必须额外加 `min-width:44px; min-height:44px`**（桌面端 `EntryDetailHeader.vue` 的 `.icon-btn` 本身没有这个约束，因为桌面端不是触控场景，移动端场景需要显式补上，对齐 DESIGN.md L265"Touch targets: minimum 44px"）
- **Wrap**：`.bottom-btn`（纯文字）→ `.toggle-btn`（图标 + active 态高亮），跟 `source-toggle` 按钮同一套逻辑（`wrapEnabled` 绑定 `active` class）。图标用 `lucide-vue-next` 的 `WrapText`（已确认此包里存在这个图标，无需新增依赖）

## DESIGN.md 需要同步修订的地方（不只是代码要改，文档本身有 3 处描述不完整/有 bug）

1. **L221-223 Markdown Body Spacing (Mobile)**：当前文字"has no additional margin/padding of its own"需要改成反映新的 16px padding
2. **L267 fixed bottom bar 描述**：当前文字写的 `padding-bottom: env(safe-area-inset-bottom, 0px)` 就是 bug 本身的写法（不是代码没按文档做，是文档描述的写法本来就不完整），需要改成 `calc(基础值 + env(...))` 的正确形式
3. **L218-219 Meta Tags Bar (Mobile)**：需要补一句关于换行/不做强制单行横向滚动的说明
4. **可选**：L158-160 Icon Buttons 一节可以补充说明"带持久状态的图标按钮用 `.toggle-btn`，无状态一次性动作用 `.icon-btn`，带文字标签的用 `BaseButton`"这条判断准则，防止未来再出现类似 `.bottom-btn` 这种未经设计评审的新变体（这条不是本次 bug 的直接修复项，但能防止同类问题复发，P1/P2 判断是否纳入本次范围）

## known_risks

- **P6 视觉验收是本任务存在的唯一理由**：T090 的教训是 P6 只验了 BDD 数值，没有真正拿截图看效果。本任务的 BDD 必须包含可截图验证的"视觉呼吸感"类条件（如"meta-bar 无横向滚动条""正文左右留白肉眼可辨识为舒适而非贴边""底部栏按钮视觉高度/风格一致"），不能只写数值断言。verifier 在 P6 必须实际截图 + vision 分析，不能只跑 DOM 测量脚本
- **BaseButton 尺寸规格本身有缺口**：调研中发现 `BaseButton.vue` 的两档尺寸（default 40px / small 34px）都不满足 DESIGN.md 自己规定的 44px 触控线——本次因为 Copy/Wrap 都改走图标风格（`.icon-btn`/`.toggle-btn`，天然 44×44），不需要用到 `BaseButton`，所以这个缺口本次不需要修，但值得记一笔到 roadmap，不属于本任务范围
- **`.icon-btn`/`.toggle-btn` 全项目有多处独立实现，未真正复用同一份 CSS**：`EntryDetailMobileBar.vue`（本次要新增本地 `.icon-btn`）、`EntryDetailHeader.vue`、`OverflowMenu.vue` 各自 scoped 定义了相似但不完全一致的版本（不同的 min-height 约束）。本任务只保证 `EntryDetailMobileBar.vue` 内部新增的 `.icon-btn` 自己是 44×44 达标的，不做跨组件统一（那是更大范围的重构，超出本任务范围，不属于 T091）
- **Wrap 按钮图标语义需要视觉确认**：`WrapText` 图标是否能让用户看懂"这是切换代码换行"，P6 视觉验收时需要结合 tooltip 一起判断，不能假设图标本身够直观
- **content-area 的 8px 与 DESIGN.md 通用容器规则（L113"16px mobile"）仍有冲突**：本次不改 content-area 本身（用户明确保留 8px），这条冲突依然存在，只是通过 markdown-body 补 16px padding 后总留白达到 24px、观感上不再局促，但 DESIGN.md L113 和 content-area 实际值之间的字面冲突未解决，P1/P2 判断是否需要在 DESIGN.md 里加一句"detail page content-area 是刻意的例外覆盖"来消除这个字面矛盾
- **9 种 viewer 覆盖范围扩展的具体风险**：`ImageViewer`/`HtmlViewer` 是 DESIGN.md L273 明确记载的滚动架构例外（`height:100%; overflow:hidden`，内部滚动隔离，不像其他 7 种 viewer 那样融入 `.content-area` 的正常文档流）——meta-tags-bar 嵌入内容流、随内容滚动划走这套 T090 机制，在这两种 viewer 下的实际视觉表现（尤其 meta-bar 是否还能正常先看到再滚走，还是被 `overflow:hidden` 的 viewer 内部区域直接遮挡/割裂）此前完全没验证过，需要 P4/P6 重点关注，不能假设和其他 7 种 viewer 表现一致。本次要求覆盖的具体测试 entry（均已在 `scripts/seed-data/` 现成可用，`make debug-quick` 自动灌入，不需要新增数据）：
  - Markdown → `markdown-test`；Code → `python-entry-service`
  - CSV → `csv-employees`；TSV → `tsv-server-metrics`
  - JSON → `json-api-config`；YAML → `yaml-docker-compose`；XML → `xml-maven-pom`
  - Image → `image-gallery` 或 `product-screenshots`（**滚动架构例外，重点验证**）
  - HTML → `html-csp-test`（**滚动架构例外，重点验证**）
  - SVG → `svg-standalone`；Mermaid → `mermaid-charts`；PlantUML → `plantuml-arch`

## executor_env

platform: claude-code
has_task_tool: true
has_local_runtime: true
network: full

## env_constraints

debug_env: "make debug-quick（:8888，/tmp/peekview-debug/ 隔离）；本任务需要 Playwright CDP 截图做视觉验收，playwright-cdp skill + vision-engine skill 已在本次调研中验证可用（:18800 Chrome CDP 可达）"
lint: "cd frontend-v3 && npx vue-tsc --noEmit（CI 强制）"
prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/"

## 裁剪倾向

- P1：BDD 需要覆盖 4 个问题点各自的可视觉验证条件（不能只写数值），且要明确"meta-bar 换行不截断""底部栏按钮风格一致性""padding 对称性"这类之前 T090 漏掉的观感类验收标准；**新增要求**：至少 1 条 BDD 显式要求"9 种 viewer 在移动端下 meta-bar/底部栏/正文边距渲染表现一致"，覆盖上方 known_risks 列出的全部 9 个测试 entry，其中 Image/HTML 两个滚动架构例外需要各自独立的 BDD（不能和其余 7 种合并成一条笼统断言）
- P2：`follows_existing_pattern`（Copy 对齐桌面端 `.icon-btn` 已有模式，Wrap 对齐 `source-toggle` 已有的 `.toggle-btn` 模式），候选方案基本已在本次会话内定型，P2 architect 主要工作是转成规范设计文档 + 声明 `files_to_read`/`gate_commands`，不需要重新探索候选。P2 需要评估 meta-tags-bar 嵌入内容流的方案对 ImageViewer/HtmlViewer 这两个滚动架构例外是否需要特殊处理（如是否需要在这两种 viewer 场景下调整 meta-bar 挂载位置或表现）
- P3：本任务风险点在于"图标按钮 active 态切换 + 无回归"，建议不裁剪，走 E2E 覆盖 Wrap 切换态和 Copy 点击行为（可能可以复用/微调 T090 遗留的 `t090-mobile-detail-ux-polish.spec.ts` 里已有的 BDD-6/BDD-7 相关用例，不需要整个重写）
- P6：**不可裁剪**，且必须是本任务质量把关的核心——真实截图 + vision-engine 分析，明确验证"看起来舒服"这类主观但必要的验收项，不能只做 DOM 测量。**验收范围覆盖全部 9 种 viewer**（不是只测 markdown），每种至少 1 张移动端截图，Image/HTML 两种额外确认 meta-bar 在滚动架构例外场景下的实际表现
- 风险：medium（代码改动本身仍是 4 个文件 + DESIGN.md 3 处修订、纯前端 CSS/图标替换，无 schema/权限/多端影响；但验收范围扩到全部 9 种 viewer + 2 个滚动架构例外场景，P6 工作量和不确定性明显高于最初的"只改 4 处"评估，不建议因为"代码改动小"而低估整体 risk_level 或裁掉 P6）

## 排期

T091（本任务）：T090 的直接视觉修正后续，无其他依赖，可立即启动。T089（Unicode 文件名链接修复）保持 P0 pending 不受影响。
