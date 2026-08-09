---
phase: P3
task_id: T091-mobile-detail-visual-polish
role: test-designer
---

# 派发指引 — T091 P3 TDD 测试设计

## 目标

为 P1 的 13 条 BDD 各设计至少 1 条测试用例（1:1 映射），本任务 `ui_affected: true`，必须含 Playwright/E2E 用例。**同时**要完成 P2-design.md 第 4 节明确要求的、对 T090 遗留 E2E spec 的"手术式修改"（这不是可选项，是 P2 已经定好方案、必须在 P3 落地的工作）。

## 上游关联

- P1-requirements.md（approved，13 条 BDD，`#### BDD-1` 至 `#### BDD-13`）是测试用例的验收依据
- P2-design.md（approved）已经把技术方案、gate_commands、files_to_read、T090 遗留 spec 处理决定全部定好，P3 不需要再做设计判断，照着落地即可
- P2-design.md 第 5 节声明 `gate_commands.P3: "E2E_SPEC=e2e/t09 make debug-test"`——这个命令会同时跑 `t090-mobile-detail-ux-polish.spec.ts`（子串匹配）和你即将新建的 `t091-mobile-detail-visual-polish.spec.ts`，两个文件都要处于正确状态

## 必读输入文件

1. `docs/tasks/T091-mobile-detail-visual-polish/P1-requirements.md`（13 条 BDD，核心验收依据）
2. `docs/tasks/T091-mobile-detail-visual-polish/P2-design.md`（**核心输入**，第 1 节改动清单、第 3 节 DESIGN.md 精确文字、第 4 节 T090 遗留 spec 处理决定的完整理由、第 8 节 data-testid 清单、第 9 节实现完成标志）
3. `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` L1-40（顶部常量定义，L8-9 `MARKDOWN_MOBILE_BASELINE_INSET_PX`/`MARKDOWN_REDUCTION_TARGET_RATIO`）+ L285-326（BDD-7/BDD-8，需要手术式修改的两处）
4. `frontend-v3/src/components/EntryDetailMobileBar.vue`（`source-toggle` 现有 `aria-label`/`aria-pressed` 精确写法，Wrap 按钮要对齐这个）

## 任务一：手术式修改 `t090-mobile-detail-ux-polish.spec.ts`（P2 第 4 节已定方案，照做）

1. **BDD-7 测试**（L285-303）：当前断言 `expect(classBefore).not.toContain('primary')` / `expect(classAfter).toContain('primary')`（检查 Wrap 按钮点击前后 class 是否含 `'primary'`）。T091 把 Wrap 改成 `.toggle-btn` + `{ active: wrapEnabled }` 后，class 里不会再出现 `'primary'`，请改为检查 `'active'` class（`not.toContain('active')` → `toContain('active')`）
2. **BDD-8 测试**（L305-326）：当前断言 `reductionRatio = (40 - leftInset) / 40 >= 0.75`（即要求 `leftInset <= 10px`）。T091 把 mobile padding 从 0 改回 16px，新的 `leftInset` 应为 24px（8px content-area + 16px markdown-body），**这不是把 0.75 这个阈值改小就行**——P2 已经指出这是验收方向反转（T090 要"越小越好"，T091 要"回到 24px 才舒适"），请改写断言逻辑本身：校验 `leftInset` 与 `rightInset` 的对称性（`Math.abs(leftInset - rightInset) <= 2`）+ `leftInset` 精确等于 24px（±2px 容差），不要再用"缩减比例"这个框架
3. BDD-6（L240-283）不需要修改（P2 已核实其走 `data-testid` + 剪贴板校验，不受影响）
4. 其余测试（多文件抽屉、375px 无溢出、桌面端回归等）不动

## 任务二：新建 `t091-mobile-detail-visual-polish.spec.ts`，覆盖 13 条 BDD

