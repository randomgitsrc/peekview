# P1-review 进度日志

## 维度 1: BDD 条件可二值判定（含编号格式 + 单条 GWT）
- BDD-1..BDD-10 连续不跳号，格式 `#### BDD-NN:` 合规
- BDD-1..BDD-6, BDD-9, BDD-10：单条 GWT，Then 二值可判（行号数 == .line 数 == 逻辑行数，整数比较，PASS/FAIL 明确）
- BDD-7: Given 含"可能已被 trim"——Given 不确定，但 Then 是"无论是否 trim 两列对齐"——可二值判定（取实际渲染结果比对）
- BDD-8: Given "多个代码块（不同语言、不同末尾换行）" Then "每个代码块对齐"——可二值判定（逐块比对）
- 结论：10 条 BDD 均可二值判定，BDD-7 的"可能 trim"是 Given 的不确定性但 Then 锚定最终渲染结果，不影响二值判定

## 维度 2: 隐含需求覆盖（逐维度）
- 数据：P1 §2 明确"无"——content 原样透传，已读 useShiki.ts:185/202 确认 codeToHtml 与 renderLineNumbers 收同一 code，无后端改动。覆盖✓
- 前端：§2 列出行号列/高亮列对齐变化 + wrap 模式 syncLineHeights 配对一致性（BDD-9）。覆盖✓
- 多端：P1 明确"无"——纯前端 composable。覆盖✓（MCP/CLI/API 不涉及）
- 边界：§2 列空文件/仅换行符/单行无换行/中间空行+末尾换行 4 个边界，BDD-3/4/5/6 覆盖。覆盖✓
- 兼容：§2 提 wrap 模式不破坏 + BDD-8 不回归。覆盖✓

## 维度 3: BDD 跨条一致性（重点：BDD-4 vs §2 边界声明）
- §2 边界声明："空文件（""）：renderLineNumbers 纯函数对 "" 产生 1 个行号（与 Shiki 1 个 .line 对齐）"
- BDD-4 Then："不渲染行号列也不渲染高亮列（CodeViewer 对空 content 短路）"
- 矛盾分析：两处锚点不同——§2 锚定"renderLineNumbers 纯函数行为"，BDD-4 锚定"CodeViewer 实际渲染路径"
- 已核实 CodeViewer.vue:88 `if (!props.content)` 短路——空文件根本不调 renderLineNumbers
- 结论：这是"纯函数层"vs"组件层"两个不同抽象层的描述，不构成逻辑矛盾，但 §2 边界声明的措辞会误导读者以为空文件会渲染 1 个行号。建议 P1 在 §2 边界声明补注"（纯函数层；CodeViewer 组件层短路不渲染，见 BDD-4）"消除歧义。判定：轻微措辞歧义，不阻断，needs-revision 轻量级

## 维度 4: 裁剪合理性
- phases: [P1..P8] 全保留，无裁剪——裁剪评审 N/A（无跳过阶段）
- risk_level: low-medium，理由"根因单点 + 无后端 + 无 schema + 无权限，但修复横切 codeToHtml 输入 + 3 路径回归"——与实际匹配✓
- capability_requirements: browser-vision (supplementable)——P6 截图验证需要，playwright-cdp+vision-engine 可用，三态判断正确✓

## 维度 5: P1 纯净性（重点：[DESIGN_CONSTRAINT] 是否混入解决方案设计）
- §2 [DESIGN_CONSTRAINT]："trim 必须同时作用于 codeToHtml 和 renderLineNumbers 两个输入"
- 分析：这是"结果行为约束"（两列必须对齐 + 行号数=逻辑行数）而非"实现方式规定"。P1 §2 末尾明确"留给 P2 决定如何达到对齐（trim 输入共享/分别 trim/其他）"
- 但措辞"trim 必须同时作用于"隐含了"trim 是唯一手段"——若 P2 提出"split 后 pop 末尾空元素"非 trim 方案，是否违反此约束？
- 判定：约束的实质是"两列对齐且行号数=逻辑行数"，trim 只是 P1 的一种描述。措辞略有实现倾向，但不构成硬性方案锁定。建议 P1 把 [DESIGN_CONSTRAINT] 改写为纯结果导向："修复后 codeToHtml 输出与 renderLineNumbers 输出的行数必须一致且等于逻辑行数；实现手段（trim 输入/后处理/其他）由 P2 决定"。判定：轻微纯净性瑕疵，不阻断，needs-revision 轻量级

## 实测结论可信度验证（useShiki.ts）
- useShiki.ts:185-190 highlight(): code 同时传给 codeToHtml(line185) 和 renderLineNumbers(line190)
- useShiki.ts:202-207 highlightCode(): 同上
- Shiki 1.x codeToHtml 对末尾 \n 确实产生尾部空 .line（Shiki 内部按 \n split 渲染，不去尾）——P1 结论可信
- P0 原描述"Shiki 高亮列不多，两者错位"不准确，P1 修正为"两列都多，对齐但多空行"——修正合理，且 P1 据此调整了 BDD 锚点（三联对齐而非两列错位）
- 结论：P1 实测结论可信，BDD 锚点据此正确调整

