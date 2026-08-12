# P3 Dispatch Context — test-designer

## 目标
为 T083 的 17 条 BDD 验收条件设计 TDD 测试用例（红灯）。测试代码先于实现代码编写，测试必须因实现未写而失败（assertion 失败 / import 失败）。

## 约束
- 每条 BDD（BDD-1 到 BDD-17）对应至少一个测试用例（1:1 映射）
- 测试用例必须因实现未写而失败（红灯），不能因测试代码自身语法错误而失败
- 测试代码放在 `backend/tests/test_cjk_search.py`（新文件）
- 使用 venv pytest 运行
- conftest.py autouse 隔离（自动 tmp_path）
- 现有测试零回归（已有 985 passed + 2 skipped）
- BDD-17（jieba 预加载不阻塞首请求）用 `@pytest.mark.timeout(1)` 或测量方式

## 上游关联
- P1-requirements.md：17 条 BDD（BDD-1 到 BDD-17）
- P2-design.md：方案 A（trigger 降级 + text_utils.py + json_each + jieba 分词）

## 输入文件
1. `docs/tasks/T083-cjk-search-fix/P1-requirements.md` — 17 条 BDD 定义
2. `docs/tasks/T083-cjk-search-fix/P2-design.md` — 方案设计（text_utils.py 接口 + json_each SQL + 四条 FTS 路径）
3. `backend/tests/conftest.py` — 测试隔离配置
4. `backend/tests/factories.py` — 测试数据构建器
5. `backend/tests/test_database.py` — 现有 FTS 测试（参考风格 + 确认零回归）
6. `backend/tests/test_entry_service.py` — 现有 entry service 测试（参考风格）

## 客观查证信息
- P2-design.md 声明 `text_utils.py` 含 `tokenize_for_fts()` / `tokenize_query()` / `preload_jieba()`
- P2-design.md 声明 `json_each` 用于 tag 过滤
- P2-design.md 声明 trigger 降级为仅 DELETE
- P2-design.md 声明 backfill 版本标记（PRAGMA user_version）
- gate_commands.P3: `cd backend && .venv/bin/python -m pytest tests/ -v --tb=short`
- 当前 985 passed + 2 skipped（环境基线）

## 测试设计指导
- BDD-1~6（tag 过滤）：测试 `list_entries(tags=...)` 返回结果
- BDD-7~11（FTS 中文搜索）：测试 `list_entries(q=...)` 返回结果
- BDD-12~13（连字符 tag）：测试 `list_entries(q=...)` 返回结果
- BDD-14（存量重建）：测试 `backfill_fts_content()` 后搜索命中
- BDD-15（新建 entry）：测试 `create_entry()` 后立即搜索命中
- BDD-16（现有测试全绿）：不在 test_cjk_search.py 写，由 P5 gate 验证
- BDD-17（jieba 预加载）：测试 `preload_jieba()` 后首次 `tokenize_for_fts()` 耗时

## 门槛
- P3-test-cases.md 存在且含 test_code_dir
- 每条 BDD 有对应测试用例
- check-tdd-red.sh exit 0（真红灯）

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
3. git commit
4. 更新 .state.yaml phase=P3 → P4

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

## gate 规则（check-tdd-red.sh）

```bash
check-tdd-red.sh $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**测试运行器探测链**：`$TEST_RUNNER` 环境变量 → `gate_commands.P3`（P2-design.md 声明）→ `which pytest` → exit 3。非 pytest 项目在 P2 gate_commands 声明 `P3` 键后，check-tdd-red.sh 自动读取，无需手动设置环境变量。`$TEST_RUNNER` 环境变量始终优先（手动覆盖）。

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