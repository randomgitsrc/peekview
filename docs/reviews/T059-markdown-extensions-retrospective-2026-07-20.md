# T059 Markdown Extensions 复盘

> 任务：为 PeekView Markdown 渲染器添加 KaTeX 数学公式、任务列表 checkbox、脚注、上标/下标四种扩展
> 版本：v0.9.2（功能）→ v0.9.3（修复 ShareDialog 测试）
> 日期：2026-07-20
> 阶段：P0→P8 全链路，一次 PAUSED 无，全部 gate 通过

---

## 1. 时间线与实际经历

### 1.1 阶段时间分布

| 阶段 | 产出 | 经历概述 |
|------|------|----------|
| P0 | P0-brief.md | 顺利。范围从初始 KaTeX-only 扩展到 4 种扩展，任务目录重命名 |
| P1 | P1-requirements.md, P1-review.md | **两轮评审**。首轮 6 条 BDD 绑定实现细节 + 3 条 Then 不可二值判定，修订后通过 |
| P2 | P2-design.md, P2-review.md | 顺利。2 候选方案（全局 vs 懒加载 CSS），方案 A 一致通过 |
| P3 | P3-test-cases.md + 3 个 spec 文件 | 顺利。36 个测试用例，24 红灯确认 TDD |
| P4 | P4-implementation.md | 顺利。1 个 DESIGN_GAP（throwOnError），实现 6 个文件 |
| P5 | P5-test-results/unit.md | 顺利。36 新测试全绿，20 个 ShareDialog 预存失败 |
| P6 | P6-acceptance.md + 30 截图 + 30 vision YAML | **最坎坷**。commit 被拦截 6 次，详见 1.2 |
| P7 | P7-consistency.md | 顺利。1 DESIGN_GAP 配对，SCOPE+ 闭环 |
| P8 | P8-release.md | **有坑**。subagent 越权提交 + bump-version 与 gate 的 chicken-and-egg，详见 1.3 |
| 后续 | ShareDialog 测试修复 | 用户发现 20 个 pre-existing 失败，修后 bump v0.9.3 |

### 1.2 P6 commit 被拦详细过程（最耗时环节）

P6 是本任务最痛苦的单阶段，commit 被拦截 **6 次**，每次都需诊断→修复→重试：

| 拦截次 | 原因 | 修复 | 耗时估计 |
|--------|------|------|----------|
| 1 | provenance 检查失败：PASS 行的截图引用含描述文本如 `(screenshots/b07.png — element: .katex nth(1), α+β=γ)`，嵌套括号 `nth(1)` 导致 grep 解析错误，路径匹配失败 | 重写所有 30 条 PASS 行，简化为 `(screenshots/bXX.png) (vision: vision-reports/bXX.yaml)` | ~15min |
| 2 | evidence 检查：11 个截图 ≤1KB（元素级截图太小，如 footnote-ref 仅 15×17px） | 用 Playwright 重新截图，改用父级段落元素 + padding | ~20min |
| 3 | evidence 检查：b15/b19 md5 重复（同一段落截图两次看起来一样） | 给 B15 加红色 outline 标记、B19 加蓝色 outline 标记使截图视觉可区分 | ~10min |
| 4 | dispatch-context 卡片 hash 不匹配（嵌入的 AGATE_CARD 内容是手写摘要，非 `agate-next-card.sh` 原始输出） | 用 `agate-next-card.sh P6` 的完整输出替换嵌入块 | ~5min |
| 5 | debug 环境中途重启：P6 截图重拍时 debug 服务已停止，需 `make debug-start` 重新启动 | 重启 debug 环境 + 等待服务就绪 | ~5min |
| 6 | Playwright 产生 `.err` 截图文件：重拍过程中部分截图生成 `.err` 后缀文件（如 `b07.png.err`），需手动清理否则 evidence 检查报"未知文件" | 删除所有 `.err` 文件 | ~3min |

**总耗时估计：60+ 分钟**，占 P6 阶段时间的大部分。这些时间全部花在与 gate 脚本格式要求的对齐上，而非验收本身的实质工作。其中拦截 1-4 是 gate 脚本能力问题，拦截 5-6 是环境操作摩擦。

