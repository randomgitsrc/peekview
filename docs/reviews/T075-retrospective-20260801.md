# T075 structured-data-viewer 复盘

> 2026-08-01 | v0.14.0 | 53 BDD | 16 次 subagent 派发

## 1. 事实概览

### 1.1 时间线

| 阶段 | 完成时间 | 耗时 | 关键事件 |
|------|---------|------|---------|
| 立项 | 07-28 15:48 | — | P0-brief 创建后暂停（T084 优先） |
| P1 需求基线 | 08-01 04:51 | ~2h | 53 BDD，3 BLOCKER + 10 WARN 修订 |
| P2 方案设计 | 08-01 07:11 | 2.3h | 方案 A，plan-design-review 1 轮修订 11 项 |
| P3 TDD 测试 | 08-01 12:01 | 4.8h | 94 用例红灯，P2 gate_commands python→venv 修正 |
| P4 代码实现 | 08-01 16:38 | 4.6h | 3 BLOCKER + 11 MINOR 评审修订 + BDD-42 bug 修复 |
| P5 技术验证 | 08-01 17:57 | 1.3h | BDD-42 真 bug + 4 spec 缺陷 + E2E flaky 环境问题 |
| P6 验收 | 08-01 18:10 | 0.2h | 53/53 PASS |
| P7 一致性 | 08-01 18:14 | 0.1h | BLOCKER=0，DESIGN_GAP 2/2 配对 |
| P8 发布 | 08-01 18:20 | 0.1h | v0.14.0 minor bump |
| **P1-P8 总计** | | **13.5h** | |

### 1.2 产出规模

| 维度 | 数值 |
|------|------|
| BDD 条数 | 53（后端 6 + 前端 47） |
| 测试用例 | 94（vitest 52 + Playwright E2E 42） |
| 测试代码 | 1230 行 |
| 新增代码 | 970 行（7 新文件） |
| 修改代码 | ~850 行（6 文件） |
| 新增依赖 | @tanstack/vue-table + js-yaml + @types/js-yaml |
| dispatch-context | 20 个 |
| subagent 派发 | 16 次 |
| 阶段产出文件 | 41 个 |

### 1.3 问题发现与修复汇总

| # | 阶段 | 问题 | 类型 | 根因 | 修复方式 |
|---|------|------|------|------|---------|
| 1 | P3 | gate_commands `python` 命令不存在 | **agate 管理** | P2 architect 写 gate_commands 用 `python` 而非 `.venv/bin/python`，系统无 `python` 命令 | 主 Agent 修正 P2-design.md gate_commands |
| 2 | P3→P4 | TableView.spec 3 条断言数学上不可能成立（BDD-12/18/20） | **执行** | P3 test-designer 手写魔数断言与数据矛盾（2 列断言 3 列、filter 匹配数错、行数不足断言页数） | 派 test-designer 修正断言 + BDD-22 长超时 |
| 3 | P4 | design-review 3 BLOCKER + 11 MINOR | **技术** | a11y 键盘可达性（span@click 无 tabindex / th@click 无 button / type-tag 10px 对比度不达 WCAG AA） | 派 implementer 修复（button + focus-visible + font-xs + 加深色值 + 11 项 MINOR） |
| 4 | P5 | BDD-42 文件切换 parse-error 残留 | **技术（真 bug）** | selectFile 异步加载：fileContent='' 先清空 → TreeView JSON.parse('') 抛错 → parseError 置位 → content 加载后 parseError 无清除机制 → 停留 CodeViewer | parseTree 加空 content 检查（加载中不 emit parse-error） |
| 5 | P5 | E2E 4 个 spec 缺陷（BDD-18/20/30/52） | **执行** | P3 test-designer E2E spec 断言与真实数据矛盾（filter 匹配数 / CSV 行数不足 / aria-live 选择器 / 移动端宽列数据） | 派 test-designer 修正 4 条 spec |
| 6 | P5 | E2E 全量并发 4 failed + 4 flaky | **环境** | CDP Chrome :18800 fullyParallel 8 worker 共享连接竞争 → 偶发超时/retry | 单独重跑 8/8 全绿，判定环境 flaky 非代码缺陷 |
| 7 | P5 | vitest RPC 超时 2 errors | **环境** | TableView BDD-22 50000 行 jsdom 单文件 177s，worker RPC 通信超时 | 分离验证全绿，判定环境问题 |

## 2. 损耗分析

### 2.1 损耗分布

P1-P8 总耗时 13.5h。其中：