参照 `frontend-v3/e2e/t090-mobile-detail-ux-polish.spec.ts` 的既有写法风格（CDP 连接方式、viewport 设置、评审要求的证据落盘方式）。

### BDD → 测试类型映射（对照 P1-requirements.md 原文）

- BDD-1（meta-tags-bar 换行无横向滚动）：DOM 断言（`scrollWidth<=clientWidth`），标准 nowrap→wrap 场景，选一个标签多的 entry（`markdown-test`）
- BDD-2（视觉呼吸感 71px 阈值）：DOM 断言（`offsetHeight>=71px`，**仅适用于 `markdown-test` 这个 entry**，P1 已声明这不是全局固定值）+ vision-engine 视觉判定并列
- BDD-3（markdown-body 16px padding）：DOM 数值断言 + vision-engine
- BDD-4（底部栏 padding 对称性）：纯 DOM computed style 断言，`padding-top === padding-bottom`（4px）
- BDD-5（Copy 图标化对齐桌面端）：vision-engine 对比移动端/桌面端截图
- BDD-6（Copy 44×44 触控热区）：纯 DOM 测量
- BDD-7（Wrap 图标 toggle 两态可区分）：vision-engine 对比点击前后截图 + `aria-pressed` 状态断言（P2 已要求补充 aria-pressed，测试应验证它真的切换了）
- BDD-8（Wrap 44×44 触控热区）：纯 DOM 测量
- BDD-9（7 种常规 viewer 一致性，Given 已含全部 10 个 entry：markdown-test/python-entry-service/csv-employees/tsv-server-metrics/json-api-config/yaml-docker-compose/xml-maven-pom/svg-standalone/mermaid-charts/plantuml-arch）：每个 entry 截图 + vision-engine 比对
- BDD-10（Image viewer 例外场景）：**测试 entry 用 `svg-standalone`**（P2 minimal_validation 已确认这是实际可用、且技术上真实路由到 ImageViewer 的选择，不是 image-gallery/product-screenshots），首屏截图 + 滑动后截图，vision-engine 判定
- BDD-11（Html viewer 例外场景）：`html-csp-test`，同上手法
- BDD-12（桌面端 markdown padding 不回归）：DOM 数值断言（24px 精确相等）
- BDD-13（桌面端不出现移动端组件）：DOM query（`mobile-bottom-bar`/`EntryMetaTagsBar` 计数为 0）+ 可选截图

### 选择器要求

严格用 P2-design.md 第 8 节声明的 data-testid，不用 class 名选择器（Wrap 按钮的 class 会从 `.bottom-btn` 变成 `.toggle-btn`，class 选择器不稳定）。

### 证据目录

`docs/tasks/T091-mobile-detail-visual-polish/evidences/`（与 T090 的 evidences 目录独立，按任务归档）。

## 环境约束

- debug backend 已在 127.0.0.1:8888 运行，测试数据（`markdown-test`/`python-entry-service`/`csv-employees`/`tsv-server-metrics`/`json-api-config`/`yaml-docker-compose`/`xml-maven-pom`/`svg-standalone`/`mermaid-charts`/`plantuml-arch`/`html-csp-test`）均已通过 `make debug-quick` 灌入现成可用，不需要新建
- 本阶段只需写测试代码到红灯状态，不要求真的跑通（实现代码还没写）。但 t090 spec 的两处手术式修改属于"改测试适配新预期行为"，这两处修改后应该在**当前（未实现 T091 的）代码上跑出红灯**——这也是合规的红灯（B类：断言与当前实现不符，不是测试代码语法错误）

## 门槛（什么算完成）

