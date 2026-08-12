---
phase: P6
task_id: T091-mobile-detail-visual-polish
role: verifier
---

# 派发指引 — T091 P6 验收（verifier，模式二）

## 目标

把 P1-requirements.md 的全部 13 条 BDD 逐条**实跑**验证，产出 `P6-acceptance.md` + `P6-evidence/`。这是本任务存在的核心原因：T090 上线后用户实机走查发现视觉观感差，根因是 T090 的 P6 验收从未真正用视觉手段核实"呼吸感"类条件——本次 P6 必须补上这个缺口，不能重蹈覆辙。

**铁律**：先验证，后结论。不能"代码看起来对就写 PASS"。拿不准就标 FAIL。

## 上游产出（必读）

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（**全部 13 条 BDD 原文**，第 3 节，验收依据——请用原文逐条核对，不要用自己的复述替代）
2. `docs/tasks/T091-mobile-detail-visual-polish/P2-design.md` 第 2 节 minimal_validation（BDD-10 用 `svg-standalone` 而非 P1 原文提到的 `image-gallery`/`product-screenshots`，理由已在此节写明——这不是你需要重新判断的事，直接采纳）
3. `docs/tasks/T091-mobile-detail-visual-polish/P5-test-results/e2e.md`（P5 已用 `E2E_SPEC=e2e/t09 make debug-test` 实跑 25 条唯一 BDD × 2 browser project = 50 条用例，全部 passed——这是强 DOM/交互证据，P6 应复用其测量口径，但**不能只转抄 P5 的 PASS/FAIL 结论**，P6 要求的是可读证据+vision 判定，P5 只是断言通过/失败，没有留下人类可读的数值/截图证据文件）

## 现成截图资产（重要，先看这个再决定要不要重新截）

P5 阶段的 E2E 实跑（`t091-mobile-detail-visual-polish.spec.ts`）已经在跑测试时顺带截了图，但因为 `make debug-test` 的执行目录是 `frontend-v3/`，而测试代码里 `EVIDENCE_DIR` 是一个相对路径，所以这些截图实际落在了：

```
frontend-v3/docs/tasks/T091-mobile-detail-visual-polish/evidences/
```

（不是仓库根的 `docs/tasks/T091-mobile-detail-visual-polish/evidences/`，注意路径前缀多了 `frontend-v3/`）

这个目录下现有 24 张截图，覆盖了 BDD-1/2/3/4/5/7/9(10个entry)/10/11/12/13 几乎全部视觉相关条件，是当前已实现代码的真实渲染结果（不是历史遗留，是最新一次 `E2E_SPEC=e2e/t09 make debug-test` 跑出来的）。**你可以复用这批截图作为证据基础，不强制要求重新跑一遍 Playwright**，但要做以下核实工作：

### 已发现的截图重复（你必须处理，否则会被 gate 硬拦截）

`check-p6-evidence.sh` 对 `P6-evidence/screenshots/` 目录做**全局 md5 去重**，任何两个文件逐字节相同就硬拦截（exit 1）。经核实，现有 24 张截图里有 3 组文件内容完全相同：

- 组 1（同一 md5 `3f16f94a...`）：`mobile_390x844_bdd1.png` / `mobile_390x844_bdd2.png` / `mobile_390x844_bdd4.png` / `mobile_390x844_bdd9_markdown.png` —— 这 4 张图对应的测试都是在 `markdown-test` entry 上、无任何滚动/点击交互前截的图，页面状态完全相同，图片字节相同是符合预期的（不是造假）
- 组 2（同一 md5 `b328a808...`）：`mobile_390x844_bdd5_mobile_copy.png` / `mobile_390x844_bdd7_off.png` / `mobile_390x844_bdd9_code.png` —— 这 3 张图都在 `python-entry-service` entry 上、Wrap 按钮点击前截的图，同理页面状态相同
- 组 3（同一 md5 `e22a6699...`）：`mobile_390x844_bdd10_afterswipe.png` / `mobile_390x844_bdd10_firstscreen.png` / `mobile_390x844_bdd9_svg.png` —— **这组需要你重点核查**：BDD-10 的滑动前/滑动后截图完全相同，可能是合法结果（`svg-standalone` 图片内容本身没有超出 `.content-area` 可视高度，即 `scrollHeight <= clientHeight`，物理上没有可滚动内容，所以滑动手势没有产生任何位移，两张图逐字节相同反而是"零滚动=零重影"的直接证据），也可能是滑动手势本身没有生效（比如手势作用在了 `overflow:hidden` 的 ImageViewer 内部元素上而没有冒泡到真正可滚动的 `.content-area`）。**请你用 CDP 实测 `svg-standalone` 页面的 `.content-area` 的 `scrollHeight` vs `clientHeight`，确认哪种情况**，并在 P6-acceptance.md 里如实写明你的核查过程和结论（不要不核查就假设是"零滚动=合法"）

### 处理方式（避免 md5 硬拦截 + 避免充数嫌疑）

phase card 明确允许"多条 PASS 共享同一证据文件"（不是每条 PASS 必须有独占截图）。对上述 3 组重复内容：**只把每组里的 1 张（挑一个语义最贴切的文件名）拷贝进 `P6-evidence/screenshots/`，其余重复内容不要重复拷贝**，然后在对应的多条 PASS 行里都引用这同一个文件路径（逗号分隔多文件时也可以，但这里是"多条 PASS 指向同一文件"，不是"一条 PASS 指向多文件"）。这样物理上只有 1 份文件，不会触发 md5 去重拦截，且如实反映了"这几个场景视觉上确实相同"这一事实。