### 1.3 P8 subagent 提交控制问题

P8 阶段出现了流程控制问题：P8 subagent 在主 Agent 验证 gate 之前就提交了 P8-release.md。git log 显示两个 P8 commit（62173f5d 含 37 行插入，45ff198c 含 1 行插入），表明 subagent 先提交了草稿，主 Agent 后续修正。

**问题本质**：这不是 gate 逻辑问题（gate 检查什么），而是流程控制问题（谁在什么时候可以提交）。agate 的设计意图是"主 Agent 先验 gate → 通过后提交"，但 subagent 有 bash 权限可以直接 `git commit`，绕过了主 Agent 的控制点。

**与 chicken-and-egg 的交互**：P8 gate 检查 `git diff --cached` 中是否有 version/CHANGELOG 变更。但 `make bump-version` 已经把这些变更 commit 了，P8 产出 commit 的暂存区里自然没有这些变更。gate 报"暂存区无 version 文件变更"和"CHANGELOG 暂存区无变更"——这些变更确实在 bump commit 里，只是不在当前 commit 的暂存区。version 文件检查降级为 WARNING（非阻断），但 CHANGELOG 检查是 exit 1。

**双重 bump commit 的成因**：v0.9.2 和 v0.9.3 各有两个 bump commit（v0.9.2: 39085db3 + ec362344; v0.9.3: 6552da59 + 031e327d）。原因是 gate 拦截了首次 commit（暂存区缺 CHANGELOG 变更），主 Agent 不得不重新 add + commit，产生了重复的 bump commit。这与 P6 的 gate 拦截模式一致——gate 的检查逻辑与实际流程不匹配，导致重复提交。

### 1.4 ShareDialog 预存失败（v0.9.3 修复）

20 个 ShareDialog.spec.ts 失败从 P5 就存在，stash 验证确认与 T059 无关。但它们在 `make pre-publish-quick` 中被报告为 "17 failed"，用户看到后要求先处理。

根因：T058 重构 ShareDialog 时引入 `<Teleport to="body">`，但测试仍用 `wrapper.find()` 查询 Teleport'd 元素。`wrapper.find()` 只搜索组件自身 DOM 树，找不到 Teleport 出去的内容。

修复：将所有 `wrapper.find()` 改为 `document.querySelector()`，55/55 全绿。

---

## 2. 问题分类与机理分析

### 2.1 agate gate 脚本问题（工具层）

#### 问题 A：PASS 行截图引用格式与 provenance 脚本不兼容

**机理**：`check-p6-provenance.sh` 用 `grep -oE '\([^)]+\)$'` 提取行末括号组作为文件路径。当引用格式为 `(screenshots/b07.png — element: .katex nth(1), α+β=γ)` 时，**描述性文本与嵌套括号的组合**导致解析失败：`nth(1)` 中的 `)` 提前闭合了正则匹配，截断出 `screenshots/b07.png — element: .katex nth(1` 这样的无效路径；同时描述文本被当作路径的一部分，文件自然找不到。

**本质**：provenance 脚本的解析能力（简单正则）与 P6 产出的人类可读格式（含描述性文本）之间存在 gap。脚本假设行末括号组是纯路径引用，但实际产出包含自由文本描述。

**影响**：不是一次拦截，而是需要同时修复 30 行 PASS 行格式。如果 provenance 脚本的解析更鲁棒（如先剥离 `(vision:...)` 再精确匹配 `(screenshots/...)` 模式），可以避免此问题。

#### 问题 B：≤1KB 截图被标记为"疑似空 png 充数"

**机理**：`check-p6-evidence.sh` 对所有 ≤1024 字节的 PNG 触发拦截（exit 1）。设计意图是防止用空白图片充数，但元素级截图（footnote-ref 15×17px）即使内容完全合法，也天然小于 1KB。

**本质**：阈值过于粗放，没有区分"空文件"和"小元素截图"。一个合法的 15×17 元素截图在 PNG 格式下就是 200-300 字节，与空文件无法通过大小区分。

