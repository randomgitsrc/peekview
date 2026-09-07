[P3-progress] 2026-09-07 test-designer
1. 已读 dispatch-context + 角色定义 test-designer.md：确认纯设计落盘（P3-test-cases.md 之外零产出）、不写 spec 代码、红灯由主 Agent 亲自跑
2. 已读 P1-requirements.md：13 条 BDD（BDD-1~5 fixture 自建与清理 / BDD-6~9 假绿修复与路径口径 / BDD-10~11 渲染正确性 / BDD-12 回归拦截 / BDD-13 规范落盘）；范围=3 spec + docs，不改产品代码；fixture slug e2e- 前缀倾向（P2 定稿）；等待策略不改（waitForTimeout 保留）
3. 已读 P2-design.md：M1-M3 逐行改动表（护栏/fixture helper/清理队列/断言迁移四件套）+ M4 docs 规范 4 条；§2.1 fixture 四件套定稿（beforeAll 护栏 + ensureEntry 预删→POST→入队 + afterEach splice 逐条匿名 DELETE [200,204,404] 容忍 + 断言迁移）；§2.2 内容定稿（diagram.md 单 mermaid flowchart 4-6 节点）；§2.3 mermaid-visual 自起 chromium 保留；§2.4 slug 定稿 e2e-<spec>-<case>-<chromium|mobile> 共 14 slug 上限；§2.5 完成标志含 BDD-6/7/8 静态检查；§6 gate_commands（P3 红灯=E2E_SPEC=e2e/mermaid.spec.ts make debug-test，AGATE_TDD_TIMEOUT=600）；R1-R9 风险表
4. 已读 P2-review.md：status approved（P-1 已修复 + S-1~S-4 已修复，§11.3 终态）；§1 实证锚点表可复用（3 spec 现状行号 L7/13/35/57/61、L4/16-26、L12/20-41/69-71/85/92；teams-page L20-45 清理队列；render-regression L39-61；t049 L7-11 预删；DiagramBlock.vue L164/169/177/187/212；MermaidRenderer.vue L6/9）
5. 已读现状 3 spec（与 P2-review §1 锚点逐行吻合）：
   - mermaid.spec.ts（75 行，3 test：SVG fills container properly / Code-Diagram toggle works / Fullscreen fills window）：L7 goto /entries/test-mermaid-2、L13/35 .mermaid-content[data-mode]、L57 .mermaid-action-btn、L61 .diagram-modal-overlay；无护栏无清理
   - mermaid-check.spec.ts（27 行，1 test：mermaid rendered and visible）：L4 goto playwright-test、L14 无条件断言先行 + L16-26 if(count>0) fail-safe 包裹、L18/23 .diagram-viewer 存活
   - mermaid-visual.spec.ts（101 行，3 test：check mermaid container height / check toggle functionality / check fullscreen）：L12/51/81 goto /entries/e2e-test、L20-41 双层 if+catch 假绿、L69-71 条件断言、L85/92 死选择器、L7-8/47-48/78-79 自起 chromium 三处
6. 进入产出撰写：P3-test-cases.md（test_code_dir 声明 → test 结构总览 → 13 BDD 映射表 → 清理钩子逐 spec → 红灯基线预留位 → BDD-6/7/8 命令级判据 → BDD-9/12/13 验收归属）
7. 产出落盘 P3-test-cases.md：§1 test_code_dir 声明 / §2 改造后 test 结构（7 TC 映射 M1-M3）+ 14 slug 枚举 / §3 13 BDD 1:1 映射表（BDD-13 含 A-07 文档类用例验收动作）/ §4 清理钩子逐 spec 标注（创建即入队 / afterEach 无条件删除 / [200,204,404] 容忍 / 其余 throw 显式 FAIL）/ §5 红灯基线（预留主 Agent check-tdd-red 回填位）/ §6 BDD-6/7/8 命令级静态判据 / §7 BDD-9/12/13 验收动作归属（BDD-12 基线窗口=P4 合入前）/ §8 与 P2 改动表对账说明
8. 机械锚点实测校验：改造前 expect 计数 21（13+3+5，修正手写 14）；seed e2e- 前缀 0 命中/共 24 条；svg-inline-render.spec.ts 无 t085（1 用例 dsh-architecture，已修正 A-06/§7.2 表述）；teams-page L20-26/L35-45 护栏与清理队列实测吻合
9. frontmatter：agate-md-field-set 逐个写入 phase/task_id/parent/trace_id/status/test_code_dir 全部 OK；agent key 被工具永久拒绝写入（防伪造身份设计，L307-309）——需主 Agent 知悉，check-frontmatter.py exit 0 不受影响
10. 自检通过：check-frontmatter.py exit 0；grep 'BDD-' 产出 = 40 处；正文 test_code_dir 字段形态残留清零；7 TC + 13 BDD 全覆盖
