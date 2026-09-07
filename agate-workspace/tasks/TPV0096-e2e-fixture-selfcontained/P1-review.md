---
phase: P1
task_id: TPV0096
parent: P1-requirements.md
trace_id: TPV0096-P1-20260907
agent: requirements-review
status: approved
risk_level: medium
phases:
- P1,P2,P3,P4,P5,P6,P7,P8
packages:
- frontend-v3,docs
domains:
- frontend
---
# P1 需求评审 — TPV0096 E2E 红灯 spec 自建 entry 化

评审角色：requirements-review（独立 subagent，agent≠main）
评审对象：`agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P1-requirements.md`
评审方法：角色清单逐项 + 独立 grep 实证抽查（死选择器/死路由/匿名创建/projects 清单/seed-data/debt 登记），不轻信 analyst 摘要。

## 独立实证抽查（评审者自行 grep，非转述）

- `.mermaid-content` / `.mermaid-action-btn` / `.diagram-modal-overlay` 在 `frontend-v3/src/` 0 命中 → BDD-7 死选择器前提成立
- `.diagram-viewer` / `.diagram-code` / `.diagram-action-btn.fullscreen-btn` / `.diagram-modal` 在 `DiagramBlock.vue` L177/187/212 存活 → BDD-7 替代映射成立
- `router.ts` L48 仅 `path: '/:slug'`，无 `/entries/:slug` → 2.2 节 + BDD-8 前提成立
- `dev-server.sh` L112 `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE=true` → 2.3 节认证配对前提成立
- `playwright.config.ts` projects 仅 `chromium` + `Mobile Chrome`（L20-41）→ BDD-9 双 project 口径成立
- `frontend-v3/e2e/` 死选择器 12 处命中、`/entries/` goto 13 处命中，分布与 §4 命中清单逐行吻合（mermaid / mermaid-check / mermaid-visual / t022 / verify-mermaid）
- `mermaid-visual.spec.ts` L21-39 `if (isVisible)` + `.catch(() => false)` 包裹 `expect()` → BDD-6 假绿前提成立
- seed-data/ 24 目录；test-mermaid-2 / playwright-test / e2e-test 均 0 → BDD-1/BDD-4 前提成立
- `docs/process/debug-workflow.md` 存在 → BDD-13 落点合法
- `agate-workspace/debt/tech-debt.md` 含 DEBT0008（L188）/ DEBT0010（L227）→ §4 延后判定引用真实

## BDD 评审

- BDD-1: 可二值判定（playwright 退出码 0 为唯一判据，failed=0/skipped=0）；覆盖维度：数据✓ 前端✓ 边界✓（干净环境边界）
- BDD-2: 可二值判定（逐 slug sqlite3 count=0）；覆盖维度：数据✓（DB 残留）边界✓（清理完整性）
- BDD-3: 可二值判定（重跑次数 + 退出码 + BDD-2 复查）；覆盖维度：边界✓（幂等/累积残留）
- BDD-4: 可二值判定（slug 重名 0 + seed 24 条抽验 ≥3 条 200）；覆盖维度：数据✓（seed 冲突）兼容✓（既有数据不破坏）
- BDD-5: 可二值判定（状态码枚举白名单 200/204/404，其他→FAIL）；覆盖维度：边界✓（异常路径清理）
- BDD-6: 可二值判定（静态检查：不存在 `if(…isVisible…)` / `.catch(()=>false)` 包裹 expect）；覆盖维度：前端✓（假绿修复）
- BDD-7: 可二值判定（死类名 src 命中 0 + 每选择器在 src 存活）；覆盖维度：前端✓（DOM 契约）
- BDD-8: 可二值判定（`/entries/` 命中 0 + goto 形式 `/{slug}`）；覆盖维度：前端✓（路由契约）
- BDD-9: 可二值判定（两 project 分开统计均 0 failed；mermaid-visual 双遍口径已显式声明）；覆盖维度：前端✓ 边界✓（移动端视口）
- BDD-10: 可二值判定（boundingBox 容器 >200px + svg >100px 数值阈值）；UX 类别「渲染正确性」写入标题 ✓；覆盖维度：前端✓（渲染正确性）
- BDD-11: 可二值判定（视图切换可见/隐藏布尔 + modal 高度 >500px + 视口 1280x800 显式锚定）；UX 类别「渲染正确性」（含交互结束状态）写入标题 ✓；覆盖维度：前端✓ 交互✓
- BDD-12: 可二值判定（基线对照，不出现新失败；bdd_4/bdd_5 flaky 互换排除已显式声明）；覆盖维度：兼容✓（回归拦截）
- BDD-13: 可二值判定（文档同时存在两条规则文本）；覆盖维度：兼容✓（防复发规范）

