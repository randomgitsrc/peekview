---
phase: P6
task_id: T091-mobile-detail-visual-polish
role: verifier
---

# 派发指引 — T091 P6 重新验收（P4 修复 meta-tags-bar CSS 冲突之后）

## 背景

上一轮 P6 验收（verifier）发现真实缺陷：`EntryMetaTagsBar.vue` 的 `flex-wrap:wrap` 与 `frontend-v3/src/styles/layout.css:466-478` 遗留全局规则冲突，导致 `.content-area` 可滚动场景下 meta-tags-bar 坍缩到 33px、标签丢失。13 条 BDD 里 BDD-2、BDD-9 两条 FAIL，11/13 PASS。已按协议规范回退到 P4（`agate-retreat-to.sh`，归档保留在 `.archived/20260809-175444-P6/`，失败详情见 `.retreat-history.md`），implementer 定向修复（`EntryMetaTagsBar.vue` 新增 `overflow-x:visible; white-space:normal;`），design-review approved，P5 重新全量验证通过（vitest 1215/0 + E2E 50/0，orchestrator 独立复测确认 meta-tags-bar 高度从 33px 恢复到 89px）。

**本轮任务：重新走完整的 13 条 BDD P6 验收**（不是只重验 BDD-2/BDD-9 这两条，是全部重新来一遍——上一轮的 P6-acceptance.md 已被归档，不能挑几条改改复用旧结论，这是协议明确要求的）。

## 上游产出（必读）

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（全部 13 条 BDD 原文，验收依据）
2. `docs/tasks/T091-mobile-detail-visual-polish/.retreat-history.md`（上一轮 FAIL 详情，理解这次要重点确认修复的是什么）
3. `docs/tasks/T091-mobile-detail-visual-polish/P4-implementation.md`（"P4 重试 #1"一节，本轮修复的具体内容）
4. `docs/tasks/T091-mobile-detail-visual-polish/P5-test-results/e2e.md`（本轮 P5 已确认 BDD-1/BDD-2 在真实滚动场景下通过）
5. `docs/tasks/T091-mobile-detail-visual-polish/.archived/20260809-175444-P6/`（上一轮的截图/DOM 测量/vision 分析，可作为方法参考，但**不能直接复用其中任何 PASS/FAIL 结论**——上一轮的截图是修复前的旧状态，必须重新截图）

## 与上一轮 P6 verifier 的关键区别（避免重复踩坑）

1. **截图必须重新截**：上一轮遗留在 `frontend-v3/docs/tasks/T091-mobile-detail-visual-polish/evidences/` 目录下的 24 张截图是**修复前的旧状态**（meta-tags-bar 坍缩到 33px 的错误状态），绝对不能拿来当本轮证据用。请重新跑一遍截图流程（可以参照上一轮的截图脚本/entry 清单/命名方式，但必须是修复后新代码渲染的结果）
2. **BDD-1/BDD-2 的验证方式**：请务必对 `markdown-test` 用真实的 markdown 文件内容截图验证（即 `?firstFileId=18` 或等效方式让 `.content-area` 处于可滚动状态），不要重复上一轮 E2E 测试"落在默认 svg 文件、从未触发滚动"的覆盖盲区
3. **BDD-9 的 10 个 entry 全部要重新截图 + DOM 复测**：上一轮发现 5/10（code/csv/tsv/xml/plantuml）因这个 bug 受影响，本轮需要确认这 5 个现在都恢复正常
4. **截图去重问题**：上一轮遇到过"多个 BDD 场景页面状态相同导致截图 md5 完全重复触发 gate 硬拦截"的情况，本轮同样可能出现（比如无滚动场景下的多个 BDD 截图仍可能相同）——遇到时用"多条 PASS 共享同一证据文件"的方式处理，不要为了制造"不同"而人为引入不必要的页面差异

## 你要做的事（沿用上一轮四步法）

### 第一步：DOM 测量（BDD-1/4/6/8/12）

