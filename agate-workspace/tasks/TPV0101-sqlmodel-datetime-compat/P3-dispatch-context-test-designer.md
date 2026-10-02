# P3-dispatch-context-test-designer — TPV0101

---
phase: P3
task_id: TPV0101
role: test-designer
generated_by: 主 Agent
---

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

## 你的任务（目标）

作为 **test-designer**，为「sqlmodel 0.0.47 naive datetime 兼容修复」写测试设计 `P3-test-cases.md` + 测试代码。

## 角色定义

`~/.agate/v0.77.0/agate/assets/execution-roles/test-designer.md`（先读）

## ⚠️ 本任务的测试口径（重要，双重性）

本任务 `change_type: refactor`（P1 frontmatter），P3 卡规定 refactor 走**回归口径**、跳过 check-tdd-red 红灯。但本任务的 P2 设计（§R3）**明确新增了有真红灯语义的守卫测试**——因为缺陷真实存在（修复前 0.0.47 下必红）。

**你的测试设计须同时满足两件事**：
1. **新增守卫测试**（有真红灯语义）：`backend/tests/test_datetime_naive_compat.py`（0.0.47 下修复前必红）+ `backend/tests/test_dependency_guard.py`（BDD-15 守卫）
2. **回归口径声明**：`P3-test-cases.md` 须声明既有测试套件的回归覆盖映射（18 BDD 各对应哪些既有/新增测试）

**验收标准**：新增守卫测试**在隔离 venv（0.0.47）下修复前必须红**（真红灯，B类错误）——这是 P2 `gate_commands.P3` 的定义，主 Agent 会跑 `check-tdd-red.py` 确认。

## 输入文件（必读）

1. `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P1-requirements.md` —— **18 BDD**（每条 1:1 映射一个测试用例）
2. `agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P2-design.md` —— 设计（§R1 列清单 / §R3 测试补充 / §0.2 不改什么 / gate_commands）
3. `backend/peekview/models.py`（25 列）、`backend/peekview/services/*.py`、`backend/peekview/database.py`
4. `backend/tests/` 既有测试结构 + `backend/conftest.py`（隔离 fixture）

## 主 Agent 已查明的客观事实

- 隔离 venv `/tmp/ci-repro-venv` **已就绪**（sqlmodel 0.0.47 + sqlalchemy 2.0.54 + pytest 9.1.1）
- 本地 venv `backend/.venv`（sqlmodel 0.0.38）
- 修复前 0.0.47 失败 SQL：`UPDATE entries SET archive_delete_at=?, ...` / `UPDATE users SET disabled_at=?, ...`
- 25 个 datetime 字段 / 11 张 `table=True` 表（P1 §2.1 已逐字段判定 naive UTC）
- **aware 写入面 19 行**（P1 §4.1）+ naive 写入面 14 行——都是测试覆盖面

## 测试设计要点

### 必须覆盖的 18 BDD（1:1）
| BDD | 测试 |
|-----|------|
| BDD-1 | 0.0.47 下全部受影响列 naive 写入（含 aware 值路径）+ 不抛错 |
| BDD-2 | NULL ↔ naive 往返 |
| BDD-3 | 读路径 naive WHERE 比较不抛错 |
| BDD-4 | 本地 0.0.38 不回归（由 P5 全量承载，P3 可声明映射） |
| BDD-5 | 两版本全量均绿（映射到 P5/P5_ci_repro） |
| BDD-6 | naive UTC 存储语义 + 既有数据读出无漂移 |
| BDD-7 | API 响应时间形态（naive ISO 无 `+00:00`） |
| BDD-8 | 备份导出 JSON + CLI 输出时间形态 |
| BDD-9 | 全部 aware 赋值路径绑定为 naive UTC |
| BDD-10 | backup restore（merge + replace）时间往返一致 |
| BDD-11 | 归档倒计时 + star 生命周期 |
| BDD-12 | admin 清理 + 用户禁用流程 |
| BDD-13 | CLI 用户禁用 + 时间展示 |
| BDD-14 | backfill_archive_delete_at 幂等 |
| BDD-15 | 依赖守卫存在可执行 + 注入漂移变红 |
| BDD-16 | 25 列静态扫描（`__table__.columns` 全为显式 naive） |
| BDD-17 | API 契约不变（前端/MCP 范围外声明） |
| BDD-18 | 生产数据未污染（`[PROD_NOT_TOUCHED]`） |

