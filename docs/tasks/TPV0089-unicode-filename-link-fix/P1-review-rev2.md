---
phase: P1
task_id: TPV0089-unicode-filename-link-fix
type: review
parent: P1-requirements.md
trace_id: TPV0089-P1-review-rev2-20260811
status: approved
created: 2026-08-11
agent: requirements-review
---

# P1 复核评审意见 — TPV0089 非 ASCII 文件名本地资源链接解析修复（修订后复核）

## 总体结论

**Status: approved**

上轮评审（`P1-review.md`，needs-revision）提出的 **2 项修订项 + 2 项措辞建议全部落地**，修订无遗漏、无新引入问题。需求基线现含 BDD-1~12（12 条），编号连续、单 GWT、可二值判定；frontmatter 机器字段（risk_level/phases/packages/domains/capability_requirements/P1_simplified）完整未被破坏。可进入 P2。

## 修订核对清单逐项结论

1. **R1（BDD-8 Given 补充映射声明）**：✓ 落地。BDD-8 `#### BDD-8: 英文文件名不回归` Given 现为 "pathMap 含 key `images/arch.png` 且映射到 fileId=3"，Then 断言 "返回 3（与修复前行为一致）"——脱离上下文可独立判定。值 3 仍与上轮核实的既有测试数据（`path-map.test.ts` TC-RP-01/TC-BPM-01）一致。
2. **R2（新增字面 `%` 文件名 decode 链路 BDD）**：✓ 落地。新增 `#### BDD-7: 字面 % 文件名 decode 链路正确（decode 恰好一次）`：Given key `a%20b.png`（字面 %）→ When 传入 `a%2520b.png` → Then 返回对应 fileId（"解码恰好一次还原，不得二次 decode 改写 key 语义"）。本轮已用 Node 运行时复核该链路：`encodeURIComponent('a%20b.png') → 'a%2520b.png'`，单次 `decodeURIComponent` 还原 `a%20b.png` ✓；同时确认畸形序列 `images/100%done.png` 抛 URIError、无 `%` 字符串 decode 恒等 ✓。该 BDD 同时钉死 P2 选型的关键语义（decode 不得落入 `normalizeRef` 改写 key）。
3. **措辞建议 1（raw HTML decode 措辞与 BDD-6 对齐）**：✓ 落地。前端段现区分两种情形——"无 `%` 转义序列时 decode 为恒等变换，不得被破坏；含畸形 `%` 序列时 decode 抛异常，需走回退兜底（与 BDD-6 一致）"，与 BDD-6 表面矛盾消除。
4. **措辞建议 2（裁剪说明 P7 措辞）**：✓ 落地。P7 现为 "**单源文件改动**"，并明确 `path-map.test.ts` 与新增 seed-data fixture 是单点修复的推论产物、P6 实跑 fixture 天然校验一致性。
5. **BDD 编号连续性与 frontmatter 完整性**：✓ 通过。BDD-1~12 使用标准 `#### BDD-NN:` 格式、连续无跳号、每条单 GWT；frontmatter 含 risk_level: medium、phases: [P1, P2, P3, P4, P5, P6, P8]、packages: [peekview]、domains: [frontend]、capability_requirements（browser-e2e / browser-vision 均 available）等机器字段，无破坏。

## BDD 评审（修订后全量 12 条）

- BDD-1: 判定通过（`中文图片`→`%E4%B8%AD%E6%96%87%E5%9B%BE%E7%89%87`，上轮已核算 + 本轮复核无改动）· 数据✓ 前端✓ 多端✗ 边界✗ 兼容✗
- BDD-2: 判定通过（basename 形态）· 数据✓ 前端✓ 兼容✓
- BDD-3: 判定通过（日文 `概要図`→`%E6%A6%82%E8%A6%81%E5%9B%B3`）· 数据✓ 前端✓
- BDD-4: 判定通过（`café`→`caf%C3%A9`，UTF-8 语义与 decodeURIComponent 一致）· 数据✓ 前端✓
- BDD-5: 判定通过（空格→`%20`）· 数据✓ 前端✓
- BDD-6: 判定通过（`images/100%done.png` 运行时确认抛 URIError，try/catch→回退原始匹配，无中间态）· 边界✓ 兼容✓
- BDD-7: **判定通过（新增）**——`a%2520b.png`→单次 decode→`a%20b.png` 命中，本轮 Node 运行时实测确认；Given/When/Then 均为确定性可二值判定 · 边界✓ 兼容✓
- BDD-8: **判定通过（R1 已落地）**——Given 含 fileId=3 映射声明，Then "返回 3" 可独立判定 · 数据✓ 前端✓ 兼容✓
- BDD-9: 判定通过（src 断言 + 截图无裂图，可二值）· 数据✓ 前端✓ 多端✓
- BDD-10: 判定通过（点击后跳转 `/{slug}?file={id}` 无 404，可二值）· 前端✓ 多端✓
- BDD-11: 判定通过（非中文非 ASCII E2E 佐证）· 数据✓ 前端✓
- BDD-12: 判定通过（英文 E2E 冒烟，无回归）· 兼容✓ 前端✓

