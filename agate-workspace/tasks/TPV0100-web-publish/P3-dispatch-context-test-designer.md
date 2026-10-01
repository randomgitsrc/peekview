# P3-dispatch-context-test-designer — TPV0100

---
phase: P3
task_id: TPV0100
role: test-designer
generated_by: 主 Agent
---

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

## 你的任务（目标）

为「网页发布入口」设计 TDD 测试（先写测试，当前必须全红），产出 `P3-test-cases.md` + `P3-test-code/`。任务一句话：**30 条 BDD → 30 个测试用例（1:1 映射），含 vitest 单测（composable/校验/编码/幂等/API 层）+ Playwright E2E（UI 交互 + 视觉）。**

## 输入文件（必读，按序）

1. `agate-workspace/tasks/TPV0100-web-publish/P2-design.md` —— **主输入（实现方案）**。重点读：
   - §1 影响面梳理（改什么/落点文件）
   - §2 候选方案 + §2.x UI 维度候选
   - §3 UI 设计节（渲染形态 layout / 三类 checklist）**+ §3.4 可访问性契约 + §3.2.2 焦点迁移**
   - §4 详细设计（§4.1 数据流 / §4.2 幂等键 / §4.3 结果态 / §4.4 编码规则 / §4.5 预校验 / §4.6 提交与失败 **含 400 vs 422 错误口径** / §4.7 团队 + §4.7.1 slug 提示 / §4.8 测试标识清单 **data-testid** / §4.9 E2E 落点 / §4.10 组件契约表 / §4.11 PublishResult）
   - §5 gate_commands（P3/P5 命令）
   - §7 files_to_read
2. `agate-workspace/tasks/TPV0100-web-publish/P1-requirements.md` —— **30 条 BDD（验收条件，每条 `#### BDD-NN` 对应一个测试用例）**
3. `docs/specs/peekview-web-publish-20261001.md` —— 设计规格 V1.1（§8 测试策略 / §9 验收要点）
4. `frontend-v3/src/api/client.ts` —— 现有 PeekAPI 类（了解如何 mock / 现有方法）
5. `frontend-v3/src/composables/useToast.ts` —— 反馈调用
6. `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts` —— **E2E 编写规范参照**（登录 fixture / afterEach 清理 / 双视口 / API 前置）
7. `frontend-v3/playwright.config.ts` —— project 列表 / viewport / BASE_URL
8. `frontend-v3/vitest.config.ts`（或 `vite.config.ts` 内 test 配置）—— vitest 环境/别名/覆盖
9. `frontend-v3/package.json` + 根 `Makefile` —— 测试命令（`make test-frontend` = `npx vitest run`；E2E = `make debug-test` / `E2E_SPEC=... make debug-test`）
10. `frontend-v3/src/utils/`（若有测试目录 `frontend-v3/src/**/__tests__/` 或 `frontend-v3/tests/`）—— **现有单测落点惯例**
11. `backend/peekview/language.py` `is_binary_content` —— 文本/二进制判定基准（BDD-8/30 的期望）
12. `backend/peekview/models.py` `FileCreate` / `CreateEntryRequest` / `CreateEntryResponse` —— 契约

## 已锁定的架构决策（P2 定稿，**不得重开**）

- 方案 A：前端内联 JSON → `POST /api/v1/entries`，**后端零改动**（**不要写后端 pytest 用例**——后端不改，本任务测试全在前端）
- 结果态 = 页面内状态机（不新增路由）
- 幂等键绑载荷指纹（载荷变则换键）
- 编码：文本走 `content`，二进制走 `content_base64`；**前端自判**（NUL → 二进制；否则严格 UTF-8 解码失败 → 二进制）
- `fileErrors` 用稳定 `fileId`（非 index）
- 400 错误取 `error.message`；422 取 `detail[].msg` 拼接

## 主 Agent 已实核的客观事实

- 后端限额：`max_file_size` 20MB / `max_entry_files` 50 / `max_entry_size` 100MB / `max_summary_length` 500 / `max_slug_length` 64 / `default_expires_in` `15d`
- `GET /api/v1/config/limits` 返回上述 6 字段（不含限流）
- slug 规则 `^[a-z0-9_-]+$` ≤64；`path` ≤500、`filename` ≤255
- `content_base64` → 后端无条件 `is_binary:true`/`language:null`；`content` 才判 binary + 检测语言
- `client.ts` 已设 `withCredentials: true`
- 创建端点不消费 `X-PeekView-Source`
- 环境 = debug `:8888`（seed 用户 alice/bob/carol，密码 `testpass123`）

## 硬性要求

1. **1:1 映射**：30 条 BDD 各一个测试用例（BDD 编号写进测试名 / 用例表）。**不许漏、不许合并不许臆造新 BDD**。
2. **`test_code_dir`**：在 `P3-test-cases.md` 声明。**建议**：`agate-workspace/tasks/TPV0100-web-publish/P3-test-code/`——但**前端测试必须能被 `make test-frontend`（vitest）和 `make debug-test`（Playwright）实际发现并执行**。故：
   - **vitest 单测**落 `frontend-v3/src/**/__tests__/*.spec.ts`（或仓库现有惯例落点，先看 10）
   - **Playwright E2E**落 `frontend-v3/e2e/tpv0100-publish.spec.ts`（P2 §4.9 已指定；`E2E_SPEC=e2e/tpv0100-publish.spec.ts make debug-test`）
   - `test_code_dir` 声明为落点根（并在文档中列出 vitest 文件路径 + E2E 文件路径）