对以下断言逐条重新独立测量，写入 `P6-evidence/dom-measurements.json`：
- BDD-1：`markdown-test?firstFileId=18`（或触发滚动的方式），`meta-tags-bar` 的 `scrollWidth` vs `clientWidth`
- BDD-4：`mobile-bottom-bar` 的 `padding-top`/`padding-bottom`（应均 4px，本轮未改动这部分，理论应仍然一致，但要重新实测不能只抄旧数据）
- BDD-6/BDD-8：Copy/Wrap 按钮 `boundingBox()`（应≥44px）
- BDD-12：桌面端 `.markdown-body` padding（应精确 24px）

### 第二步：截图（8 条视觉 BDD：2/3/5/7/9/10/11/13）

全部重新截图，覆盖全部 11 个测试 entry（`markdown-test`/`python-entry-service`/`csv-employees`/`tsv-server-metrics`/`json-api-config`/`yaml-docker-compose`/`xml-maven-pom`/`svg-standalone`/`mermaid-charts`/`plantuml-arch`/`html-csp-test`），特别关注上一轮受影响的 5 个（code/csv/tsv/xml/plantuml）是否恢复正常，以及 BDD-2 的呼吸感判定。

### 第三步：dispatch vision-analyst

同上一轮流程，把新截图 + BDD 原文条件传给 vision-analyst，拿到 `blocker_count`。

### 第四步：撰写 P6-acceptance.md

13 条 BDD 逐条 PASS/FAIL + 证据引用，自跑三条预检脚本：
```
bash $AGATE_ROOT/scripts/check-p6-format.sh --fix docs/tasks/T091-mobile-detail-visual-polish/P6-acceptance.md
bash $AGATE_ROOT/scripts/check-p6-evidence.sh docs/tasks/T091-mobile-detail-visual-polish
bash $AGATE_ROOT/scripts/check-p6-provenance.sh docs/tasks/T091-mobile-detail-visual-polish
```

## 铁律

先验证后结论，拿不准标 FAIL。如果本轮仍然发现任何一条 FAIL（无论是否与上一轮相同），如实记录，不要为了"这次应该修好了"就倾向性地判 PASS。

## 环境

debug backend 已在 127.0.0.1:8888（已跑过 `make build-frontend` 反映最新代码，但请自行确认）。严禁触碰生产 `:8080`/`~/.peekview/`。

## 完成后向我报告

- P6-acceptance.md 路径 + 13 条 BDD PASS/FAIL 汇总（X/13）
- BDD-2/BDD-9（上一轮 FAIL 的两条）本轮的具体结论
- vision-analyst blocker_count
- 三条预检脚本是否都过
- 一句话总结，不要贴全文

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P6

路径：phase-cards/P6-acceptance.md
---
# P6 — 验收

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P6 不可裁剪。no_behavior_change 可简化（快速验收），不可省略。

## 如果是首次进入本阶段

1. 派发 verifier subagent → 产出 P6-acceptance.md + P6-evidence/
   1.1 写 P6-dispatch-context-verifier.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. UI 任务：派 vision-analyst → 产出 vision-reports/
3. 主 Agent 逐条核实 BDD 对照结果
4. **功能验证和 gate 格式都必须满足**（T046 教训：先做功能验证，不要只凑格式）
5. **运行 `bash $AGATE_ROOT/scripts/check-p6-format.sh --fix "$TASK_DIR/P6-acceptance.md"`** 归一化 PASS/FAIL 大小写和行首空白（verifier 产出后、gate 前，① 自动格式化）
6. 预跑 check-gate.sh P6 + check-p6-evidence.sh + check-p6-provenance.sh
7. 更新 .state.yaml phase=P6 → P7
8. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
9. git commit -m "wf({Txxx}-P6): {摘要}"

## 如果是重试

确认上一轮失败原因（BDD 不覆盖 / 证据不足 / gate 格式拦截）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P6 MAX=2）

## 核心原则 ⚠️

**功能验证和 gate 格式都必须满足。** T046 教训：花 2 小时凑 PASS 格式，没花 5 分钟检查 API 响应头。不接受只满足格式不验证功能，也不接受只验证功能不满足格式。gate 是必要条件（格式不对 → commit 不了），不是充分条件（格式对了 ≠ 功能正确）。