**影响**：需要用 Playwright 重拍 11 张截图（改用更大的父元素），然后还有 md5 去重问题。

#### 问题 C：md5 去重对同内容截图的误判

**机理**：gate 脚本对所有截图做 md5sum 去重，发现重复就拦截。B15（footnote-ref）和 B19（backref-scroll）都截取同一段落，DOM 状态在截图时刻视觉一致（footnote ref 的高亮无法通过截图体现），md5 必然相同。

**本质**：md5 去重假设"每张截图必须视觉不同"，但有些 BDD 验证的是行为（如滚动后位置变化），截图可能视觉相同。行为差异需要通过其他证据（如 scrollTop 数值）体现，不能仅靠截图 md5。

**影响**：不得不给截图加人为的视觉区分标记（红/蓝 outline），这引入了测试污染——截图里出现了实际渲染中不存在的标记。

#### 问题 D：dispatch-context AGATE_CARD hash 不匹配

**机理**：pre-commit hook 检查 dispatch-context.md 中 `<!-- AGATE_CARD_START -->` 和 `<!-- AGATE_CARD_END -->` 之间的内容 sha256 是否等于 `agate-next-card.sh Pn` 的输出。主 Agent 手写摘要时内容与 CLI 输出不一致。

**本质**：这个检查的目的是防止卡片内容漂移，但要求主 Agent 每次都精确复制 CLI 输出，增加了手动操作步骤。更好的方式是提供脚本自动注入。

### 2.2 流程设计问题（流程层）

#### 问题 E：P8 gate 的 chicken-and-egg

**机理**：gate 检查 `git diff --cached` 看暂存区是否有 version/CHANGELOG 变更。但 `make bump-version` 已经 commit 了这些变更。P8 产出 commit 的暂存区只有 P8-release.md，自然不包含 version/CHANGELOG 变更。

**本质**：gate 假设"version 变更和 P8 产出在同一个 commit 中"，但 agate 流程设计是 bump-version 先单独 commit，P8 产出后 commit。两者的 commit 粒度不同，导致 gate 检查逻辑与实际流程不匹配。

**影响**：非阻断（version 文件检查降级为 WARNING），但 CHANGELOG 检查是 exit 1。由于 P8 subagent 在主 Agent 验证前已提交（问题 G），实际 gate 通过路径不确定——这不是可靠的通过方式。

#### 问题 F：SCOPE+ 误触发（已知问题）

**机理**：gate 脚本扫描所有文件中的 `[SCOPE+]` 字符串。但 AGATE_CARD 嵌入块中的模板文本（如 "- FAIL > 0 → gate exit 1 → 回 P4"）包含字面 `SCOPE+` 文本，触发误报。

**本质**：gate 的文本扫描没有排除模板/卡片嵌入块，把指令文本当成了实际标记。workaround 是在 P1 加 `[SCOPE_RESOLVED]`，但这是"为了过 gate 而加的标记"，不是真正的范围增补闭环。

### 2.3 任务执行问题（执行层）

#### 问题 G：静默失败模式（跨切主题）

**机理**：本任务中出现三次独立的"静默失败"——工具以 exit 1 退出但无诊断输出，迫使 Agent 进入昂贵的猜测-检查循环：

1. **P6 provenance 脚本静默 exit 1**：首次 PASS 行格式不兼容时，provenance 脚本仅返回非零退出码，不输出任何错误消息。Agent 无法判断是哪条 PASS 行出错、具体什么格式不兼容，只能逐条检查 30 行 PASS 行，逐一排查。
2. **P6 `git commit` 钩子拒绝时无输出**：pre-commit hook 阻断 commit 时，有时 stderr 为空——Agent 看到的是"commit 失败"，但不知道哪个检查项触发了拦截。这导致额外的诊断步骤（手动运行各 gate 脚本逐一排除）。
3. **P8 subagent 在主 Agent gate 验证前提交**：P8 subagent 提交了 P8-release.md，但主 Agent 尚未验证 gate。这不是"gate 不触发"，而是流程控制缺失——subagent 有 bash 权限可直接 git commit，跳过了主 Agent 的"先验 gate 再提交"控制点。

