
[P1-progress] analyst 启动 — 读取角色定义 + dispatch-context + P0-brief
- 任务：T087 代码块行号 off-by-one bug 修复，小任务降级模式 (P1_simplified: true)
- 已确认事实采信：根因单点 useShiki.ts:renderLineNumbers:150-154，code.split('\n') 未处理末尾换行
- 三路径横切：CodeViewer / Markdown 代码块 / 源码视图，共用 renderLineNumbers
- 后端零改动，content 链路原样透传
- domains: frontend; risk_level: low-medium
[PROD_NOT_TOUCHED]

[P1-progress] 读取 useShiki.ts — 确认根因代码
- renderLineNumbers(code): code.split('\n') 直接 split，末尾 \n 产生空字符串元素
- highlight() (line 177-192): CodeViewer 路径，传 code 给 codeToHtml + renderLineNumbers
- highlightCode() (line 194-209): Markdown 路径，同样传 code 给两者
- 关键观察：codeToHtml 接收的 code 与 renderLineNumbers 接收的 code 是同一字符串
  → Shiki codeToHtml 对末尾 \n 的处理决定 .line 数量，需确认 Shiki 是否也产生尾部空 .line
  → 若 Shiki codeToHtml("a\nb\n") 产生 3 个 .line（含尾部空行），则当前 bug 是"行号3个 vs 高亮3个"对齐但多一个空号
  → 若 Shiki 产生 2 个 .line（吃掉末尾换行），则当前 bug 是"行号3个 vs 高亮2个"错位
  → 无论哪种，修复后行号数都应 = Shiki .line 数。需在 BDD 中以".line 数量"为锚点而非"实际代码行数"

[P1-progress] 读取 CodeViewer.vue — 确认消费方
- props.content 传给 highlight()，空 content 时（!props.content）直接置空 highlightedCode 不走 highlight
  → 空文件 "" 在 CodeViewer 路径被 falsy 短路，根本不渲染行号
  → 但 renderLineNumbers 若被独立调用（单测），"" → split('\n') → [""] → 1 个行号
  → BDD 空文件边界需区分"CodeViewer 实际渲染路径"（不渲染）vs "renderLineNumbers 纯函数"（1个行号）
- syncLineHeights(): wrap 开启时按 .line[index] ↔ .line-number[index] 配对同步高度
  → 行号数与 .line 数不一致时，配对错位 → 视觉 bug 的根因机制确认
  → 修复后两列数量必须一致，否则 wrap 同步仍会错位

[P1-progress] 读取 useMarkdown.ts — 确认 Markdown 路径
- fence renderer (line 265-273): code = token.content，markdown-it tokenize 的 fence content
- markdown-it 默认对 fence content 会 trim 末尾换行（token.content 不含尾部 \n）
  → Markdown 路径 code 通常不以 \n 结尾 → 当前 bug 在 Markdown 路径可能不复现
  → 但仍需 BDD 覆盖：Markdown 代码块行号数 = .line 数（不回归）
- highlightCode 调用点：line 363-368（diagram 代码视图）、line 378（普通代码块）
- buildCodeBlockWrapper 包裹 highlighted HTML，DOMPurify sanitize

[P1-progress] 关键查证：Shiki codeToHtml 的 .line 行为（实测 shiki 1.x）
实测结果（code → shiki .line 数 / split('\n') 数 / replace(/\n$/,'').split('\n') 数）：
- "a\nb\n"  → shiki=3, split=3, fixed-split=2
- "a\nb"    → shiki=2, split=2, fixed-split=2
- "a"       → shiki=1, split=1, fixed-split=1
- ""        → shiki=1, split=1, fixed-split=1
- "\n"      → shiki=2, split=2, fixed-split=1
- "a\n\n"   → shiki=3, split=3, fixed-split=2
- "a\nb\nc\n" → shiki=4, split=4, fixed-split=3

关键发现（修正 dispatch-context 的不准确描述）：
1. dispatch-context 说"Shiki 高亮列不多，两者错位"——这是**不准确**的。
   实际：Shiki codeToHtml 与 code.split('\n') 产生**相同数量**的行（都不处理末尾换行）。
   当前 bug 的真实表现是"行号列与高亮列**数量对齐**（都多一个），但都多出一个尾部空行"。
   即用户看到的不是"行号错位"，而是"行号比实际代码行数多一，且最后一行是空的"。