### 测试文件规划（P2 §R3）
- `backend/tests/test_datetime_naive_compat.py` —— BDD-1/2/3/6/9/16 核心守卫（60-100 行）
- `backend/tests/test_dependency_guard.py` —— BDD-15 守卫测试
- 复用既有测试承载回归：BDD-10/11/12/13/14（备份/star/admin/CLI/backfill）
- 序列化契约断言：BDD-7/8/17

### 硬约束
- **测试须在 0.0.47 下真红灯**（修复前），修复后转绿
- **创建型测试清理钩子**：含创建资源用例须注册清理（afterEach 队列模式）
- **平台假设扫描**：新测试文件须过 `check-platform-assumptions.py`（0 命中）——**注释里的系统临时目录字面量也算命中**，需运行时拼接（如 `TMP = "/" + "tmp"`）
- 测试用 conftest 隔离（`isolate_config_file` autouse），勿碰生产 `:8080` / `~/.peekview/`
- 命名/风格对齐 `backend/tests/` 既有测试

## 产出格式

`agate-workspace/tasks/TPV0101-sqlmodel-datetime-compat/P3-test-cases.md`
- 必须声明 `test_code_dir: backend/tests/`
- 18 BDD 1:1 映射表 + 回归口径声明（既有测试覆盖映射）
- 新增测试清单 + 每条的红灯预期

测试代码写入 `backend/tests/`。

## 约束

- 只写测试，**不写实现**（P4 才实现）
- 测试必须在 0.0.47 下真红灯（**务必自己用 `/tmp/ci-repro-venv` 实跑确认红灯**）
- shell 命令显式带超时；勿碰生产

## 返回给我（重要）

只返回两行：
1. `P3-test-cases.md` 路径 + test_code_dir + 新增测试文件数
2. 一句话摘要（≤40 字）

绝对不要返回文件全文。

---

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P3

