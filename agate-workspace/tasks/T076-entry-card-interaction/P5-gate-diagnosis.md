---
phase: P5
date: 2026-07-30
trigger: gate_fail
agent: main
---
# P5 Gate 诊断

- gate 结果：单测 typecheck exit 0 / 1057 passed（全绿）；e2e exit 1，28 passed 12 failed（42 total）
- 失败BDD: BDD-16/17/18/19（chromium+Mobile，8 failures）、BDD-02/04（chromium，2）、BDD-20/21（chromium+Mobile，2）
- 诊断：12 项全部为测试侧缺陷，实现正确（主 Agent 独立核实）
  - 类别 A（BDD-16~19，8 failures）：e2e goToListView() 用 `.locator('.view-toggle-btn', { hasText: /list/i })`，但实现按钮是 SVG icon + `title="List view"` 属性无文本，hasText 匹配 textContent 不匹配 title attr → 测试选择器 bug
  - 类别 B（BDD-02/04，2 failures）：测试用 `.entry-card .card-title` `.first()` 定位，但列表按时间排序，其他测试创建的 entry 更晚，`.first()` 命中错误 entry → 测试隔离 bug
  - BDD-20（2 failures）：seedEntry 未传 token → 匿名 entry 无 username → meta-username 链接不存在 → Tab 遍历自然不含它 → 测试数据 setup bug（BDD-20 验证 username 焦点，前置需有 username 的 entry）
  - BDD-21（2 failures）：主 Agent 核实实现 hover CSS 正确（默认 border var(--c-border-strong)=rgba(0,0,0,.13)，hover var(--c-accent)=#0969da，二者明显不同）；verifier 测得 hover 前后均 rgba(0,0,0,.13) → CDP 远程连接 hover() 未触发 CSS :hover（测试环境限制，非实现 bug）
- 路由：修复 P3 e2e spec（测试侧），不回 P4（实现正确）。修后重跑 P5_e2e 全量
- 修复方向（test-designer）：
  - 类别 A：goToListView 选择器改 `.locator('.view-toggle-btn[title="List view"]')` 或 getByTitle('List view')
  - 类别 B：改 `page.locator('.entry-card .card-title', { hasText: entry.summary })` 精确定位
  - BDD-20：先注册/登录用户拿 token，seedEntry 带 token（entry 有 username）
  - BDD-21：优先改可靠 hover（page.mouse.move 到元素中心 + waitForTimeout 等 transition）；若 CDP 仍不触发 :hover，降级为 CSS 规则存在性检查 + 在 P6 用 vision 验证 hover 截图，并登记 known-failures.md 说明 CDP 限制
- 约束：修复只改 e2e spec 的 selector/隔离/数据 setup，不得削弱 BDD 语义（每个测试仍验证对应 BDD 行为）；不改实现代码