2. 用户拍板的修复方式"split 前去尾换行"若**只改 renderLineNumbers**：
   renderLineNumbers 出 2 个行号，但 codeToHtml 仍出 3 个 .line → **真正错位！**
   实测验证："a\nb\n" → 行号=2, .line=3, aligned=false（危险方案会引入新 bug）
3. 正确的修复语义：trim 末尾换行必须**同时**作用于 codeToHtml 的输入和 renderLineNumbers 的输入，
   才能保持两列对齐且行号数 = 实际代码行数。
   实测验证：trim 后 "a\nb\n" → shiki=2, lineNumbers=2, aligned=true ✓

[P1-progress] 空文件边界确认
- 空文件 ""：CodeViewer.vue:88 `if (!props.content)` 短路，不渲染任何行号/高亮 → CodeViewer 路径无空文件行号问题
- 但 renderLineNumbers 作为纯函数："" → replace(/\n$/,'')="" → split('\n')=[""] → 1 个行号
- Shiki codeToHtml("") → 1 个 .line（空内容）
- 两列对齐（1=1），合理：空文件显示"1"号 + 一空行，符合"文件至少有一行"的直觉
- [SUGGEST] 空文件渲染 1 个行号（与 Shiki 1 个 .line 对齐），不特殊处理为 0 个

[P1-progress] BDD 锚点决策
- BDD 的 Then 子句用"行号数 == 高亮 .line 数 == 预期行数"三联对齐，而非绑定 CSS 类名
- "预期行数"定义：文件内容的逻辑行数，POSIX 末尾 \n 不产生额外行
- 边界 case 全覆盖：末尾换行/无末尾换行/空文件/单行/仅换行符/中间空行+末尾换行

[P1-progress] 范围声明
- packages: useShiki.ts（主，highlight+highlightCode+renderLineNumbers）, CodeViewer.vue（验收）, useMarkdown.ts（验收）
- domains: frontend
- risk_level: low-medium（根因单点，但修复语义横切 codeToHtml 输入，P2 须注意）
- phases: [P1,P2,P3,P4,P5,P6,P7,P8] —— 不裁剪，原因：修复语义比 dispatch-context 描述的更复杂（须同步 codeToHtml 输入），横切 3 路径需回归
- capability_requirements: P6 需 Playwright 截图验证行号对齐（playwright-cdp skill 可用，supplementable）

[P1-progress] 产出文件自检
- Header: phase=P1, task_id=T087-code-linenumber-offbyone, type=problems, parent=P0-brief.md ✓
- BDD: 10 条（BDD-1..BDD-10），全部 Given/When/Then 结构 ✓
- BDD 二值判定自检：
  - Then 子句无 CSS 类名绑定（用"行号列数量 == 高亮列 .line 数量"描述结果，非实现细节）✓
  - Then 子句无 HTML 属性名绑定 ✓
  - 无主观形容词（"对齐"=数量相等+逐行配对，可二值判定）✓
  - 每条单一 Given-When-Then ✓
  - 编号连续 BDD-1..10 ✓
- domains: frontend ✓
- packages: 3 个声明 ✓
- risk_level: low-medium ✓
- phases: [P1..P8] 全保留 + 理由 ✓
- capability_requirements: browser-vision supplementable（非 GAP）✓
- 无未决 [NEED_CONFIRM]，空文件用 [SUGGEST] ✓
- 不掺实现方案（trim 策略留给 P2，标 [DESIGN_CONSTRAINT]）✓

[P1-progress] 关键提醒：P2 须注意的 DESIGN_CONSTRAINT
dispatch-context 的 bug 描述不准确（说"Shiki 高亮列不多"）。实测 Shiki codeToHtml 与 split 产生相同行数。
若 P2 只改 renderLineNumbers 不改 codeToHtml 输入 → 引入新错位。
P1 已在 BDD 用"行号数 == .line 数 == 逻辑行数"三联锚点规避此陷阱，P2 实现任何方案都须满足此三联。