- `t090-mobile-detail-ux-polish.spec.ts` 的 BDD-7/BDD-8 两处按上述方案修改，其余不动
- 新建 `t091-mobile-detail-visual-polish.spec.ts`，13 条 BDD 1:1 映射，P3-test-cases.md 里列出映射表
- 全部用 data-testid 选择器
- 自跑 `E2E_SPEC=e2e/t09 make debug-test`（或等效方式）确认红灯，区分 A 类（测试代码本身有问题）和 B 类（断言与当前未实现的代码不符），全部应为 B 类

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.sh $TASK_DIR`（自动捕获环境基线）。**必须执行**。
   该步骤不阻塞流程——脚本的 stderr 输出（含 WARNING）均可忽略，执行完直接继续步骤 1。
1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.sh 确认红灯
3. 更新 .state.yaml phase=P3 → P4
4. git add docs/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
5. git commit -m "wf({Txxx}-P3): {摘要}"

## 如果是重试

确认上一轮失败原因（测试设计不合理 / 未覆盖关键 BDD / 非真红灯）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P3 MAX=2）

## 前置条件

- [ ] P2-design.md files_to_read 完整（测试设计需要知道实现导航）
- [ ] P2-review.md status: approved（P2 不可裁剪）

## 派发

- **角色**：test-designer（`{agate_root}/assets/execution-roles/test-designer.md`）
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件，每条 `#### BDD-NN` 对应一个测试用例）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 `#### BDD-NN` 验收条件（1:1 映射）
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则

**check-gate.sh P3**（hook + 主 Agent 预跑，秒级文件检查）：
- exit 1：P3-test-cases.md 不存在
- exit 2：P3-test-cases.md 存在（TDD 红灯由 check-tdd-red.sh 独立确认）

**check-tdd-red.sh**（主 Agent 手动确认红灯 + CI backstop P3 兜底）：

```bash
check-tdd-red.sh $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**技术栈无关**：check-tdd-red.sh 通过 formatter 将测试输出标准化为 JSON，不直接解析任何框架的输出格式。formatter 在 gate_commands.P3_formatter 中声明（可选）。不提供 formatter 时退化为 exit-code-only（所有红灯 = 可推进）。

**探测链**：`$TEST_RUNNER` 环境变量 → `gate_commands.P3`（P2-design.md 声明）→ `which pytest` → exit 3。`$TEST_RUNNER` 始终优先（退化为 exit-code-only，无 formatter）。

**formatter 选择**：见 `assets/formatters/README.md` 速查表。常用：pytest → `pytest.sh`，vitest → `vitest.sh`，go test → `go-test.sh`，其他 → `generic-exit-only.sh`。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。

当 P2 声明多个 packages 且包间无数据依赖时，P3 可拆分并行：

1. 每个 package 派一个 test-designer subagent
2. 各自写各自的测试文件（不同目录）
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit

拆分判据：
- P2 packages > 1 且包间无数据依赖 → 可并行
- 单包或包间有依赖 → 串行（不拆分）
- P2 未声明 packages → 串行

每个 subagent 的 dispatch-context 必须明确其负责的 package 范围（约束节写"只写 {pkg} 目录下的测试"）。

## 推进条件（全部满足才写 phase: P4）

- [ ] check-tdd-red.sh exit 0（真红灯确认）
- [ ] P3-test-cases.md 存在且含 test_code_dir
- [ ] 测试代码目录存在
- [ ] UI 任务：Playwright/E2E 用例存在

## 常见错误

1. **测试绿了才 commit**：测试已在 P4 之前通过 → 违反 TDD"测试先于实现"原则。P3 的 gate 要求红灯
2. **忘记声明 test_code_dir**：后续阶段找不到测试代码 → P5 跑 gate_commands 时找不到测试路径
3. **测试覆盖不全**：只为部分 BDD 写了测试 → P6 验收时那些 BDD 没有自动化验证
4. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。
5. **只覆盖交互路径，忽略前置状态**：测试设计应覆盖 BDD Given 隐含的前置状态，不只覆盖 When/Then 路径（详见 WORKFLOW.md §P3 测试设计指导）

## 下游影响

- P4 用测试驱动实现（implementer 看测试理解预期行为）
- P5 跑同一套测试验证实现正确性（gate_commands.P5）

> 完成 → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->
