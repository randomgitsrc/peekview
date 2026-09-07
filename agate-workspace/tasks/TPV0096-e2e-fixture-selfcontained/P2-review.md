---
phase: P2
task_id: TPV0096
parent: P2-design.md
trace_id: TPV0096-P2-20260907
agent: plan-design-review
status: approved
---
# P2 方案评审 — TPV0096 E2E 红灯 spec 自建 entry 化

评审角色：plan-design-review（独立 subagent，agent≠main，只审不写）
评审对象：`agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained/P2-design.md`（236 行）
基线对照：`P1-requirements.md`（13 条 BDD，BDD-1~13）
评审方法：按 dispatch-context 六焦点逐项评审；不轻信 architect 报告，对关键声明逐项独立 grep/read 实证；纯文档评审（未启动服务、未跑测试套件）。

## 1. 独立实证抽查（评审者自行核实，非转述）

| 声明 | 实证结果 | 锚点 |
|---|---|---|
| M1-M3 改动点「现位置」逐行 | 三个 spec 现状行号、死选择器、`if (isVisible)` + `.catch(() => false)` 假绿结构逐行吻合 | `mermaid.spec.ts` L7/13/35/57/61；`mermaid-check.spec.ts` L4/16-26；`mermaid-visual.spec.ts` L12/20-41/69-71/85/92 |
| 三先例范式 | 护栏（L20-26）、清理队列 splice(0) + [200,204,404]（L34-45）、`createEntry` 不吞错缺陷（L39-43 `.catch(() => {})`）、`gotoEntry` 正确写法（L59-61）、t049 预删（L7-11）全部实存 | `teams-page.spec.ts` / `render-regression.spec.ts` / `t049-…spec.ts` |
| 存活选择器映射 | `.diagram-block`(L164)/`.diagram-view-toggle`(L169)/`.diagram-action-btn.fullscreen-btn`(L177)/`.diagram-viewer` v-show(L187)/`.diagram-code` v-show(L212)；modal 类 `.diagram-modal` + Teleport(L6/9) | `DiagramBlock.vue` / `MermaidRenderer.vue` |
| seed-data 24 条、`e2e-` 前缀零命中 | 实测 `ls scripts/seed-data/` 恰 24 条，`grep -c '^e2e-'` 为 0 | §1.2 / §2.4 |
| debug 环境声明 | `PEEKVIEW_AUTH__ALLOW_ANONYMOUS_CREATE=true`(L112)、`RATE_LIMIT_ENABLED=false`(L114)、captcha 默认禁用(L95-105) | `scripts/dev-server.sh` |
| 匿名创建/删除语义 | 匿名强制 `is_public=True`(L136-139)；`allow_local = no_server_auth and current_user is None`(L478) | `backend/peekview/api/entries.py` |
| 死 goto 路由 | `path: '/:slug'`(L48)，`/entries/xxx` 落 `/:pathMatch(.*)*`(L54) → NotFoundView | `frontend-v3/src/router.ts` |
| M4 插入点 | 「调试检查清单」L228-243、「常见问题」L245，与设计声明的插入区间一致 | `docs/process/debug-workflow.md` |
| gate_commands 12 项全 Makefile target | `debug-test`(L648)/`test-frontend`(L173)/`typecheck`(L193)/`debug-start`(L561)/`debug-seed`(L570)/`debug-stop`(L619) 全部实存 | `Makefile` |
| E2E_SPEC 单值机制 → 拆键必要性 | `spec="${E2E_SPEC:-e2e/debug-server.spec.ts}"` 单值传参（L78）；`E2E_GUARD_ENABLED` 强制（L11-19）；内层 `E2E_TIMEOUT` 默认 600s（L92） | `scripts/run-e2e-tests.sh` |
| 双 project / fullyParallel 口径 | `fullyParallel: true`(L5)；projects 仅 chromium + Mobile Chrome（L20-41） | `playwright.config.ts` |
| R6 v-show 语义 | `diagram-viewer`/`diagram-code` 均为 `v-show`，`toBeVisible`/`toBeHidden` 语义正确的前提成立 | `DiagramBlock.vue` L187/L212 |