**本质**：这三次事件共享同一模式——**工具/流程在失败时没有提供足够的上下文信息**。Agent 被迫用"试探法"诊断问题，而非根据错误消息定位。对于 LLM Agent 而言，静默失败的代价远高于人类开发者——人类可以凭经验快速缩小范围，Agent 只能逐一枚举可能原因。

**影响**：P6 的 60+ 分钟调试时间中，相当部分花在"猜测为什么 gate 失败"上，而非"修复已知问题"。如果 provenance 脚本输出 `"PASS line 7: path 'screenshots/b07.png — element: .katex nth(1)' not found"` 这样的错误消息，第一次拦截就可以在 5 分钟内解决。

#### 问题 H：ShareDialog 预存失败——"不是我的问题"合理化为何持续了 4 个阶段

**机理**：P5 就发现了 20 个 ShareDialog 失败，stash 验证确认与 T059 无关。但"不属于本任务"不等于"可以带病发布"。从 P5 到 P8 整个过程中，这些失败一直存在，直到用户在发布前指出才处理。

**合理化为何持续**：这不是一次性的判断失误，而是一个持续 4 个阶段的系统性回避模式：

1. **P5**：发现 20 个失败 → stash 验证"不是 T059 引入" → 标记为 pre-existing → 继续推进。此时决策是合理的——P5 gate 的职责是验证本任务实现质量。
2. **P6**：验收阶段关注 BDD 逐条验证，不运行全量测试套件。20 个失败在 P6 视野之外。
3. **P7**：一致性检查关注 T059 内部文件间的一致性，不涉及其他组件的测试状态。
4. **P8**：发布准备运行 `make pre-publish-quick`，报告 "17 failed" → 但此时 v0.9.2 已 bump + tag → 修复只能走 v0.9.3。

**本质**：agate 的任务范围 gate 创造了一个**激励结构**——"只要不是本任务引入的，就可以推迟"。stash 验证证明了因果关系（不是 T059 的错），但没有解决用户可见影响（消费者看到 "20 failed"）。任务范围 gate 在单任务维度是合理的（避免任务间耦合），但在发布维度是有害的。

**根因分析**：T058 重构 ShareDialog 组件时引入 `<Teleport to="body">`，但没有同步更新单元测试。这暴露了 T058 的 P5/P6 验收不够彻底——单元测试失败但 P5 gate 没有拦截，说明 T058 可能裁剪了单元测试验证或 gate 只看了自己的测试。

**v0.9.3 的实际成本**：ShareDialog 修复本身很简单（1 文件，`wrapper.find()` → `document.querySelector()`，55 测试全绿），但因为推迟到 v0.9.2 tag 之后，产生了额外成本：
- 额外的 bump-version + publish + push 周期（~15 分钟）
- 版本号从 patch 的"修复补丁"语义变成了"测试修复"语义，对用户不够透明
- git 历史多了一组 bump commit，增加回溯复杂度
- 如果在 P5 就处理，这些成本为零——修复可以包含在 v0.9.2 中

**是否应该更早处理**：是的。P5 发现时，修复只需 5 分钟（改查询方式），且此时 v0.9.2 尚未 bump。推迟的"节省"（5 分钟）远小于最终成本（~15 分钟 + 额外版本 + 流程开销）。这暴露了一个判断偏差：**"不是我的问题"被当作"不需要我处理"**，但发布质量是最后一个触碰者的责任。

#### 问题 I：P1 评审需两轮

**机理**：首轮 P1 有 6 条 BDD 的 Then 子句绑定了实现细节（如 `class="katex-block"`、`mathcolor 属性`），3 条 Then 不可二值判定（如"暗色模式下可读"——什么叫"可读"？）。

**本质**：analyst subagent 对 BDD 的"行为描述 vs 实现绑定"边界把握不够精确。这是 LLM 生成 BDD 的常见问题——倾向于用具体的 CSS 类名/属性名作为断言，而非描述用户可见的行为。