**验收报告记录的是验收时的事实，不是修复后的状态。** P6-acceptance.md 的 PASS/FAIL 声明必须基于 evidence 文件的实际输出。如果验收时 BDD 为 FAIL，写 FAIL——修复后重新验收时再改 PASS。不能在同一个 P6 acceptance 里写"修复后 PASS"。

## 前置条件

- [ ] P1-requirements.md BDD 验收条件完整（含 SCOPE+ 增补）
- [ ] P1 声明的 capability_requirements 中 ability 为 available

## 派发

- **角色**：verifier（`{agate_root}/assets/execution-roles/verifier.md`）
- **UI 任务追加**：vision-analyst（`{agate_root}/assets/execution-roles/vision-analyst.md`）
- **输入**：P1-requirements.md + P5-test-results/
- **输出**：P6-acceptance.md + P6-evidence/

## 产出规格

### P6-acceptance.md

- BDD 逐条对照，每条只允许 PASS 或 FAIL（不允许"调整/跳过/覆盖"）
- 所有 PASS 必须有文件引用：`- PASS Bxx: 描述 (p6-bxx.png)` 或响应日志/断言文件
- UI 任务：操作类 BDD 截图必须互不相同（md5 去重），查询类 BDD 可不截图但须有断言记录文件
- UI 任务：每条 UI 类 PASS 含 vision 引用：`(vision: vision-reports/bxx.yaml)`

**PASS 行最小格式规范**：

```
- PASS BDD-NN: {描述} ({证据路径})
```

证据路径格式：
- 截图：`(screenshots/{filename}.png)`
- vision：`(vision: vision-reports/{filename}.yaml)`
- 其他：`(result.json)` / `(assert.log)` / `(P6-evidence/{filename})` / ...
- 多文件引用（逗号分隔）：`(file1.json, file2.log)` / `(screenshots/a.png, screenshots/b.png)`

描述文本可自由添加，不影响解析（provenance 脚本用精确正则提取路径）。

**总结行格式**：行首 `- PASS`/`- FAIL` 只用于 BDD 条目，不得用于总结行。总结行用其他格式（如 `**Summary**: 34/34 PASS, 0 FAIL`）。check-p6-format.sh `--fix` 会自动修正违规总结行。

### P6-evidence/

- 必须非空，每个文件含实质内容（截图 >1KB，断言文件含实际输出）
- 不接受 1 行文本文件充数（T046 教训：15 个 1 行 txt 文件凑 provenance 数量）
- 元素级截图建议使用父级元素 + padding，避免过小截图（≤1KB 虽不阻断但会触发 WARNING）
- 操作类 BDD 截图必须互不相同（md5 完全重复会被 hook 硬阻断，无例外）。
  若某个行为差异类 BDD 天然会产出视觉相同的页面（如两个不同查询都命中同一个空状态），
  优先改用非截图证据（断言日志 / response.json）而非截图，或截图时带上能体现差异的元素
  （如带时间戳的调试面板、高亮差异区域），确保截图本身逐字节不同。
  查询类 BDD 本来就可以不截图，这类场景应优先归为查询类而非勉强用截图。

### vision-helper 结论绑定 ⚠️

- `ui_affected: true` 时至少一条 PASS 基于 vision-helper 报告
- vision-helper 报 `blocker_count > 0`：不能仅用程序化指标（naturalWidth>0, complete=true, HTTP 200）反驳
- 必须追查根因（curl -I 检查响应头 / DevTools Network / API 日志），追查结果写入 P6-acceptance.md

## gate 规则

```bash
check-p6-format.sh --fix $TASK_DIR/P6-acceptance.md  # ① 自动格式化（verifier 产出后、gate 前）
check-gate.sh P6 $TASK_DIR      # FAIL=0 / 总数>0
check-p6-evidence.sh $TASK_DIR  # 证据目录非空 / UI截图>1KB / md5去重
check-p6-provenance.sh $TASK_DIR # 证据-结论对应 / dispatch-context审计 / BDD对照
```

- FAIL > 0 → gate exit 1 → 回 P4