| 类别 | 估算耗时 | 占比 | 说明 |
|------|---------|------|------|
| **有效产出** | ~7.5h | 56% | P1 需求 + P2 设计 + P3 测试设计 + P4 实现 + P5 验证 + P6-P8 收尾 |
| **P3 测试断言 bug** | ~1.5h | 11% | 3 条单测断言 + 4 条 E2E spec 断言 → 2 次额外 test-designer 派发 |
| **P4 评审修订** | ~1.5h | 11% | 3 BLOCKER a11y + 11 MINOR → 1 次 implementer 修复 + 1 次 design-review 复验 |
| **P5 真 bug 修复** | ~0.5h | 4% | BDD-42 异步加载 parse-error 残留 |
| **agate 管理损耗** | ~1.5h | 11% | gate_commands python bug + dispatch-context 20 个文件维护 + P2 修正 |
| **环境 flaky** | ~1h | 7% | E2E 并发失败排查 + vitest RPC 超时排查 |

**损耗合计约 6h（44%），有效产出约 7.5h（56%）**。

### 2.2 与 T084 复盘对比

| 维度 | T084 | T075 |
|------|------|------|
| 总耗时 | 16h | 13.5h |
| 损耗比 | 44% | 44% |
| BDD 条数 | 14 | 53 |
| subagent 派发 | 7 | 16 |
| 真 bug | 1（BDD-02 overflow） | 1（BDD-42 parse-error） |
| spec 缺陷 | 0 | 7（3 单测 + 4 E2E） |
| 评审 BLOCKER | 0 | 3 |
| gate 拦截 | 3 次 | 1 次（gate_commands python） |

T075 规模是 T084 的 3.8 倍（BDD 53 vs 14），但损耗比持平（44%），说明 agate 协议在大规模任务下损耗率未恶化。但 spec 缺陷从 0 涨到 7，是新的损耗源。

## 3. 分类深挖

### 3.1 agate 管理原因

#### AGATE-M1: gate_commands python→venv 修正（P3 阶段，~0.5h 损耗）

**事实**：P2 architect 在 gate_commands 写 `python -m pytest`，但系统无 `python` 命令（项目用 `.venv/bin/python`）。check-tdd-red.sh 执行时 exit 127（command not found），被判定为 A-class error（exit code ≥ 120）。主 Agent 手动诊断后修正 P2-design.md 的 gate_commands。

**根因**：agate 协议规定"gate_commands 在 P2 固化后 P4-P6 不能改"，但 P2 architect 声明的命令本身无法执行是技术缺陷。AGENTS.md 明确说"gate_commands 建议引用 Makefile target"，但 P2 architect 没有遵守。

**改进方向**：
1. architect 角色文件应增加 gate_commands 校验清单："命令中的可执行文件是否存在于当前环境？"
2. P2 review 应检查 gate_commands 可执行性（plan-eng-review / plan-design-review 当前只看方案设计，不看命令可执行性）
3. agate 可在 P2 gate 后自动跑一次 gate_commands 干运行（dry-run）

#### AGATE-M2: dispatch-context 维护负担（20 个文件，~0.5h 损耗）

**事实**：T075 产出 20 个 dispatch-context 文件，每个都需要主 Agent 手写（目标/约束/上游关联/输入文件/客观查证信息）+ 注入卡片。其中 P4 阶段有 6 个 dispatch-context（backend-implementer + frontend-implementer + backend-review + frontend-design-review + test-designer-fix + frontend-implementer-bdd42 + frontend-implementer-revision），是全流程最密集的阶段。

**根因**：agate 协议要求"每次派发 subagent 前必须写 dispatch-context"——这是防止 subagent 上下文不足导致产出质量下降的合理约束。但在多包并行 + 多轮修复的场景下，dispatch-context 数量爆炸。

**改进方向**：
1. 多轮修复时，dispatch-context 可以只写"增量差异"（上次产出 + 本次修复目标），不必重复完整约束
2. P4 修复轮（revision）的 dispatch-context 可以合并到原 dispatch-context 的修订记录中

### 3.2 技术原因

#### TECH-1: BDD-42 异步加载 parse-error 残留（P5→P4 回退，真 bug）

**事实**：`entryDetail.selectFile()` 的时序是 `activeFile.value = file` → `fileContent.value = ''` → `await fetch` → `fileContent.value = content`。TreeView 的 `watch([props.content, props.format], immediate: true)` 在 content='' 时 mount，`JSON.parse('')` 抛 SyntaxError → `emit('parse-error')` → parseError 置位。fetch 完成后 content 更新、TreeView 重新 parse 成功，但 parseError 无清除逻辑 → showSourceView 恒 true → 停留 CodeViewer。