## 2. 焦点一：设计完整性 vs P1 基线

13 条 BDD 逐条对照设计落点：

| BDD | 设计落点 | 判定 |
|---|---|---|
| BDD-1 干净环境全绿 | M1/M2/M3 fixture + 护栏行（§1.1 三表「关联 BDD-1/2/4」）；护栏含 `/health` 探活（§2.1 件套 1） | 已覆盖 |
| BDD-2 无残留 | afterEach 清理队列（M1/M2/M3 各行）；BDD-2 逐 slug count=0 作 R2 兜底（§1.3 R2 缓解） | 已覆盖 |
| BDD-3 重跑稳定 | 防御性预删（§2.1 件套 2，t049 L7-11 先例）+ 确定性 slug（§2.4 拒绝 Date.now/workerIndex 的理由正对 BDD-3） | 已覆盖 |
| BDD-4 不与 seed 冲突 | `e2e-` 前缀显式枚举（§2.4）+ seed-data 不改声明（§1.2）；24 条零 `e2e-` 前缀实证成立 | 已覆盖 |
| BDD-5 清理失败显式失败 | `[200,204,404]` 容忍、其余 throw（M1 清理行、§2.1 件套 3） | 已覆盖 |
| BDD-6 断言无条件执行 | M2 移除 `if (count > 0)` 包裹（fail-safe 定性准确——L14 已有无条件先行断言）+ M3 test1 拆除双层假绿；§2.5 含静态检查判据 | 已覆盖 |
| BDD-7 死选择器清零 | M1 4 处 + M3 3 处逐行迁移（均 src 实证）；§2.5 静态检查 + §7 选择器清单 | 已覆盖 |
| BDD-8 goto `/:slug` | M1/M2/M3 goto 行全部迁移，写法引 render-regression L59-61 | 已覆盖 |
| BDD-9 双 project 口径 | 自起 chromium 保留（§2.3 理由 1 直接引 BDD-9/BDD-11 原文口径） | 已覆盖 |
| BDD-10 渲染存在性 + 尺寸 | M3 test1 无条件断言 + 阈值容器 >200/svg >100（§2.1 件套 4 原样保留） | 已覆盖 |
| BDD-11 交互后结束状态 | M3 test2 切换断言 + test3 modal >500 无条件化（§1.1 M3 表第 3 行） | 已覆盖 |
| BDD-12 回归拦截 | §1.2 显式不动 `run-e2e-tests.sh`/`playwright.config.ts`；svg-inline-render/render-regression 不触碰。§2.5 未列 BDD-12 基线对照（见 S-4，非阻塞） | 已覆盖（佐证在 P5/P6 实跑） |
| BDD-13 规范落盘 | M4 规范 4 条，前 2 条正对 BDD-13 判据，落点与插入点精确 | 已覆盖 |

P1 的四项 [SCOPE+]（死选择器 §2.1 / goto §2.2 / 假绿 §2.4 / 护栏 §2.6）在设计中的落点：BDD-7 迁移行、BDD-8 goto 行、BDD-6 拆除行、护栏件套——全部承接，无遗漏。

**结论**：13/13 有设计落点，SCOPE+ 全覆盖。

## 3. 焦点二：影响面梳理质量

1. **Modify**：M1-M4 落点精确到「文件 + 行号 + 现位置 + 改为 + 关联 BDD」，无「相关代码」式模糊表述；每行均经 §1 实证抽查核对无误。
2. **Not Modify**：9 项显式且理由充分——backend/src 边界、config 并发模型、运行脚本、seed-data、其余 36 个 spec（t022/verify-mermaid 延后与 P1 §4 判定一致，SUGGEST-4 已采纳）、硬等待（TPV0097 边界）、版本/CHANGELOG（P8 边界）。范围边界清晰，可直接供 P4 判断「顺手改进」红线。
3. **Risk**：R1-R9 每条有证据（config L5/teams-page 先例/entries.py 行号/dev-server.sh L112/组件 v-show/Teleport/Pixel 5 viewport/P2 卡禁令）+ 每条有缓解。R2 的「队列只存 slug 结构性杜绝混用」与 R3 的「不吞错」是本设计最关键的两处质量点，缓解措施到位。