**编号与格式**：BDD-1~13 使用 `#### BDD-NN:` 标准格式，连续不跳号 ✓；每条单场景单 Given-When-Then ✓；无「⚠️ 调整」「部分通过」中间态 ✓。

## 隐含需求覆盖

- 数据维度：覆盖（2.8 数据项——fixture slug 与 seed 24 条隔离 → BDD-4；DB 残留可清理 → BDD-2/BDD-3）
- 前端维度：覆盖（2.1 死选择器 → BDD-7；2.2 死路由 → BDD-8；2.4 假绿 → BDD-6；BDD-10/11 渲染正确性）
- 多端维度：覆盖（2.8 多端项——MCP/CLI 不涉及，理由成立：无产品代码改动）
- 边界维度：覆盖（2.3 认证配对——匿名建/匿名删混用→404→残留，技术链完整；2.5 渲染阈值稳定性 → BDD-10 阈值沿用；BDD-3 幂等）
- 兼容维度：覆盖（BDD-12 其余渲染 spec 不回归；BDD-4 seed 数据不破坏；2.8 兼容项显式列出）

结论：五维隐含需求覆盖完整，2.8 节逐维度清点且每条落到具体 BDD 编号，无遗漏。

## 跨条一致性

- BDD-1/BDD-3/BDD-9 同场景（干净环境跑 3 spec）判定口径一致：均以 playwright 退出码/failed 计数为准，无矛盾
- BDD-2 与 BDD-3 残留查询口径一致（同一 sqlite3 逐 slug count=0）
- BDD-5 的 404 容忍与 BDD-2 的 0 行查询不冲突（404=已删除容忍，DB 层面仍 0 行）
- BDD-9 显式声明 mermaid-visual 双遍执行口径，消除 BDD-1「每 spec 每用例每 project」的歧义
- 测试数据设计考虑环境约束：2.5 节明确现有 waitForTimeout 窗口内阈值可达，seed mermaid-charts flowchart 为实证

## frontend UX 机制评审

- UX 类别 BDD 齐备：BDD-10/BDD-11 标题含「渲染正确性」类别后缀 ✓；domains 含 frontend → 至少一条 UX BDD ✓
- 判据可量化：BDD-10 数值阈值（>200px/>100px）、BDD-11 布尔可见性 + 高度（>500px）+ 视口锚定（1280x800），无主观词（无可读/美观/流畅类表述）✓
- 形态声明：2.8 前端项声明「不新增/不改页面 UI，按缺省 layout 型处理」——与本任务仅测既有渲染的实际形态一致 ✓；BDD-10/11 采用可量化判据，符合「缺省形态下仍需量化」要求
- vision 能力声明：§6 `need: browser-vision` 含 visual/vision 词根，status: available 三态合法，available 清单（vision-analyst + playwright-cdp skill）具体 ✓；frontend 任务缺声明会触发 gate 硬拦，此处已正确声明
- 人工体验路径 BDD：文档 L28 显式声明不适用（产出为测试代码与文档，无新增用户可见页面），理由成立 ✓

## 裁剪合理性