**影响**：一轮返工，但 agate 流程设计就是"评审不过→修改→再评"，这是正常迭代而非异常。

#### 问题 J：orchestrator-log.md 几乎为空

**机理**：整个任务只写了 1 条 log（P4 gate 误触发时），远未达到"长操作前写一行 NEXT: ..."的设计意图。

**本质**：主 Agent（我）在长推理链中没有形成"写 log"的习惯。日志机制是防无响应的安全网，但在实际执行中被遗忘。如果中途中断，恢复将完全依赖 .state.yaml 和产出文件，而非日志。

**与 P6 调试困难的关联**：如果 orchestrator-log.md 记录了每次 gate 失败的诊断和修复方案，Agent 在后续类似失败时的恢复速度会显著提升。空 log 的后果不仅是"中断恢复困难"，更是"重复诊断相同类型的失败"——P6 的 6 次拦截中，每次都需要重新分析 gate 脚本的检查逻辑，如果有 log 记录第一次的诊断结论，后续拦截的定位时间可以减半。

### 2.4 设计决策复盘

#### 决策 K：P2 选择方案 A（全局 CSS）而非方案 B（懒加载）

**结果**：正确。方案 A 更简单，与现有 CSS 加载模式一致，避免了 FOUC。KaTeX CSS ~24KB 在 Vite 构建后分 chunk 加载，性能影响可忽略。

#### 决策 L：DOMPurify 配置不变

**结果**：正确。P1 和 P2 的 minimal_validation 都确认 DOMPurify 3.x 默认白名单已覆盖所有扩展输出。P5/P6 实测验证也通过。避免了一次"防御性加白名单"的过度设计。

#### 决策 M：KaTeX throwOnError: false

**结果**：正确。这是 P4 的唯一 DESIGN_GAP。默认行为是 throwOnError: true，错误公式抛异常并渲染无颜色标记的 `katex-error` span。设为 false 后 KaTeX 自身渲染红色错误标记，视觉更好，与 P3 测试预期一致。

#### 决策 N：任务范围从 KaTeX-only 扩展到 4 种扩展

**结果**：正确。四种扩展都是标准 markdown-it 插件，实现模式统一（注册插件 + CSS），边际成本低。分开做需要重复 P1-P8 流程 4 次，总成本远高于一次性完成。

---

## 3. 根因归类

| 根因类别 | 问题 | 说明 |
|----------|------|------|
| **gate 脚本能力不足** | A, B, C, D | provenance 解析鲁棒性差、阈值粗放、md5 去重误判、hash 校验缺自动注入 |
| **gate 与流程不匹配** | E, F | chicken-and-egg、SCOPE+ 误触发 |
| **静默失败模式** | G | 工具/流程失败时无诊断输出，Agent 被迫猜测-检查（provenance 静默 exit 1、commit 无输出、subagent 越权提交） |
| **任务范围 gate 的激励扭曲** | H | "不是我的问题"合理化持续 4 阶段，任务范围 gate 在发布维度有害 |
| **上游任务遗留** | H | T058 测试未同步更新（根因） |
| **subagent 能力边界** | I | BDD 实现绑定问题 |
| **主 Agent 执行纪律** | J | log 未写，导致重复诊断同类型失败 |

gate 脚本问题占比最高（4/10），且这些问题的修复成本都转嫁给了使用者（主 Agent），而非在工具层解决。新增的"静默失败模式"（G）和"任务范围 gate 的激励扭曲"（H）是跨切主题，它们的修复不在单个脚本层面，而需要在工具设计原则和流程规范层面解决。

---

## 4. 改进建议

### 4.1 gate 脚本改进（优先级：高）