**结论**：三部分齐全且证据级，质量高。

## 4. 焦点三：gate_commands 合理性

内容层核查：

1. 12 项全部引用实存 Makefile target（§1 抽查表）——属实。
2. 测试键裸 `P3`，无 `P3_xxx` 检测键（P2 卡 BDD-6 禁令遵守）；`P5_e2e_b`/`P5_e2e_c` 为 P5 域拆分键，有 TPV0095 `P5_e2e_b` 直接先例（gate 已通过），`_e2e` 形态属白名单后缀，不违反禁令。
3. 每键单命令、无 `&&` 链（TAG0004 反模式规避）。
4. `P5_e2e` 拆三键的必要性成立：`run-e2e-tests.sh` L78 的 `E2E_SPEC` 单值机制决定多 spec 必须分键。
5. P3 红灯语义成立：P3 键选 mermaid.spec.ts（改造面最大），红灯命令跑在**改造前代码**上——现状 spec 引用不存在的 `test-mermaid-2` + 死选择器 + 死 goto，对干净 debug 环境必红灯；不依赖「改造后 spec 跑改造前代码」的歧义形态。与 TPV0095 teams-page「P3 期页面未实现 → 预期红灯」先例同构。
6. per-key timeout 档位（E2E 600s / 单测 300s）符合三档基准表并吸取 TPV0093 教训；P3_timeout_seconds 按卡规则正确声明为不覆盖运行时机制的静态字段。
7. 后端 pytest 不入表的理由（backend 零改动、P5 卡通用基线兜底）成立。

**前瞻性问题 P-1（gate 阻断级，见第 9 节问题清单）**：candidate_count: 1 的降档合法性与 gate 机械扫描口径脱节——问题不在 gate_commands 块本身，而在 P1/P2 间的声明位置，会导致主 Agent 预跑 `check-gate.py P2` 直接 exit 1。

## 5. 焦点四：自包含执行模式充分性

§4 `runtime_prereq` 与 §5「平台执行模式（下游 P3/P5/P6 必读）」双落点，模式定义（单次 bash 调用内 start + seed + 验证 + stop，外层 timeout 300s 起，严禁漏 debug-stop）与主 Agent 实测的平台事实（服务不跨调用驻留）一致，足以约束 P3/P5/P6 派发。

遗漏场景排查：

1. **E2E 多次重跑**（BDD-3 连续 2 次）：模式内循环展开即可（`<验证/测试>` 槽位可容纳多次运行），无机制冲突。
2. **多键连续跑**（P5_e2e/_b/_c 三键或 BDD-1 三 spec 依次）：单调用内顺序执行或逐键独立自包含均可，模式兼容。
3. **失败路径的 debug-stop 保证**：设计写了「严禁漏 debug-stop」但未显式覆盖测试命令失败分支——若执行方用 `&&` 链，红灯（P3 预期）或意外失败会跳过 debug-stop，下阶段遇脏 DB 使 BDD-1 的干净环境前提失效。建议 checklist 化（见 S-3，非阻塞）。

**结论**：模式充分，附一条 checklist 化建议。

## 6. 焦点五：候选方案取舍

1. **简化声明**（§0）：三先例逐一定位到行号级（teams-page L20-45 / render-regression L39-61 / t049 L7-11），「不存在需多方案权衡的开放分叉」论证成立；`follows_existing_pattern` 列出了参照文件路径（P2 卡 L108 要求的形态）。两个开放决策点（非分叉）均方案内定稿并附理由——定性准确。
2. **slug 显式枚举**（§2.4）：拒绝 Date.now / workerIndex 的理由正对 BDD-3 确定性与 BDD-2 可枚举性；projectKey 一行派生；7 case × 2 project = 14 slug 上限算术正确；跨 spec 前缀重叠但完整 slug 不重名；与 fullyParallel 并发（R1）互洽。
3. **mermaid-visual 自起保留**（§2.3）：与 BDD-9/BDD-11 的 P1 固化口径自洽，且隔离性（CDP 共享 Chrome）、最小 diff、R8 视口解耦三点真实成立——不是保守倾向，是有依据的定稿。
4. **认证配对**（匿名建 + 匿名删）：落实路径完整——R2 结构性排除（队列只存 slug，无 token 字段）+ §2.1 件套统一适用于三 spec + §4 auth_pairing 声明 + M4 规范第 4 条成文拦截 + minimal_validation 实测匿名 DELETE 200。每个 spec 都走同一四件套，无单点遗漏。

