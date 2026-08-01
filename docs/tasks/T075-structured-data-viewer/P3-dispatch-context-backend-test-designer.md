# P3 派发指引 — T075 backend test-designer

## 目标

为 T075 的后端部分设计 TDD 测试用例（BDD-01~06 后端语言检测），更新 `backend/tests/test_language.py`，产出后端测试代码，使测试当前必须红灯（实现未写）。

## 任务背景

T075 包含一个后端子任务：`language.py` 扩展名映射修正（`.tsv` 当前错误映射为 `'csv'`）。需要：
- `.tsv` → `'tsv'`（BDD-02）
- `PLAIN_TEXT_LANGS` 加 `'tsv'`（当前 count=14 → 15）
- 补充 .csv/.tsv 测试用例（BDD-01/02）

## 约束

- 只负责 backend 包：`backend/peekview/language.py` + `backend/tests/test_language.py`
- 前端部分（BDD-07~53）由另一个 frontend test-designer 并行负责，你不碰前端
- 测试必须当前失败（红灯）——因为 `.tsv → 'tsv'` 尚未实现，`test_plain_text_langs_count` 断言 15 当前失败
- 测试名引用 BDD 编号（如 `test_bdd_02_tsv_returns_tsv`）
- 不要修改 `backend/peekview/language.py` 实现（那是 P4 的事）
- vitest mock hoisting 反模式不涉及（后端 pytest，无 vi.mock）

## 上游关联

- P1-requirements.md：BDD-01~06（后端语言检测）
- P2-design.md：§3.1 后端 language.py 修正 + §2.1 影响域 + gate_commands.P3_backend

## 输入文件（按顺序读取）

1. `docs/tasks/T075-structured-data-viewer/P1-requirements.md` — BDD-01~06（只读后端部分）
2. `docs/tasks/T075-structured-data-viewer/P2-design.md` — §3.1 后端修正方案 + gate_commands
3. `backend/peekview/language.py` L60-75, L255-270 — EXTENSION_MAP `.tsv` 行 + PLAIN_TEXT_LANGS 定义
4. `backend/tests/test_language.py` — 现有测试结构（TestDetectLanguage / TestPlainTextLanguages）

## 客观查证信息

- 当前 `language.py:69` = `".tsv": "csv"`（bug，需改为 `"tsv"`）
- 当前 `PLAIN_TEXT_LANGS` = 14 个（`text, log, csv, ignore, git_attributes, autohotkey, editorconfig, git_config, janet, odin, pip-requirements, sed, vba, vbscript`）
- 当前 `test_plain_text_langs_count` 断言 `len == 14`（加 tsv 后应更新为 15）
- 现有测试模式：`TestDetectLanguage` 类 + `test_xxx_file` 方法（如 `test_json_file` / `test_yaml_file`）
- 测试运行命令：`cd backend && python -m pytest tests/test_language.py -q --tb=no`（用 venv：`backend/.venv/bin/python`）

## 红灯设计（每个测试必须在当前实现下失败）

| BDD | 测试函数 | 红灯原因（当前实现） |
|-----|---------|---------------------|
| BDD-01 | `test_bdd_01_csv_returns_csv` | `.csv → 'csv'` 当前已对 → **绿**（回归保护，非红灯） |
| BDD-02 | `test_bdd_02_tsv_returns_tsv` | `.tsv → 'csv'` 当前 bug → **红灯**（断言 `'tsv'` 失败） |
| BDD-03 | `test_bdd_03_json_returns_json` | 已对 → 绿（回归保护） |
| BDD-04 | `test_bdd_04_yaml_returns_yaml` | 已对 → 绿（回归保护） |
| BDD-05 | `test_bdd_05_yml_returns_yaml` | 已对 → 绿（回归保护） |
| BDD-06 | `test_bdd_06_xml_returns_xml` | 已对 → 绿（回归保护） |
| BDD-02 相关 | `test_plain_text_langs_count` 更新 14→15 | **红灯**（当前 14，断言 15 失败） |
| BDD-02 相关 | `test_contains_tsv`（`"tsv" in PLAIN_TEXT_LANGS`） | **红灯**（当前无 tsv） |

整体 `pytest tests/test_language.py` 必须是红灯（有失败用例），证明实现未完成。

## 产出

1. 修改 `backend/tests/test_language.py` — 新增 BDD-01~06 测试用例 + 更新 `test_plain_text_langs_count` 为 15 + 新增 `test_contains_tsv`
2. 写 `docs/tasks/T075-structured-data-viewer/P3-test-cases-backend.md` — 后端 BDD-01~06 测试用例清单（映射表，说明红灯原因）
3. 追加 `docs/tasks/T075-structured-data-viewer/P3-progress.md`（分阶段落盘）

**注意**：P3-test-cases.md 主文件由 frontend test-designer 产出（含全部 53 BDD 总表）。你产出 `P3-test-cases-backend.md` 作为后端子集补充。

## 门槛

- `backend/tests/test_language.py` 改动落盘
- `cd backend && .venv/bin/python -m pytest tests/test_language.py -q --tb=no` 当前**有失败用例**（红灯）
- 不修改 `backend/peekview/language.py` 实现

## 返回给主 Agent

只返回两行：产出文件路径 + 一句话摘要（N 个测试，当前 X 红 X 绿）。

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