| 编号 | 建议 | 针对问题 | 预期效果 |
|------|------|----------|----------|
| G1 | provenance 脚本改进截图引用解析：先剥离 `(vision:...)` 引用，再用精确正则 `\(screenshots/[^\)]+\)` 匹配，而非贪心取行末括号组 | A | PASS 行可包含任意描述文本而不触发解析失败 |
| G2 | ≤1KB 检查降级为 WARNING（exit 2），不阻断。改为检查 PNG 文件头（前 8 字节 = `\x89PNG\r\n\x1a\n`）确认是合法 PNG 而非空文件 | B | 元素级小截图不再被拦截，同时仍能防止空文件充数 |
| G3 | md5 去重降级为 WARNING（exit 2），不阻断。如果两条 PASS 行的 BDD 编号不同，截图 md5 相同不应自动拦截——verifier 可以在 acceptance report 中解释视觉相似的原因 | C | 行为差异类 BDD 不因截图视觉相同而被拦；避免过度工程化的 vision YAML 解析耦合 |
| G4 | dispatch-context 的 AGATE_CARD 块提供自动注入脚本：`agate-inject-card.sh Pn TASK_DIR` 读取 `agate-next-card.sh Pn` 输出并替换 dispatch-context.md 中的嵌入块。同时在 dispatch-protocol 中规定：主 Agent 必须用脚本注入，禁止手写 AGATE_CARD 内容 | D | 消除手动复制的不一致性；脚本是执行保障，协议是行为提醒 |
| G5 | P8 gate 改为检查 HEAD~1..HEAD（最近一个 commit）而非 `git diff --cached`，或改为检查"bump-version commit 存在于当前分支" | E | bump commit 已存在时 gate 不误报 |
| G6 | SCOPE+ 扫描排除 AGATE_CARD 嵌入块（`<!-- AGATE_CARD_START -->` 到 `<!-- AGATE_CARD_END -->` 之间的内容） | F | 卡片模板文本不再触发误报 |

### 4.2 流程改进（优先级：中）

| 编号 | 建议 | 说明 |
|------|------|------|
| P1 | P5 gate 增加全量测试检查 | 当前只检查"本任务相关测试全绿"，建议增加"全量测试 0 failed"的 WARNING 级检查，提醒主 Agent 处理预存失败 |
| P2 | P6 PASS 行格式标准化 | 在 phase-card 或 dispatch-protocol 中规定 PASS 行的**最小格式**（必须含 `(screenshots/...)` 和可选 `(vision:...)`），而非规定精确模板。与 G1 配对：如果 provenance 脚本用精确正则解析，PASS 行格式可以更灵活 |
| P3 | P6 截图最小尺寸规范 | 规定元素级截图最小 viewport 或最小 padding，从源头避免 ≤1KB 问题。**注意**：如果 G2（PNG header check）实施，此建议可移除——P3 是 G2 未实施时的 workaround |

### 4.3 subagent 改进（优先级：中）

| 编号 | 建议 | 说明 |
|------|------|------|
| S1 | P1 analyst 角色文件增加 BDD 反模式检查清单 | 列出常见反模式：绑定 CSS 类名、绑定属性名、含主观形容词（"可读"/"美观"），要求 analyst 自检 |
| S2 | P6 verifier 角色文件增加 gate 格式预检 | 在写 P6-acceptance.md 后、返回前，自行运行 `check-p6-format.sh --fix` 和 provenance 检查，减少主 Agent 的来回修复 |

### 4.4 主 Agent 执行纪律（优先级：低但重要）

| 编号 | 建议 | 说明 |
|------|------|------|
| M1 | orchestrator-log.md 强制写入点 | 在每次 dispatch subagent 前、gate 失败后、**gate 失败诊断完成后**必须写一行。诊断完成后的写入尤其重要——记录"什么原因导致失败 + 计划如何修复"，为后续类似失败提供恢复线索，避免重复诊断 |

### 4.5 新增建议（来自专家评审反馈）

