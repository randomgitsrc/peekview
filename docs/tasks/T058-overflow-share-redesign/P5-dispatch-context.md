<!-- AGATE_CARD_START -->
## 当前阶段卡片：P5

路径：agate/phase-cards/P5-verification.md
---
# P5 — 技术验证

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> P5 不可裁剪（核心阶段）
> ⑨ P5 subagent 化

## 如果是首次进入本阶段

1. 主 Agent 派发 verifier subagent（P5 模式）执行 gate_commands.P5
2. 逐条判定通过/失败
3. 若失败：判定是真失败还是环境问题 → 真失败回 P4，环境问题修复环境
4. git commit
5. 更新 .state.yaml phase=P5 → P6

## 如果是重试

→ 修复后重跑 gate_commands.P5 **全量**（T027 教训：修复可能引入回归，不能只检查修复项）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P5 MAX=2）

## 前置条件

- [ ] P4 代码已 commit（暂存区含代码文件）
- [ ] gate_commands.P5 命令在 P2 已声明（这是 gate 会执行的命令清单）

## 执行方式

verifier subagent 从 P2-design.md 读取 gate_commands.P5 并执行：

```bash
# 示例（实际命令取决于 P2 声明）
pytest -q --tb=no                    # 后端单元测试
vitest run --reporter=verbose        # 前端单元测试
playwright test --reporter=line tests/e2e/  # E2E（ui_affected: true 时）
```

紧凑输出模式：用工具的汇总模式（pytest --tb=no / vitest --reporter=dot / go test | tail -30）。只保留通过/失败汇总+失败清单，不逐项 traceback。

## 判定规则

- **exit 0 + failed=0**：全通过 → 继续
- **exit ≠0 或 failed>0**：主 Agent 判定
  - 真 bug → 回 P4 修复
  - 环境问题（超时/端口占用/依赖缺失）→ 修复环境重新跑
  - flaky test → 记入 P5-test-results/，三振记录
- **PROD_TOUCHED**：任何生产环境触达 → 立即 PAUSED
- **E2E 未执行**（ui_affected: true 但未跑 P5_e2e）：视为验证不完整

## 产出规格

- P5-test-results/unit.md：标注 failed 数量（verifier subagent 产出）
- UI 任务：P5-test-results/e2e.md（Playwright 实跑结果 + 截图路径，verifier subagent 产出）

## gate 规则

check-gate.sh P5 → exit 2。主 Agent 验 gate（检查 P5-test-results/ 存在 + failed 计数），CI backstop 兜底。

**external-output-gate vs self-authored-gate**：P5 的 gate 是 external-output-gate——主 Agent 验证的是 verifier subagent 的产出（P5-test-results/），而非自己跑的命令结果。这与 P4（主 Agent 自己写代码、自己跑 lint）的 self-authored-gate 不同。external-output-gate 的信任链依赖 subagent 隔离 + CI backstop 双重保障。

## 推进条件

- [ ] gate_commands.P5 全部命令 exit 0 + failed=0
- [ ] UI 任务：gate_commands.P5_e2e 已执行且通过
- [ ] 无 PROD_TOUCHED 标记
- [ ] 测试环境隔离正常（对比测试前后生产库状态）

## 常见错误

1. **不跑 E2E**：UI 任务只跑单元测试和类型检查 → 端到端行为未验证。T046 教训：38 个单元测试全绿 + vue-tsc OK，但浏览器里图片是破的
2. **把测试绿了当作功能正确**：单元测试通过 ≠ 用户看到的功能正常。P5 是代码正确性验证，P6 才是用户视角验收
3. **修复后不重跑全量**：只跑修复的那一个测试 → 修复引入的回归没被发现

## P5 commit→push 窗口残余风险（N5）

**残余风险**：verifier subagent 产出 P5-test-results/ 后，主 Agent commit 并推进到 P6，但 push→CI 之前存在时间窗口。伪造的 P5-test-results 可在此窗口内流向下游。

**缓解**：主 Agent 在推进前做轻量签名校验——grep test runner 输出签名：

```bash
grep -cE '^(PASSED|FAILED|passed|failed|ok|not ok)' P5-test-results/unit.md
```

计数 >0 才视为有效产出。这是轻量验证（确认文件包含真实 test runner 输出格式），不是重跑测试。CI backstop 在 push 后兜底全量验证。

gate 不过 ≠ 你失败了。红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P6 验收在 P5 通过的基础上做用户视角验证
- P8 发布时需重跑 P5 gate（确认 bump-version 后测试仍全绿）

> 完成 → 读 phase-cards/P6-acceptance.md
<!-- AGATE_CARD_END -->

## 客观信息（主 Agent 已查证）

- debug server 状态：运行中，http://127.0.0.1:8888，版本 0.8.0，database/storage/disk 全 ok
- E2E spec 目录：frontend-v3/e2e/
- **t058-share-redesign.e2e.spec.ts 不存在**（P2 声明的 gate_commands.P5_e2e 引用了此文件，但尚未创建）
- 已有 E2E specs：t052-header-redesign.e2e.spec.ts, test_t057_ui_polish.spec.ts, viewer.spec.ts
- 前端单元测试：876/876 PASS（vitest run 已验证）
- vue-tsc --noEmit：PASS
- build-frontend：PASS
- Playwright CDP 可用：Chrome :18800（Windows GPU）
- Vision 分析可用：~/.claude/skills/vision-analyzer/scripts/vision-analyze.py（配置在 ~/.env）

## 任务上下文（主 Agent 从 P0-brief + gate + 摘要积累）

- 目标：P5 技术验证——确认 T058 实现技术上正确、无回归
- 关注点：
  1. ui_affected: true，必须实跑 Playwright E2E，不能只跑单元测试
  2. t058-share-redesign.e2e.spec.ts 不存在——verifier 需先写 E2E spec 再跑（或用 playwright-cdp skill 做交互验证）
  3. gate_commands.P5_e2e 引用了不存在的 spec，verifier 应创建它或用等效方式验证
  4. ShareDialog Popover/Sheet 双模式需在真实浏览器验证
  5. OverflowMenu Dropdown/Sheet 子组件需在真实浏览器验证
- 已知风险：P0-brief 声明涉及 UI 重构，需 Playwright 实跑
- 上游关键决策：P4 implementer 采用方案 A（Thin Wrapper Split），6 个组件创建/修改
- 上游结构化字段（从 P2-design.md grep 提取）：
  - packages: [frontend-v3]
  - domains: [frontend, overflow-redesign, share-redesign]
  - ui_affected: true
  - gate_commands.P5: "cd frontend-v3 && npx vue-tsc --noEmit"
  - gate_commands.P5_e2e: "cd frontend-v3 && E2E_GUARD_ENABLED=1 npx playwright test e2e/t052-header-redesign.e2e.spec.ts e2e/viewer.spec.ts e2e/test_t057_ui_polish.spec.ts e2e/t058-share-redesign.e2e.spec.ts --reporter=line 2>&1 | tail -30"

## verification_env

- debug backend: http://127.0.0.1:8888（已运行，/tmp/peekview-debug/ 数据目录）
- Playwright: npx playwright test（chromium，E2E_GUARD_ENABLED=1）
- Playwright CDP: Chrome :18800（playwright-cdp skill）
- Vision: ~/.claude/skills/vision-analyzer/scripts/vision-analyze.py