格式核查：`#### BDD-NN:` 标准格式、BDD-1 至 BDD-12 连续无跳号、每条单 GWT ✓。

## 隐含需求覆盖（修订后复核）

- 数据维度：✓（无 schema/存储迁移、存量天然兼容、seed-data 无非 ASCII → `[SUGGEST]` 新增 `unicode-filenames/` fixture 子目录，可复现可进 CI）
- 前端维度：✓（`resolvePath` 4 处调用点、外部引用过滤语义不退化的守卫（含 percent-encode 形式 `%23anchor`/`https%3A%2F%2F`）、raw HTML 兼容措辞已修正）
- 多端维度：✓（backend/API/MCP 无改动已声明，与 P0 根因定位一致）
- 边界维度：✓（畸形转义 try/catch、decode 回退、key 语义不被改写——现全部有 BDD 锚点：BDD-6 / BDD-6 / BDD-7）
- 兼容维度：✓（ASCII 恒等不回归 BDD-8/12、相对路径 + basename 双形态 BDD-1/2、字面 % 文件名 BDD-7）

## BDD 跨条一致性（修订后复核）

- BDD-6（异常回退）与 BDD-7（正常 decode 恰好一次）与 BDD-8（ASCII 恒等）三分支互斥、语义无矛盾，均与修复前行为一致。
- 保护优先级已显式声明（边界段：decode 位置不得改写 key 与 DB 文件名一致性，P2 选型显式排除；BDD-7 Then 再钉一次）。
- 测试数据设计与环境约束无冲突（单测纯内存态，E2E 走 debug :8888 隔离数据）。

## 裁剪评审（修订后复核）

- P7 裁剪：**理由修正后接受**——"单源文件改动"（逻辑改动仅 `path-map.ts`），测试/fixture 为推论产物，P6 实跑 fixture 天然校验一致性，裁剪风险可控。
- P1_simplified: true 合理（`problems` 类型，隐含需求 + BDD 完整保留）。
- P2 不可裁 / P3 不可裁 / P6 不可裁：理由充分（双候选选型需显式排除、零现成覆盖必须走真红灯、行为修复需浏览器实跑 + 截图）。
- P5 / P8 保留：合理（vue-tsc typecheck 门禁 + CHANGELOG 铁律 8）。
- risk_level: medium 匹配（影响面为所有含非 ASCII 文件名资源的已发布 entry，生产数据已观察到真实影响）。
- capability_requirements 三态判断 ✓：browser-e2e、browser-vision 均 available，无 `[CAPABILITY_GAP]`；`requires_minimal_validation` 的 P2 `minimal_validation` 块要求保留合理。

## P1 纯净性（修订后复核）

- ✓ 未直接选定实现方案：正文仍仅以约束/风险形式提及候选位置，选型决策与排除理由明确交给 P2。
- ✓ 无实现细节混入：try/catch、回退均为"做什么"层面的行为约束，未指定实现行。
- ✓ 修订未引入新的解空间/实现表述。

## 评审结论

- **Status: approved**
- 阻塞项：0 BLOCKER
- 修订项：2/2 已落地（R1 → BDD-8、R2 → 新增 BDD-7），措辞建议 2/2 已采纳，BDD 编号重排（新增 BDD-7、原 BDD-7→BDD-8）连续无跳号，frontmatter 机器字段完整。
- 复核依据：逐项对照 `P1-review.md` 修订清单；新增技术断言（BDD-7 encode/decode 链路、BDD-6 URIError、无 `%` 恒等）本轮 Node 运行时实测确认。
- 需求基线可进入 P2 方案设计。