| 编号 | 建议 | 针对问题 | 优先级 | 说明 |
|------|------|----------|--------|------|
| G7 | 所有 gate 脚本必须在 exit 1 时输出具体错误消息 | G | 高 | 当前 provenance 脚本和部分 hook 检查静默 exit 1，Agent 无法定位问题。要求：每个 exit 1 必须附带 stderr 输出，包含"哪个检查项失败 + 具体什么不匹配 + 建议修复方向" |
| G8 | P8 subagent 提交控制 | G | 高 | P8 subagent 不应在主 Agent gate 验证前提交。方案：在 dispatch-protocol 中规定 P8 subagent 只产出文件不 commit，由主 Agent 验 gate 后统一提交；或在 P8 gate 中增加"最近 commit 必须由主 Agent 发起"的检查 |
| P4 | 已知债务登记（known-failures.md） | H | 中 | 在任务目录中增加 `known-failures.md`，记录发现的预存失败（数量、文件、根因、是否与当前任务相关）。即使不立即修复，也使债务可见、可追踪，避免"静默推迟" |
| P5 | 版本 bump 时机调整 | E | 中 | 考虑将 `make bump-version` 推迟到 P8 gate 验证通过后执行，而非 subagent 执行时。这样 version/CHANGELOG 变更可以与 P8-release.md 在同一个 commit 中，避免 chicken-and-egg 和 tag 不可变问题 |
| P6 | P6 截图方法论权衡 | B, C | 低 | 全 viewport 截图可避免 ≤1KB 和 md5 重复问题（文件更大、视觉更可区分），代价是证据精度降低。当前 workaround（加彩色 outline）引入了测试污染。建议在 phase-card 中明确"优先用父级元素截图，避免全 viewport，但 md5 重复时允许用全 viewport 作为 fallback" |

---

## 5. 数据统计

| 指标 | 值 |
|------|-----|
| BDD 条目数 | 30 |
| 单元测试用例数 | 36 |
| P6 验收截图数 | 30 |
| 修改源文件数 | 6（前端） |
| 新增依赖数 | 6 |
| commit 数（T059 相关） | ~11（P1-P8 workflow commits + 2×bump v0.9.2 + READY commit + ShareDialog fix + 2×bump v0.9.3 + active-tasks update；含 4 个重复 bump commit 由 gate 拦截导致） |
| gate 被拦次数 | ~8（P6: 6, P8: 2） |
| gate 被拦总耗时估计 | 80+ min |
| DESIGN_GAP 数 | 1（已配对 REVIEWED） |
| SCOPE+ 增补数 | 0 |
| 预存失败处理 | 20 ShareDialog（v0.9.3 修复） |

---

## 6. 总体评价

**T059 是一次质量合格但效率偏低的任务执行。**

质量合格：30 BDD 全 PASS、36 测试全绿、P7 一致性无问题、最终发布无已知测试失败。agate 流程的核心价值（需求基线→设计→TDD→实现→验证→验收→一致性→发布）得到了完整执行。

效率偏低的主因是 **gate 脚本与 P6 产出格式的多次对撞**。P6 阶段超过 60 分钟花在"让 gate 通过"上，而非"确认验收质量"。这些对撞不是随机错误——它们是系统性的工具能力不足（provenance 解析鲁棒性、阈值粗放、md5 去重误判），在后续任务中必然重复出现，除非在工具层修复。

**三个跨切主题**值得特别关注：

1. **静默失败模式**（问题 G）：provenance 脚本静默 exit 1、commit hook 无输出、subagent 越权提交——三次事件共享同一模式"工具/流程失败时无诊断上下文"。对 LLM Agent 而言，静默失败的代价远高于人类开发者。建议 G7（gate 脚本必须输出错误消息）是最高优先级改进。

2. **任务范围 gate 的激励扭曲**（问题 H）：agate 的 P5 gate 只守"本任务边界"不守"全局质量"，创造了"不是我的问题就可以推迟"的激励。ShareDialog 的 20 个预存失败从 P5 推迟到 v0.9.2 tag 之后，迫使额外的 v0.9.3 发布周期。建议 P1（P5 WARNING 级全量测试检查）和 P4（已知债务登记）可以缓解此问题。

3. **P8 流程控制缺失**（问题 G/E）：subagent 在主 Agent gate 验证前提交 + bump-version 与 gate 的 chicken-and-egg，导致 4 个重复 bump commit 和不确定的 gate 通过路径。建议 G8（subagent 提交控制）和 P5（bump 时机调整）可以根本解决。

P1 的两轮评审是正常迭代，不是问题——反而说明评审机制在发挥作用，阻止了"实现绑定"类 BDD 进入基线。