格式问题 → 运行 check-p6-format.sh --fix 归一化 → 再验 gate → … → 通过（⑩迭代循环，格式迭代和 gate 重试共享 retry 预算）

**⚠️ FAIL > 0 时，主 Agent 不能直接改项目源码让它变绿**：P6 是 self-authored gate（判定对象是 verifier 自己写的 P6-acceptance.md），验收阶段本身不应该有代码变更——`pre-commit-gate.sh` 会硬拦截 phase=P6 时暂存的非证据文件（不在 `P6-evidence/` 下的文件）。正确流程：诊断问题出在哪个上游阶段 → 退回该阶段（`agate/rules/state-transitions.md` 回退规则，退回前须先跑 `agate-archive-stale-outputs.sh` 归档当前 P6 产出，或用 `agate-retreat-to.sh` 自动化多步回退）→ 重新派发对应角色 subagent 修复 → 重新走到 P6 时，旧的 P6-acceptance.md/P6-evidence/ 已被归档清空，verifier 必须重新产出真实证据，不存在"挑几条改改、其余沿用旧结论"的空间。

## 按包拆分并行（条件触发，受限模式）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

P6 采用**证据并行、验收文件不并行**模式：

1. 各包 verifier 并行跑 BDD 验证，证据写入 P6-evidence/{pkg}/，同时写 P6-evidence/{pkg}/results.md（PASS/FAIL 行 + 证据引用，不进 gate）
2. 所有 verifier 返回后，派一个汇总 verifier 逐包读取 results.md，转抄整合进唯一的 P6-acceptance.md
3. 汇总 verifier 确认各包 BDD 编号合集 = P1 全部 BDD 编号，无重复/遗漏，**必须在 P6-acceptance.md 中记录交叉核对结果**

基础设施隔离同 P5（端口/数据库/截图目录独立）。

## 推进条件（全部满足才写 phase: P7）

- [ ] 所有 BDD PASS（FAIL=0）
- [ ] P6-evidence/ 目录非空 + 证据文件被引用
- [ ] UI 任务：vision-helper blocker_count=0；blocker>0 时须在 P6-acceptance.md 写明追查命令 + 输出 + 根因结论（仅写"已追查"不合规）
- [ ] provenance 审计通过

## 常见错误（T046 实证）

1. **用 DOM 属性替代视觉验证**：img.src 被重写 = 图片显示正常。不对——还有 Content-Type、CORS、CSP 等 100 种原因导致图片不渲染。**vision-helper 说破了就是破了**
2. **凑 PASS 数量**：deferred BDD 标 PASS、用 1 行文本文件充证据 → provenance 审计能通过但功能不对
3. **只验证中间指标不验证用户结果**：naturalWidth>0, complete=true, API 返回 200 → 结论"功能正常"。用户看到的：破图。**问自己：用户看到了什么**
4. **收到视觉否定先反驳**：vision-helper 报异常 → 先 curl -I 查响应头 → 再决定是 vision 误报还是真问题。T046：三次视觉否定被三次程序化指标反驳，15 分钟浪费
5. **验收失败自己动手改代码**：这和上面几条本质是同一类问题（判定证据和判定对象由同一人在同一时间点生产），只是这次改的是真代码而非假 markdown，反而更难被察觉。正确动作是退回重新派发，见上方 FAIL > 0 的处理说明

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P7 一致性检查依赖 P6 的 BDD 对照结果
- 验收结果是判定任务成败的最终依据——P8 发布只是机械步骤

## 自查≠gate
写完验证脚本后应自跑确认脚本可执行（自查），但自查通过 ≠ P6 gate 通过。
P6 gate 由主 Agent 亲自跑 gate 脚本（check-gate.sh P6 + check-p6-evidence.sh + check-p6-provenance.sh），验证的是 verifier subagent 的产出。结果以主 Agent 跑的 gate 脚本为准。
不要在返回中声称"验收已通过"或"全部 BDD PASS"——只返回路径 + 摘要。

> 完成 → 读 phase-cards/P7-consistency.md
<!-- AGATE_CARD_END -->
