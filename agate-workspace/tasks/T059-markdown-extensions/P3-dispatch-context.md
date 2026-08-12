---
phase: P3
task_id: T059
type: dispatch-context
created: 2026-07-20
agent: main
---

# P3 Dispatch Context

## 任务上下文
- 目标：为 4 项 Markdown 扩展设计 TDD 测试用例
- P1 BDD 总数：30 条（B01-B30）
- P2 选定方案：方案A（全局注册 + 全局 CSS import + scrollIntoView 拦截）
- P3 保留但简化（纯前端无后端变更，单元测试覆盖解析输出即可）

## 派发前查证的客观信息
- P2 gate_commands.P5: vitest run --reporter=dot（前端单元测试）
- P2 gate_commands.P5_e2e: playwright test --reporter=line e2e/（因 ui_affected=true）
- P2 files_to_read: useMarkdown.ts, MarkdownViewer.vue, main.ts, package.json, SvgRenderer.vue, base.css
- P2 minimal_validation confirmed: DOMPurify 3.x 默认白名单 + 当前 ADD_ATTR/ADD_TAGS 保留 KaTeX 视觉输出（仅 MathML 可访问性层被剥离）
- 已有测试模式：useMarkdown.blocks.spec.ts（vitest, 直接 render() 调用, 检查 block 类型和内容）

## 关注点
- 测试必须对应 P1 的 30 条 BDD
- P3 简化但不可省略——插件注册 + DOMPurify 交互是关键测试点
- 测试代码目录需在 P3-test-cases.md 中声明 test_code_dir

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：agate/phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
2. 主 Agent 跑 check-tdd-red.sh 确认红灯
3. git commit
4. 更新 .state.yaml phase=P3 → P4

## 如果是重试

确认上一轮失败原因（测试设计不合理 / 未覆盖关键 BDD / 非真红灯）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P3 MAX=2）

## 前置条件

- [ ] P2-design.md files_to_read 完整（测试设计需要知道实现导航）
- [ ] P2-review.md status: approved（P2 未被裁剪时）

## 派发

- **角色**：test-designer（`{agate_root}/assets/execution-roles/test-designer.md`）
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 BDD 验收条件
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则（check-tdd-red.sh）

```bash
check-tdd-red.sh $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

## 推进条件

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

> 完成 → commit 产出 + .state.yaml → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->