**根因**：这是 Vue 异步数据加载 + watch immediate 的经典时序陷阱。P2 设计文档详细描述了 parse-error 机制（§3.3），但没有考虑"加载中 content 为空"的中间态——设计假设 content 从非空开始。

**改进方向**：
1. P2 设计应在"解析失败降级"节显式声明"加载中（content 为空）不触发 parse-error"
2. TreeView/TableView 的 watch 应加 content 为空时的 guard clause

#### TECH-2: P4 评审 3 BLOCKER a11y（~1.5h 损耗）

**事实**：design-review 发现 3 个 a11y BLOCKER：
- A: DataTreeNode 值复制用 `<span @click>` 无键盘可达
- B: TableView 列头排序用 `<th @click>` 无键盘可达
- C: 类型标签 10px 字级 + 浅色主题对比度不达 WCAG AA 4.5:1

**根因**：P2 设计文档（§3.10/§3.11）详细定义了 aria-expanded/aria-label/aria-sort 等 a11y 属性，但没明确要求"交互元素用 `<button>` 而非 `<span>`/`<th>`"。implementer 遵循了设计文档的 a11y 属性要求，但没主动加键盘事件处理器。

**改进方向**：
1. DESIGN.md 应增加 a11y 规范："所有可点击的交互元素必须用 `<button>` 或加 `tabindex="0" role="button" @keydown.enter/space`"
2. P2 设计应在组件 Props 表中标注交互元素的语义 HTML 要求

#### TECH-3: vitest RPC 超时 + E2E CDP 并发 flaky（~1h 损耗）

**事实**：
- vitest 全量跑时 TableView BDD-22（50000 行 jsdom 渲染 177s）导致 worker RPC 通信超时，2 个 unhandled errors。分离验证全绿。
- Playwright E2E 全量并发（8 worker 共享 CDP :18800）时 4 failed + 4 flaky，单独重跑全绿。

**根因**：
- vitest 的 worker RPC 有默认超时（~30s），BDD-22 的 50000 行 jsdom 渲染远超此超时
- CDP Chrome :18800 是单连接，fullyParallel 模式下 8 个 worker 竞争同一浏览器实例

**改进方向**：
1. BDD-22 大数据量测试应降低 maxRows 阈值（如测试用 maxRows=100 而非 50000），或用 `testTimeout: 300000`
2. E2E 全量跑可改为 `workers: 1`（串行模式），牺牲速度换稳定性
3. 或拆分 E2E spec 文件减少单文件测试数

### 3.3 执行原因

#### EXEC-1: P3 测试断言 bug 7 条（~1.5h 损耗，最大损耗源）

**事实**：P3 test-designer 产出的测试中有 7 条断言与数据矛盾：
- 单测 BDD-12: content 2 列断言 `headers.length === 3`
- 单测 BDD-18: filter 'alice' 断言匹配 2 行但 'alicia' 不含 'alice'
- 单测 BDD-20: 250 行 perPage=100 断言第 3 页 100 行（实际 50）
- E2E BDD-18: filter 'user5' 断言 6 行实际 11 行
- E2E BDD-20: 120 行 perPage=100 无第 3 页
- E2E BDD-30: aria-live 选择器匹配到空 sr-only span
- E2E BDD-52: 3 列 CSV 在 390px 不横向溢出

**根因**：test-designer 在写量化断言（行数/列数/页数）时手写魔数，没有用生成器 + 可推导断言。P1 BDD 原文只要求定性（"表头行+数据行"/"包含该文本"/"切换后回第一页"），P3 test-designer 自行加了定量数字，但数字与测试数据不匹配。

**改进方向**：
1. test-designer 角色文件应增加规则："量化断言（行数/列数/页数/匹配数）必须从测试数据可推导，不允许手写魔数"
2. 或用参数化测试：`expect(rows.length).toBe(expectedRows(filter, data))` 而非 `expect(rows.length).toBe(6)`
3. P3 可以加一个"自检步骤"：测试设计完成后，主 Agent 跑一次 vitest 确认所有断言的失败原因是"实现未写"而非"断言数据矛盾"——但 check-tdd-red.sh 退化为 exit-code-only 模式时无法区分

#### EXEC-2: frontend subagent 越界写 src/ 实际位置（~0.3h 损耗）

**事实**：P3 frontend test-designer 把测试文件同时放到 P3-test-code/（规范位置）和 frontend-v3/src/（实际位置）。dispatch-context 明确写"测试文件放在 P3-test-code/ 目录，P4 implementer 会复制到实际位置"，但 subagent 仍然越界。