- 跳过阶段：无——phases 为 P1-P8 全量，无裁剪，无需逐段审理由
- risk_level: medium 与实际匹配：不改产品代码（支持 ≤medium），但认证语义（匿名创建/删除配对）、清理可靠性（残留污染后续验证）、假绿修复的失败模式隐蔽（不立刻暴露）——不支持降为 low ✓
- ceremony: standard（缺省档，未声明 thin）→ thin 四要素 checklist 不触发；ceremony: full 未声明 → P7 保留性不受 full 档强制，但 phases 已含 P7 ✓
- P2 保留 + design_trivial/follows_existing_pattern（teams-page + render-regression 范式）简化声明合理：模式现成（P0 实证 createEntry L39），仅需定稿认证配对与 slug 策略
- P3 保留合理：被测对象即测试自身，红灯→绿灯即 TDD 闭环
- P6 保留合理：BDD-1~13 逐条实跑 + 证据，UI 断言需 Playwright 实跑
- P8 保留 + 不 bump：纯测试改动无用户可见行为变化，CHANGELOG [Unreleased] 记录即可——与 AGENTS.md 铁律 8（用户可见改动才强制 CHANGELOG）不冲突，此处为宽松侧记录 ✓

## 审声明（声明 vs 改动清单文字范围）

- 本阶段无 diff 可看（P1 先于实现），按 dispatch-context 指引核对「声明 vs 改动清单文字范围」自洽性：
  - packages: [frontend-v3, docs] ↔ 范围边界「只改 frontend-v3/e2e/ 与 docs/」一致 ✓
  - domains: [frontend] ↔ 被测对象为前端渲染链、无后端/MCP 改动一致 ✓
  - risk_level: medium ↔ 改动面（3 spec + 1 doc，认证配对 + 清理可靠性 + 假绿修复）一致 ✓
  - phases P1-P8 全保留 ↔ 多文件改动 + 机制交叉（fixture/清理/认证三层交互）→ 完整 agate 流程一致 ✓
- 声明与实际改动范围无失真，无 TAG0019 型「声明薄化但改动面大」错位

## P1 纯净性

- 2.1-2.7 各节定义「问题 + 约束 + 判据」，未指定实现方案（如未规定 createEntry 函数签名、未规定 slug 具体名——slug 命名显式留 P2 定稿）✓
- BDD 判据描述「做什么」非「怎么做」；技术细节（entries.py L477/L979 行号引用）为前提实证引用，非实现设计 ✓
- 无方案对比、无代码片段、无架构决策混入 ✓

## 流程合规

- [NO_NEED_CONFIRM] 声明存在（L26），4 条 SUGGEST 均有倾向 + 理由，不阻塞 ✓
- [SCOPE+ from P1] 死选择器迁移并入基线 2.1 节，[BASELINE_SCOPE_NOTE] 标注待主 Agent 确认 ✓
- 同类扫描（§4）：扫描动作、命中清单（8 行）、逐条判定（含「本次不处理 + 理由」）、回归拦截声明（BDD-13 规范落盘）、结论（确有同类实例非只此一处）五要素齐备 ✓
- P0-brief 时效性核对（§5）：无漂移结论 + 核对过程记录，满足阶段卡「无漂移写一行已核对」要求 ✓
- capability_requirements 三态 + verification_env/budget 声明齐备（§6）✓
- [PROD_NOT_TOUCHED]

## 建议（非阻塞，供 analyst 可选采纳）

1. BDD-1 可补注用例计数基数（mermaid 3 + mermaid-check 1 + mermaid-visual 3 = 7 用例 × 2 project = 14 跑次），使 P6 证据清点有显式分母——当前「failed=0/skipped=0 + 退出码 0」判据已可二值判定，不影响通过
2. §7 提及的 design_trivial/follows_existing_pattern 可同步落入 frontmatter 可选字段，便于 P2 路由机械读取——当前正文声明语义完整，不影响通过

## 终态结论

**approved**——13 条 BDD 全部可二值判定、编号连续、隐含需求五维覆盖、跨条一致、UX 判据量化、裁剪合理、审声明自洽、P1 纯净性通过；独立实证抽查未发现前提失实。