### 需要补的截图

- BDD-6/BDD-8（Copy/Wrap 44×44 触控热区）：**查询类 BDD，断言值本身是唯一证据，可不截图**（phase card 已说明），用 DOM 测量数值 + result.json 类文件即可
- BDD-2 的"改动前后对比"：debug 环境上线的是已实现的 T091 代码，**没有"改动前"的实时页面可截**。请用 P1-requirements.md BDD-2 已经记录的实测数据链（改动前基线 17px、本任务实测 89px、阈值 71px 是 89px×0.8）作为数值维度的"前后对比"依据，vision 判定只需对**当前**版本的截图做"是否存在清晰可辨识留白/是否贴边压缩"的单侧判断（不需要，也做不到真的并排对比新旧两张截图）——这一点已经是 P1 原文对该 BDD 判定方式的实际设计（"vision-engine 二值判定：存在明显改善=PASS，仍贴边/局促=FAIL"，判定基准是当前状态本身的观感，不是像素级 diff）

## 你要做的事（分四步）

### 第一步：DOM 测量（BDD-1/4/6/8/12，5 条纯数值断言）

用 Playwright/CDP 对以下断言逐条重新独立测量（不要只抄 P5 的 pass/fail，要留下具体数值）：

- BDD-1：`markdown-test` entry，移动端 390×844，`meta-tags-bar` 的 `scrollWidth` vs `clientWidth`
- BDD-4：任意 entry，移动端，`mobile-bottom-bar` 的 computed `padding-top`/`padding-bottom`（应均为 4px）
- BDD-6：`mobile-bar-copy-btn` 的 `boundingBox()` 宽高（应≥44px）
- BDD-8：`mobile-bar-wrap-btn` 的 `boundingBox()` 宽高（应≥44px，需要一个 `canWrap=true` 的 entry，如 `python-entry-service`）
- BDD-12：桌面端 1280×800，`markdown-test` entry，`.markdown-body` 的 computed padding（应精确等于 24px，`var(--space-5)`）

把这些数值写入 `P6-evidence/dom-measurements.json`（或按 BDD 拆成多个小文件），格式自定，但必须是你本次实测的真实输出，不是转述 P5 报告。

### 第二步：截图整理（8 条视觉相关 BDD：2/3/5/7/9/10/11/13）

1. 从 `frontend-v3/docs/tasks/T091-mobile-detail-visual-polish/evidences/` 里挑出去重后的截图集合（按上文"处理方式"），拷贝进 `docs/tasks/T091-mobile-detail-visual-polish/P6-evidence/screenshots/`
2. 完成 BDD-10 的滑动核查（见上文），如有必要重新截一版真正有位移的滑动前后对比图（如果发现滑动手势确实没生效，需要修正手势实现重新截图，而不是接受"零位移"这个不确定的结果）
3. 确认所有 13 条 BDD 里的 8 条视觉条件（2/3/5/7/9/10/11/13）都能对应到至少 1 张截图

### 第三步：dispatch vision-analyst

按 `{agate_root}/assets/execution-roles/vision-analyst.md` 的调用约定，你自己用 Agent 工具派发一个 vision-analyst 子任务（`purpose: acceptance`），把整理好的截图路径列表 + 对应的 BDD 条件原文（从 P1 原文摘录，不要转述）传给它。vision-analyst 会返回 `docs/tasks/T091-mobile-detail-visual-polish/P6-vision-{timestamp}.yaml`。

**blocker_count 检查**：若返回的 YAML `summary.blocker_count > 0`，不能只用程序化指标（DOM 测量值）反驳——按 verifier 角色文件"证据优先级"一节的仲裁流程处理（换角度/换时机重截 → 二次分析 → 记录仲裁过程），不能强行标 PASS。

### 第四步：撰写 P6-acceptance.md

- 13 条 BDD 逐条，每条 `- PASS BDD-N: 描述 (证据路径)` 或 `- FAIL BDD-N: 描述 (证据路径)`，严格按 phase card 的格式规范（行首 `- PASS`/`- FAIL`，视觉类 BDD 需同时含截图引用和 `(vision: vision-reports/xxx.yaml)` 引用）
- 完成后自己跑一遍：
  ```
  bash $AGATE_ROOT/scripts/check-p6-format.sh --fix docs/tasks/T091-mobile-detail-visual-polish/P6-acceptance.md
  bash $AGATE_ROOT/scripts/check-p6-evidence.sh docs/tasks/T091-mobile-detail-visual-polish
  bash $AGATE_ROOT/scripts/check-p6-provenance.sh docs/tasks/T091-mobile-detail-visual-polish
  ```
  预检不过就修复重试（最多 2 轮），仍失败就把预检报错原样返回给我，不要自己想办法绕过

## 环境

debug backend 已在 127.0.0.1:8888（`make debug-quick` 已灌入全部测试数据，含本任务需要的全部 11 个 entry）。严禁触碰生产 `:8080`/`~/.peekview/`。

## 完成后向我报告

- P6-acceptance.md 路径 + 13 条 BDD 的 PASS/FAIL 汇总（X/13）
- vision-analyst 返回的 blocker_count
- BDD-10 滑动核查的具体结论（scrollHeight vs clientHeight 实测值 + 你的判断）
- 三条预检脚本（format/evidence/provenance）是否都过
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