**根因**：subagent 可能认为"只有放到 src/ 下 vitest 才能扫到"（实际上 vitest 默认 include `**/*.spec.ts` 会扫到 docs/tasks/ 下的文件，但 frontend-v3 的 vitest root 是 frontend-v3/，docs/ 在其外不被扫到）。subagent 为了让红灯可验证而提前复制。

**改进方向**：
1. dispatch-context 的约束应解释"为什么"（"P3-test-code/ 是规范位置，P4 implementer 负责复制——你不需要提前复制，vitest 通过 TEST_RUNNER 或临时复制验证红灯"）
2. 或调整 vitest 配置让 P3-test-code/ 可被扫到（如 vitest root 改为项目根目录）

#### EXEC-3: seed-debug.py 硬编码问题（~0.5h 损耗）

**事实**：原有 seed-debug.py 将所有测试数据硬编码在 475 行 Python 字符串中（50KB），修改数据需要改 Python 代码。用户指出后重构为从 `scripts/seed-data/` 目录加载真实文件。

**根因**：初始设计图省事，把数据和逻辑混在一起。这不是 agate 协议的问题，是开发习惯问题。

**改进方向**：seed-data/ 目录模式应推广为项目标准实践——测试数据与测试逻辑分离。

## 4. 亮点

### 4.1 并行派发有效加速

P3（backend + frontend test-designer 并行）、P4（backend + frontend implementer 并行）、P4 评审（backend review + frontend design-review 并行）、P5（backend + frontend verifier 并行）——4 处并行派发减少了约 3-4h 串行等待。

### 4.2 BDD-42 根因诊断精准

verifier 在 E2E 失败后用 CDP 脚本精确复现了 4 步时序（table-view visible → code-viewer after source toggle → file-item count → tree-view count=0 + parse-error-banner），根因定位到 selectFile 异步加载时序。修复仅 5 行（parseTree 加空 content guard），精准无副作用。

### 4.3 P6 验收证据充分

53 条 BDD 逐条 PASS + 8 张互异截图 + 6 份 vision 报告 + 1 个断言 JSON。P6-evidence/ 目录 16 个文件，全部有实质内容（非 1 行 txt 充数）。provenance 审计 4 项 gate 全过。

### 4.4 P5 真 bug vs 环境 flaky 判定准确

主 Agent 亲自重跑 E2E 单独验证 4 failed + 4 flaky 全绿，正确判定为 CDP 并发环境问题而非代码缺陷。vitest RPC 超时也通过分离验证确认全绿。没有误判为真 bug 导致无谓回退。

## 5. 改进清单

| # | 类别 | 改进项 | 预期收益 | 优先级 |
|---|------|--------|---------|--------|
| IMP-1 | 执行 | test-designer 角色增加"量化断言必须从数据可推导"规则 | 消除 ~1.5h spec 缺陷损耗 | P0 |
| IMP-2 | agate | P2 gate_commands 加可执行性校验（dry-run） | 消除 ~0.5h gate_commands bug 损耗 | P1 |
| IMP-3 | 技术 | DESIGN.md 增加"交互元素必须用 button 或加键盘事件"规范 | 消除 ~1h a11y BLOCKER 评审损耗 | P1 |
| IMP-4 | 技术 | BDD-22 大数据量测试降低 maxRows 或加长超时 | 消除 vitest RPC 超时噪音 | P2 |
| IMP-5 | 技术 | E2E 全量跑改为 workers:1 或拆分 spec 文件 | 消除 CDP 并发 flaky | P2 |
| IMP-6 | agate | 多轮修复 dispatch-context 改为增量差异模式 | 减少 dispatch-context 维护负担 | P2 |
| IMP-7 | 执行 | seed-data/ 目录模式推广为标准实践 | 数据与逻辑分离 | P3 |

## 6. 结论

T075 是迄今最大规模的 agate 任务（53 BDD、16 次 subagent、970 行新增代码），P1-P8 耗时 13.5h，损耗比 44%——与 T084（14 BDD、16h、44%）持平，说明 agate 协议在大规模任务下效率未恶化。

最大损耗源是 P3 测试断言 bug（7 条，1.5h），根因是 test-designer 手写魔数断言。这是新的损耗类型（T084 未出现），需要在 test-designer 角色文件中增加量化断言规则。

BDD-42 真 bug 的发现和修复是 agate 流程的价值证明——P3 TDD 红灯 → P4 实现 → P5 E2E 发现异步时序 bug → 回退 P4 修复 → P6 验收通过，完整闭环。