3. **UI 任务（ui_affected: true）必须有 Playwright/E2E 用例**——覆盖 P2 §4.8 测试标识清单里的关键交互点。**至少覆盖**：入口可达（BDD-1/2/3/4）、未登录重定向（BDD-5）、多文件发布成功（BDD-6）、文本渲染+二进制下载（BDD-7）、相对路径嵌套目录（BDD-9）、结果态链接（BDD-10/11/12）、再发一个（BDD-13）、表单校验拦截（BDD-14~19）、默认公开/过期（BDD-20）、可选字段（BDD-21）、失败保留（BDD-23）、提交中禁用（BDD-27）、人工体验路径（BDD-28）、视觉呈现（BDD-29）
4. **双 viewport 截图**：E2E 必须配置 `desktop_1280x800` 与 `mobile_390x844` 两个 project，截图存 `{AGATE_WORKSPACE}/tasks/TPV0100-web-publish/evidences/`，文件名 `desktop_1280x800.png` / `mobile_390x844.png`（操作类 BDD 截图内容必须互不相同）
5. **测试必须当前全红**：失败原因须是"被测模块未实现"（如 `PublishView.vue` / `useFileEncoding` / `usePublishValidation` / `createEntry` 不存在 → import 失败 = B 类红灯），**不是**"断言与测试数据矛盾"（A 类错误）
   - ⚠️ **vitest mock hoisting 反模式**：`vi.mock()` 回调只许用字符串字面量，不引用外部变量；动态 mock 用 `vi.doMock` 在 `beforeEach` 设置
6. **平台假设扫描**：`python3 /home/kity/.agate/v0.77.0/agate/scripts/check-platform-assumptions.py <测试目录>` → **0 命中**。注意本任务测试是 `.ts`（不在扫描面内，跑恒绿），但仍要遵守纪律：不写死系统临时目录字面量、不裸 `python3`、不硬编码 PATH
7. **创建型测试清理钩子（强制）**：E2E 用例创建 entry 必须声明清理——创建即注册，测试结束**无条件删除**（不因响应非 2xx 中止），删除接受 200/204/404（afterEach 清理队列模式）；用 `e2e-` 前缀命名 + afterEach 经 API 删除
8. **E2E 防生产护栏**：BASE_URL 默认 :8888；`scripts/run-e2e-tests.sh` 内置生产端口拦截

## 测试分层建议（你来定稿）

- **vitest 单测**（纯函数/组合式，可 mock API）：
  - `useFileEncoding`：文本/二进制判定（BDD-8/30）、base64 编码、大文件
  - `usePublishValidation`：summary 空/超长、文件数/单文件/总量、路径非法/重复/超长、slug 校验（BDD-14~19）
  - 幂等键：载荷指纹变化 → 换键（BDD-13/23/24）
  - `createEntry` API 封装（mock axios）：请求体契约、错误提取（400 `error.message` / 422 `detail[].msg`）（BDD-25/26）
  - 默认值：公开 + 15d（BDD-20）
- **Playwright E2E**：真实 UI 交互 + 视觉（见 3）
- 若某 BDD 难以自动化（如 BDD-28 人工体验路径、BDD-29 视觉呈现），**仍需写用例**（E2E 截图 + 断言），不得因为"难"而省略——P6 会逐条二值验收

## 产出与格式

- 产出 1：`agate-workspace/tasks/TPV0100-web-publish/P3-test-cases.md`（用例清单：编号、对应 BDD、层次/文件、预期、红灯理由）
  - Header 值：`phase: P3`，`task_id: TPV0100`，`type: test-cases`，`parent: P2-design.md`，`trace_id: TPV0100-P3-20261001`，`status: draft`，`created: 2026-10-01`，`agent: test-designer`
  - 必须声明 `test_code_dir: <路径>`
- 产出 2：测试代码（vitest 落 `frontend-v3/src/.../__tests__/`；E2E 落 `frontend-v3/e2e/tpv0100-publish.spec.ts`）
- **不要**创建 `P3-test-code/` 里放不可执行的副本——测试必须放在 vitest/Playwright 能发现的位置
- 写完用 `agate-md-field-set` 填 frontmatter（如不可用按 task-files.md 手工写并报告）；跑 `python3 /home/kity/.agate/v0.77.0/agate/scripts/check-frontmatter.py <产出路径>`，非 0 先修正
- 分阶段落盘：追加写 `P3-progress.md`；每条 bash 命令执行前也追加一行

## 命令超时（强制）
任何 bash 命令设 `timeout 180s <cmd>`（`make test-frontend` / E2E 按需 300-600s；注意 E2E 需 debug :8888 在线，跨调用须挂后台 job 托底）。超时/非预期失败 → 停止、progress 记一行、返回主 Agent。

## 环境隔离（强制）
只用 debug `:8888`。**严禁**触碰生产 `:8080` 与 `~/.peekview/`；测试 entry 只经 debug HTTP API 创建，禁用 CLI `peekview create`。临时产物落 `.agate-tmp/`。状态标记二值格式：触发 `[PROD_TOUCHED] {描述}`，未触发 `[PROD_NOT_TOUCHED]`。

## 门槛（什么算完成）
- `P3-test-cases.md` 存在且含 `test_code_dir`
- 30 条 BDD 各有对应测试用例（1:1）
- 测试代码存在且可被 vitest / Playwright 发现
- UI 任务：Playwright/E2E 用例存在（含双 viewport）
- 测试当前全红（红灯原因是"模块未实现"）
- `check-frontmatter.py` exit 0

## 返回给我（重要）
只返回两行：
1. `P3-test-cases.md` 路径 + 测试代码根路径
2. 一句话摘要：N 个测试用例（M 单测 + K E2E），当前全红

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