**结论**：取舍自洽，定稿理由均与 BDD 口径互证。

## 7. 焦点六：files_to_read

10 条：3 改造对象（全文）+ 3 先例（精确行区间）+ 2 组件参照（只读）+ 1 docs 插入点 + 1 config（只读）。每条有 why；未列入 entries.py/dev-server.sh（P4 只写 spec 不碰后端，认证语义已由设计消化）、未列 seed-data——上下文控制得当，无「把相关文件全列上」的反模式。10 条对 3 spec + 1 docs 的产出面不算过载。

**结论**：精简且足以支撑 P4。

## 8. UI 维度组判定

依据 dispatch-context：本任务 `ui_affected: false`（纯 e2e 测试与文档改动，无 UI 组件改动），P1/P2 均未声明 `ui_render_shape`（回落布局型默认）；评审重心按六焦点执行。

| 维度组 | 判定 | 依据 |
|---|---|---|
| 布局（移动端考虑/组件完整性） | 维度不适用 | `ui_affected: false`，无页面/组件新增或修改（P2 frontmatter + P1 §1 范围边界） |
| 交互（状态覆盖率/交互细节/可访问性） | 维度不适用 | 同上；spec 仅以断言验证既有渲染，不定义交互行为 |
| 视觉（布局/颜色/字体/组件一致性） | 维度不适用 | 同上；BDD-10/11 的尺寸断言是「渲染正确性」验收判据而非视觉设计产出 |
| 渲染正确性与时序 | 维度不适用（不单独打分） | 形态未声明 render_component/temporal_effects，回落布局型默认；渲染判据已并入 BDD-10/11 逐条评审（焦点一） |
| 候选方案 ≥2 + 权衡（UI 布局层下沉要求） | 维度不适用 | 无 UI 布局方案层；架构层 candidate_count 与简化声明在焦点五评审 |

不虚构打分。§7「UI 测试选择器清单」按 P2 卡建议项核对：任务不改产品代码、无法新增 data-testid，沿用 src 实证 class 作稳定标识的决策合理，且清单与 §1.1 迁移目标一一对应。

## 9. 问题清单（needs-revision 修复指引）

### P-1（阻断级）：简化声明位置与 check-gate.py 机械扫描口径脱节，gate 预跑必 exit 1

**现象与证据链**：

1. `check-gate.py` 的 `gate_p2`（checkout L830-845，`/home/kity/oclab/agateon/agate/scripts/check-gate.py`，与 `~/.agate` 部署版逐行一致）：`candidate_count` 从 P2-design.md 行首 `^candidate_count:` 读取（P2 frontmatter L10 命中 → 1）；而降档条件 `min_candidates = 1` **只认 P1-requirements.md 中行首的 `design_trivial:` / `follows_existing_pattern:` 声明**——正则 `^(design_trivial|follows_existing_pattern):\s*\S`（`agate_common.py` L953，`^` 锚定行首）。
2. 实测模拟扫描：`P1-requirements.md` 全文行首命中 **0** 处（P1 §7 L231 的声明位于 bullet 缩进行内的反引号引用中：`- P2：保留——…声明 \`design_trivial: true\`…`，不满足行首形态）；`P2-design.md` 行首 `candidate_count:` 命中（L10）。
3. 推演结果：主 Agent 预跑 `check-gate.py P2` 时 `min_candidates=2 > candidate_count=1` → **exit 1**，报「需至少 2 个候选方案（design_trivial/follows_existing_pattern 时可只写 1）」。