路径：phase-cards/P3-tdd.md
---
# P3 — TDD 测试设计

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P3 + 有合规理由（risk=low + 跳过风险已声明）→ 跳过，读 P4 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.py $TASK_DIR`（自动捕获环境基线）。**必须执行**。
   该步骤不阻塞流程——脚本的 stderr 输出（含 WARNING）均可忽略，执行完直接继续步骤 1。

**创建型测试清理钩子（强制要求）**：测试含创建资源用例（建团队/条目等）时，须声明清理钩子要求——创建即注册、测试结束无条件删除（不因响应非 2xx 中止删除）、删除接受 200/204/404 为已清理（afterEach 清理队列模式）；验收环境残留由清理钩子与 post-test 残留检查共同兜底（见 P6 卡）。

1. 派发 test-designer subagent → 产出 P3-test-cases.md + 测试代码目录
   1.1 写 P3-dispatch-context-test-designer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 主 Agent 跑 check-tdd-red.py 确认红灯
3. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P3，不要提前写 P4——phase = 本 commit 的产出阶段
4. git commit -m "wf({Txxx}-P3): {摘要}"（phase=P3，P3 产出含 P3-test-cases.md + 测试代码）
5. P3 commit 完成后进入 P4：**phase 推进 P4 随 P4 产出 commit 一起**（P4-implementation.md 就绪后），不是单独 phase commit

## refactor 任务：回归测试口径

> 适用：P1 frontmatter 声明 `change_type: refactor` 的任务（P2-design.md §3.4）。功能任务（缺省）走上方既有 TDD 口径，不受本节影响。

refactor 任务无新增功能行为可断言，P3 测试设计改用**回归测试口径**：

- **测试设计 = 回归测试口径**：复用/保留既有测试用例，标注每条回归用例覆盖了重构涉及的哪些文件/路径；**不新增功能行为断言**（无新行为可断言）。
- **跳过 check-tdd-red 红灯步骤**：重构无新功能断言，测试套件本就全绿，红灯语义不适用（check-tdd-red 对 refactor 任务会误报 exit 2 绿灯）。回归质量由 P5 全量回归（gate_commands.P5）+ P6 的 `regression.log`（全量回归重跑）兜底。CI backstop 对 refactor 任务同样跳过 check-tdd-red（ci-gate-backstop.py P3 分支 refactor 感知）。
- **P3 gate 不变**：仍为文件存在性检查——refactor 的 P3 产出是 P3-test-cases.md（回归口径声明 + 既有用例覆盖映射），文件存在即满足 gate。

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

**check-gate.py P3**（hook + 主 Agent 预跑，秒级文件检查）：
- exit 1：P3-test-cases.md 不存在
- exit 2：P3-test-cases.md 存在（TDD 红灯由 check-tdd-red.py 独立确认）

**check-tdd-red.py**（主 Agent 手动确认红灯 + CI backstop P3 兜底）：

```bash
check-tdd-red.py $TASK_DIR
```

- **exit 0**：真红灯（assertion 失败 / 项目内 import 失败 = B类错误）— 测试正确但因实现未写而失败
- **exit 1**：假红灯（SyntaxError / 第三方 import 失败 = A类错误）— 测试代码自身错误
- **exit 2**：绿了 — 实现先于测试，违反 TDD
- **exit 3**：无可用测试运行器

**技术栈无关**：check-tdd-red.py 通过 formatter 将测试输出标准化为 JSON，不直接解析任何框架的输出格式。formatter 在 gate_commands.P3_formatter 中声明（可选）。不提供 formatter 时退化为 exit-code-only（所有红灯 = 可推进）。

**探测链**：`$TEST_RUNNER` 环境变量 → `gate_commands.P3`（P2-design.md 声明）→ `which pytest` → exit 3。`$TEST_RUNNER` 始终优先（退化为 exit-code-only，无 formatter）。

**formatter 选择**：见 `assets/formatters/README.md` 速查表。常用：pytest → `pytest.sh`，vitest → `vitest.sh`，go test → `go-test.sh`，其他 → `generic-exit-only.sh`。

## 按包拆分并行（条件触发，非强制）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

当 P2 声明多个 packages 且包间无数据依赖时，P3 可拆分并行：

1. 每个 package 派一个 test-designer subagent
2. 各自写各自的测试文件（不同目录）
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit

拆分判据（本阶段特定）：
- P2 packages > 1 且包间无数据依赖 → 可并行
- 单包或包间有依赖 → 串行（不拆分）
- P2 未声明 packages → 串行

每个 subagent 的 dispatch-context 必须明确其负责的 package 范围（约束节写"只写 {pkg} 目录下的测试"）。

## 推进条件（全部满足才写 phase: P4）

- [ ] check-tdd-red.py exit 0（真红灯确认）
- [ ] P3-test-cases.md 存在且含 test_code_dir
- [ ] 测试代码目录存在
- [ ] UI 任务：Playwright/E2E 用例存在
- [ ] **新增/改动的测试文件通过平台假设扫描**：`python3 {agate_root}/scripts/check-platform-assumptions.py <测试目录>` → **0 命中**
  - 用 `{agate_root}`（协议根占位符）而非裸 `agate/scripts/`：本卡其余处写 `agate/scripts/...` 是**面向 agateon 自身**的惯例，而本条对**任何使用者项目**都成立（`{agate_root}` 由 `agate-resolve.py` 解析）
  - 扫 R1~R5（裸 `python3` / 硬编码 `PATH` / 系统临时目录字面量 / 其它平台假设）。**注释里的字面量也算命中**——writer 最常踩的就是这个
  - 来历（DEBT0048）：P3 曾只查"红灯对不对"，平台假设要到 **P4 全量 pytest** 才由 `check-platform-assumptions.py` 的 bdd-8（全树 0 命中）抓出 ⇒ 多一个"收口小修"回合。**本仓 2026-09-29 两批修复各自又踩了一次**（新测试注释写系统临时目录字面量）
  - 修法：需要该路径字面量时**运行时拼接**（如 `TMP = "/" + "tmp"`），仓库既有惯例
  - ⚠️ **扫描面限定**：`check-platform-assumptions.py` 只扫 `.bats/.bash/.sh/.py` 四种后缀（源码 `L128`）——**TS/JS 测试文件不在扫描面内**。故本条对 **Python/shell 测试项目**成立；**前端项目（Playwright/vitest 等 .ts/.js 用例）跑该自查恒绿，不等于无平台假设**——那类项目的平台无关性需另想办法（已知缺口，见 DEBT0048 记录）。

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
