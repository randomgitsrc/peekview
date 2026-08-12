---
phase: P6
task_id: T049
type: dispatch-context
created: 2026-07-08
agent: orchestrator
---

# P6 Dispatch Context

## Phase P6: Acceptance

**Goal**: Verify all BDDs pass via CDP Playwright + vision analysis.

## Inputs
- P1-requirements.md — 22 BDDs (A-BDD-1~6, B-BDD-1~9, C-BDD-1~8)
- P2-design.md — implementation plan
- P4-implementation.md — code changes (mobile scroll, CSS, diagram sanitize)
- P5-test-results — unit tests passing

## Dispatch Plan
- P6-acceptance.spec.ts — standalone Playwright CDP test script for 13 UI BDDs
- 9 backend/sanitizer BDDs verified via P5 unit test results
- Vision analysis via vision-helper subagent for screenshot validation

## Gate Checklist (to be completed during verification)
- [ ] Acceptance results verified
- [ ] Screenshots in P6-evidence/screenshots/ (9 unique, all >= 1KB)
- [ ] Vision YAML reports: blocker_count=0 for all
- [ ] Evidence directory non-empty
- [ ] Provenance check: evidence-1to1 correspondence
- [ ] agent field present in P6-acceptance.md

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P6

路径：agate/phase-cards/P6-acceptance.md
---
# P6 — 验收

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → P6 不可裁剪。no_behavior_change 可简化（快速验收），不可省略。

## 如果是首次进入本阶段

1. 派发 verifier subagent → 产出 P6-acceptance.md + P6-evidence/
2. UI 任务：派 vision-analyst → 产出 vision-reports/
3. 主 Agent 逐条核实 BDD 对照结果
4. **先验证功能（用户视角），再满足 gate 格式**（T046 教训：别反过来）
5. 预跑 check-gate.sh P6 + check-p6-evidence.sh + check-p6-provenance.sh
6. git commit → 更新 .state.yaml phase=P6 → P7

## 如果是重试

确认上一轮失败原因（BDD 不覆盖 / 证据不足 / gate 格式拦截）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P6 MAX=2）

## 核心原则 ⚠️

**先验证功能（用户视角），再满足 gate 格式。** gate 是必要条件（格式不对 → commit 不了），不是充分条件（格式对了 ≠ 功能正确）。T046 教训：花 2 小时凑 PASS 格式，没花 5 分钟检查 API 响应头。

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

### P6-evidence/

- 必须非空，每个文件含实质内容（截图 >1KB，断言文件含实际输出）
- 不接受 1 行文本文件充数（T046 教训：15 个 1 行 txt 文件凑 provenance 数量）

### vision-helper 结论绑定 ⚠️

- `ui_affected: true` 时至少一条 PASS 基于 vision-helper 报告
- vision-helper 报 `blocker_count > 0`：不能仅用程序化指标（naturalWidth>0, complete=true, HTTP 200）反驳
- 必须追查根因（curl -I 检查响应头 / DevTools Network / API 日志），追查结果写入 P6-acceptance.md

## gate 规则

```bash
check-gate.sh P6 $TASK_DIR      # FAIL=0 / NEED_CONFIRM=0 / 总数>0
check-p6-evidence.sh $TASK_DIR  # 证据目录非空 / UI截图>1KB / md5去重
check-p6-provenance.sh $TASK_DIR # 证据-结论对应 / dispatch-context审计 / BDD对照
```

- Fail > 0 → gate exit 1 → 回 P4
- NEED_CONFIRM > 0 → gate exit 1 → PAUSED

## 推进条件

- [ ] 所有 BDD PASS（FAIL=0）
- [ ] 无 [NEED_CONFIRM]
- [ ] P6-evidence/ 目录非空 + 证据文件被引用
- [ ] UI 任务：vision-helper blocker_count=0 或 blocker>0 已追查
- [ ] provenance 审计通过

## 常见错误（T046 实证）

1. **用 DOM 属性替代视觉验证**：img.src 被重写 = 图片显示正常。不对——还有 Content-Type、CORS、CSP 等 100 种原因导致图片不渲染。**vision-helper 说破了就是破了**
2. **凑 PASS 数量**：deferred BDD 标 PASS、用 1 行文本文件充证据 → provenance 审计能通过但功能不对
3. **只验证中间指标不验证用户结果**：naturalWidth>0, complete=true, API 返回 200 → 结论"功能正常"。用户看到的：破图。**问自己：用户看到了什么**
4. **收到视觉否定先反驳**：vision-helper 报异常 → 先 curl -I 查响应头 → 再决定是 vision 误报还是真问题。T046：三次视觉否定被三次程序化指标反驳，15 分钟浪费

## 下游影响

- P7 一致性检查依赖 P6 的 BDD 对照结果
- 验收结果是判定任务成败的最终依据——P8 发布只是机械步骤

## 自查≠gate
写完验证脚本后应自跑确认脚本可执行（自查），但自查通过 ≠ P6 gate 通过。
P6 gate 由主 Agent 亲自执行验收检查，结果以主 Agent 为准。
不要在返回中声称"验收已通过"或"全部 BDD PASS"——只返回路径 + 摘要。

> 完成 → 读 phase-cards/P7-consistency.md
<!-- AGATE_CARD_END -->