**定性**：P2-design.md 的内容实质合规（P2 卡 L106-108 仅要求「声明 + 理由」，未规定声明必须在 P1 的哪个位置；P1 §7 的声明语义完整且主 Agent 已采纳）。属机械字段位置与 gate 实现口径的脱节，不是设计分叉缺失。但该问题若不在修复轮处理，P2 推进条件「预跑 check-gate.py P2」直接失败，将无谓消耗重试预算。

**修改建议（按优先级）**：

1. **首选**：主 Agent 在 `P1-requirements.md` §7「裁剪说明」内补两行**顶格**声明（gate 扫描 P1 全文行，正文顶格即命中，不动 frontmatter、零 schema 风险）：

   ```yaml
   design_trivial: true
   follows_existing_pattern: [frontend-v3/e2e/teams-page.spec.ts, frontend-v3/e2e/render-regression.spec.ts]
   ```

   同时 architect 在 P2-design.md §0 末尾补一句指针（如「简化声明同时以顶格字段形式存在于 P1 §7，供 check-gate.py P2 机械扫描读取」），保持两文件对账一致。P2-design.md 的方案内容无需任何改动。
2. **备选**：P1 frontmatter 加同名两字段——需先确认 `agate-frontmatter-check.py` 的 P1 schema 白名单接受这两个字段（P1 卡明示过白名单不含 `ui_render_shape`，schema 白名单制下有被拒风险），故列备选。
3. **明确不取**：把 P2 `candidate_count` 改为 2、凑一个无真实分叉的候选方案——虚假合规，违背 candidate_count 字段「你写几个候选就填几个，与正文一致」的定义。

### S-1（建议）：P3 键运行时超时的提醒缺口

`gate_commands.P3` 运行时消费 `AGATE_TDD_TIMEOUT`（默认 120s，P2 卡规则 1）；而 P3 红灯一轮实际含 `debug-start + debug-seed + debug-test`（E2E 内层上限即 600s），120s 默认值大概率不够 → `check-tdd-red.py` 以 exit 124 超时 JSON 收场。红灯语义不被污染，但需人工二次判读。建议 §6 说明补一句：主 Agent 派发 P3 时显式设 `AGATE_TDD_TIMEOUT=600`（或 ≥600）。

### S-2（建议）：E2E 外层 timeout 与内层同值的余量

`P5_e2e*` 档位 600s 与 `run-e2e-tests.sh` 内层 `E2E_TIMEOUT` 默认 600s（L92）同值；按 P2 卡「预期耗时 ×1.5」纪律，外层声明宜留余量（如 900s），避免内外层同秒竞争造成误判。属执行层自由裁量，维持 600 亦可（内层已自带硬超时保护），不构成缺陷。

### S-3（建议）：失败路径的 debug-stop 保证 checklist 化

§4/§5 已写「严禁漏 debug-stop」，建议在 P3/P5/P6 的 dispatch-context 把失败分支显式化，例如执行形态 `…; rc=$?; make debug-stop; exit $rc`（先取测试退出码、无条件 stop、再透传退出码），防止红灯/失败场景跳过清理导致下阶段遇脏 DB。

### S-4（建议）：§2.5 可补 BDD-12 基线对照行

「实现完成的标志」未列 BDD-12（svg-inline-render / render-regression t085 用例改造前后基线对照）。P5 卡通用基线会覆盖实跑，但 §2.5 补一行可让 P5/P6 直接引用判据，减少返读成本。非必须。

## 10. 评审结论

