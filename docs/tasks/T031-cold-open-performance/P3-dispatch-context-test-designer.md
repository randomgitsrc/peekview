---
phase: P3
generated_by: agate-inject-card.sh + 主 Agent
task_id: T031
role: test-designer
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
产出 P3-test-cases.md + P3-test-code/ 目录——Explore 列表页性能与交互优化的 TDD 测试用例，当前必须全部红灯

### 约束
- **ui_affected: true**——必须含 Playwright/E2E 用例覆盖每个交互点
- **每条 P1 BDD（BDD-1~BDD-7）都有对应测试用例**
- **测试当前必须全部失败（红灯）**——因为实现还没写
- **测试代码放在 frontend-v3/src/components/__tests__/ 或 frontend-v3/e2e/ 目录**
- **vitest 单测**：组件级测试（EntryCard、EntryListRow 的 <a> 语义、分隔符、placeholder）
- **Playwright E2E**：集成测试（并行加载、右键菜单、骨架屏、嵌套交互）
- **Playwright 必须用 CDP 模式**：chromium.connectOverCDP('http://localhost:18800')，不能 launch()
- **Playwright 脚本必须 try/finally { page.close() } + process.exit(0)**
- **运行命令**：NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx script.ts
- **前端单测运行**：cd frontend-v3 && ./node_modules/.bin/vitest run
- **P3-test-cases.md 必须声明 test_code_dir**

### 上游关联
- P1-requirements.md：7 条 BDD（BDD-1~BDD-7）
- P2-design.md：方案详情 + files_to_read + minimal_validation confirmed
- P2 ui_interaction_points：8 个交互点需 E2E 覆盖

### 输入文件（必读）
- docs/tasks/T031-cold-open-performance/P1-requirements.md（BDD 验收条件）
- docs/tasks/T031-cold-open-performance/P2-design.md（方案 + files_to_read）
- docs/tasks/T031-cold-open-performance/P0-brief.md（环境约束）
- frontend-v3/src/components/EntryCard.vue（当前卡片实现）
- frontend-v3/src/components/EntryListRow.vue（当前列表行实现）
- frontend-v3/src/views/EntryListView.vue（列表页主组件）
- frontend-v3/src/views/EntryDetailView.vue（详情页，加载链）
- frontend-v3/src/stores/entry.ts（entry store）
- AGENTS.md（项目约定、铁律）
</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：agate/phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
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

> 完成 → 读 phase-cards/P4-implementation.md
<!-- AGATE_CARD_END -->

<objective_info>
- debug backend: http://127.0.0.1:8888 (make debug-start, /tmp/peekview-debug/)
- seed data: make debug-seed → alice/bob/carol (password testpass123), 12 entries
- 前端单测：cd frontend-v3 && ./node_modules/.bin/vitest run
- 前端类型检查：cd frontend-v3 && npx vue-tsc --noEmit
- Playwright CDP：chromium.connectOverCDP('http://localhost:18800')
- Playwright 运行：NODE_PATH=/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules npx tsx script.ts
- 当前 EntryCard.vue：div.card-body @click="goToEntry" + role="button" + tabindex="0" + @keydown.enter/space
- 当前 EntryListRow.vue：类似结构
- 当前 EntryListView.vue：loading 时显示 "Loading..." 文本
- 当前 EntryDetailView.vue：onMounted 串行 loadEntry
- 当前 stores/entry.ts：loadEntry 串行 getEntry → selectFile → getFileContent
- 分隔符 `·`：EntryCard.vue、EntryListRow.vue、EntryListView.vue footer
- 搜索框 placeholder："搜索标题、标签和文件内容"
- Explore 按钮：LandingView.vue 两处
- vitest 配置：frontend-v3/vitest.config.ts（jsdom 环境）
- E2E 目录：frontend-v3/e2e/（已有 spec 文件可参考格式）
</objective_info>
