---
phase: P3
generated_by: agate-inject-card.sh + 主 Agent
task_id: T082-arch-refactor
role: test-designer
---

<dispatch_guide>
> 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标
为 T082 架构重构设计 TDD 测试用例。这是纯重构任务——大部分行为已有测试覆盖（976 条后端 + 前端测试），P3 需为新增/变更行为的 BDD 补充测试，确保重构后有红灯测试驱动实现。

### 约束
- 测试必须当前失败（红灯）——因实现未写
- 每条 BDD（BDD-1 到 BDD-41）需有对应测试用例（1:1 映射）
- ui_affected=false，不需 Playwright/E2E 用例（但 P6 仍需 Playwright 验证行为零回归）
- 后端测试目录：backend/tests/（pytest）
- 前端测试目录：frontend-v3/src/ 下（vitest）
- 测试命令：make test-quick（后端）、make test-frontend（前端）
- 不改现有测试——只新增测试文件或新增测试函数
- 测试文件命名：test_t082_*.py（后端）、t082-*.spec.ts（前端）

### 上游关联
- P2-design.md：6 项重构方案（R1~R7），已 approved
- P1-requirements.md：41 条 BDD
- P2 gate_commands: P5=make test-quick, P5_frontend=make test-frontend, P5_typecheck=make typecheck

### BDD 分类与测试策略

**已有测试覆盖的 BDD（不需新增测试，P5 跑现有测试即可）：**
- BDD-15（后端全部测试通过）→ make test-quick
- BDD-40/41（前端单测/类型检查通过）→ make test-frontend / make typecheck

**需要新增测试的 BDD：**
- BDD-1~5（DI 统一）：grep 验证类——可写测试检查路由函数不含 StorageManager/Session 直接实例化
- BDD-6~9（错误格式统一）：HTTP 请求测试——验证返回 {"error":{...}} 格式
- BDD-10~12（去重）：grep 验证类——可写测试检查函数定义全局唯一
- BDD-13（事务回滚）：mock 测试——mock storage.write_file 抛异常，验证 entry row 不存在
- BDD-14（正常创建）：已有测试覆盖，确认即可
- BDD-16~22（store 拆分）：前端单测——验证 store 文件存在、行数、loadSeq 逻辑
- BDD-23~24（component 行数）：wc 验证类——可写测试或脚本验证行数
- BDD-25~38（行为零回归）：已有前端测试 + P6 Playwright 验证
- BDD-39（错误格式兼容）：前端单测——验证 3 个组件读取 .error.message

### 输入文件
- docs/tasks/T082-arch-refactor/P1-requirements.md（41 条 BDD——必读）
- docs/tasks/T082-arch-refactor/P2-design.md（方案设计——必读，含 files_to_read）
- docs/tasks/T082-arch-refactor/P0-brief.md（任务简报）
- AGENTS.md（项目约定、测试命令）
- backend/tests/conftest.py（测试夹具、隔离机制）
- backend/tests/factories.py（测试数据构建器）
- frontend-v3/src/stores/entry.ts（拆分对象）
- frontend-v3/src/views/EntryDetailView.vue（拆分对象）
</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.sh $TASK_DIR`（自动捕获环境基线）。
   该步骤不会阻塞流程——任何 stderr 输出（含 WARNING）均可忽略，直接继续步骤 1，
   无需查看结果、无需判断、无需因为看到 WARNING 而停下来处理。
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
- **输入**：P2-design.md + P1-requirements.md（BDD 验收条件，每条 `#### BDD-NN` 对应一个测试用例）
- **输出**：P3-test-cases.md + test_code_dir/
- **派发 prompt**：`{agate_root}/assets/templates/dispatch-prompt.md`

## 产出规格

- P3-test-cases.md 必须声明 `test_code_dir: {路径}`
- 每条测试用例对应一条 P1 的 `#### BDD-NN` 验收条件（1:1 映射）
- UI 任务（P2 ui_affected: true）：必须含 Playwright/E2E 用例

## gate 规则（check-tdd-red.sh）

```bash
check-tdd-red.sh $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**非 pytest 技术栈**：设置 `TEST_RUNNER` 环境变量指向项目实际测试命令（如 `TEST_RUNNER="npm test"`），check-tdd-red.sh 会使用该命令而非默认的 pytest 探测。这是 agate 协议保持技术栈无关的标准接入点，不需要绕过脚本手动验证。

## 按包拆分并行（可选）

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
### 后端测试现状
- 976 条测试函数（pytest）
- conftest.py autouse 隔离（PEEKVIEW_STORAGE__DATA_DIR/DB_PATH 指向 tmp_path）
- factories.py 提供测试数据构建器
- 测试命令：make test-quick（venv Python）

### 前端测试现状
- vitest + jsdom 环境
- 测试命令：make test-frontend（非 watch 模式）
- 类型检查：make typecheck（vue-tsc --noEmit）

### P2 gate_commands
- P5: make test-quick
- P5_frontend: make test-frontend
- P5_typecheck: make typecheck
- P5_lint: make lint

### 关键代码位置（P2 files_to_read 已验证）
- 后端 DI 问题：entries.py, files.py, auth.py, admin.py, main.py
- 后端 service：entry_service.py, admin_service.py, share_service.py, read_tracking_service.py, apikey_service.py
- 后端去重：_looks_like_jwt (entries:102, files:140, auth:193), _is_global_api_key_auth (entries:108, files:145), _record_read_async (entries:47, files:30)
- 后端事务：entry_service.py:229 commit, 277 commit, 296-302 cleanup
- 前端 store：entry.ts (223 行), loadSeq:7
- 前端 component：EntryDetailView.vue (1003 行)
- 前端错误格式：ExpiresInDialog.vue:66, SecurityTab.vue:71, ProfileTab.vue:74
</objective_info>