| 项目 | 结论 |
|---|---|
| 焦点一 设计完整性 | 通过（13/13 BDD 落点 + SCOPE+ 全覆盖） |
| 焦点二 影响面梳理 | 通过（Modify 精确 / Not Modify 9 项显式 / R1-R9 有缓解） |
| 焦点三 gate_commands | 内容通过；发现跨文件声明位置问题 P-1 + 建议 S-1/S-2 |
| 焦点四 自包含执行模式 | 通过（附建议 S-3） |
| 焦点五 候选方案取舍 | 通过（三处定稿均自洽） |
| 焦点六 files_to_read | 通过（10 条精简且 why 明确） |
| UI 维度组 | 维度不适用（`ui_affected: false` + 无 UI 改动，见第 8 节） |
| **整体判定** | **needs-revision**（1 条阻断级问题 P-1：修复动作在 P1 顶格声明 + P2 §0 一句指针，P2-design 方案内容无需返工；4 条建议项均不阻塞） |

修复轮完成后按 review 迭代循环再审；本评审的实证锚点（第 1 节表）可直接供修复轮与 P4 implementer 复用。

## 11. 复审轮结论（2026-09-07）

复审方法：逐项对照第 9 节修复指引核对修复落点；对 P-1 用与首轮发现问题时相同的方法做机械复核（gate 同款正则 `^(design_trivial|follows_existing_pattern):\s*\S` 实测扫描 + candidate_count 判定模拟）；双文件跑 check-frontmatter.py；方案实质内容不重复评审（首轮已通过）。

### 11.1 逐项核对结果

| 项 | 修复落点核对 | 机械验证 | 判定 |
|---|---|---|---|
| P-1 要点①：P1 顶格声明 | P1 §7 L226-227 两行顶格，声明内容与第 9 节首选方案完全一致 | gate 正则行首命中 2 处（L226 `design_trivial: true`、L227 `follows_existing_pattern: […]`）；模拟判定 `candidate_count=1 >= min_candidates=1` → **PASS**（首轮同法实测 FAIL） | 已修复 |
| P-1 要点②：P2 §0 指针 | P2-design §0 末尾（L28）指针句，注明 [BASELINE_CHANGE] 已批准 | — | 已修复 |
| [BASELINE_CHANGE] 标注 | P1 L229，含「主 Agent 2026-09-07 批准」+ 纯声明位置修正定性 + BDD 语义零变更声明 | grep 实存 1 处；`#### BDD-` 计 13 条零变更，声明属实 | 已修复 |
| S-1：AGATE_TDD_TIMEOUT 提醒 | §6 说明新增（L229）：默认 120s 不足、主 Agent 派发 P3 须显式设 ≥600，与建议一致 | — | 已修复 |
| S-2：E2E 外层余量 | gate_commands P5_e2e 三键 timeout 600→900（L222-224），§6 约束行同步「外层余量避让 run-e2e-tests.sh 内层 E2E_TIMEOUT=600」；P3 保持 600（正确——P3 声明仅静态，运行时走 AGATE_TDD_TIMEOUT 机制） | — | 已修复 |
| S-3：失败分支 debug-stop | §4 runtime_prereq（L186）+ §5 平台执行模式（L205）双落点，形态 `…; rc=$?; make debug-stop; exit $rc` 与建议一致 | — | 已修复 |
| S-4：BDD-12 基线对照行 | §2.5 新增末行（L149），含「既有 flaky bdd_4↔5 互换不计新失败」口径，与 P1 BDD-12 判据一致 | — | 已修复 |

### 11.2 回归性核查

- check-frontmatter.py：P1-requirements.md exit 0、P2-design.md exit 0——修复未破坏 frontmatter schema。
- P1 BDD 完整性：BDD-1~13 零变更（[BASELINE_CHANGE] 的「BDD 语义零变更」声明经实证）。
- P2-design.md 方案实质内容（§1-§3、§7-§8）与首轮通过版本零漂移；§5 新增「复跑备注」为事实记录（二次复跑零请求零副作用，首次实测仍为权威证据），不影响判定。

### 11.3 终态

P-1 与 S-1~S-4 全部按第 9 节指引修复到位，机械验证通过，无新问题 → **status: approved**。gate_commands 键集、超时档位、红灯语义以修复后的 §6 为准（P5_e2e 三键 900s）；主 Agent 可按 P2 卡流程预跑 `check-gate.py P2` 并推进 P3（派发 P3 时按 §6 提醒设 `AGATE_TDD_TIMEOUT=600`）。

