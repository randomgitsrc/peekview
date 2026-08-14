---
phase: P3
task_id: TPV0092-mcp-get-entry-fetch
type: test-cases
parent: P2-design.md
trace_id: TPV0092-P3-20260815
status: draft
---

# P3 派发上下文 — test-designer

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

## 目标

产出 `P3-test-cases.md`（测试用例清单，26 BDD 1:1 映射）+ 新增测试代码（红灯）。本任务**双端测试**：后端 pytest + MCP vitest。

## 关键背景（P2 已定稿，勿重做）

- **改动面**：
  - 后端：`backend/peekview/api/files.py`（raw 端点加 share/purify query 参数）+ 新增 `backend/peekview/services/purify.py`（purify_content 纯函数）
  - MCP：新增 `src/lib/entryRef.ts`（parseEntryRef）+ `src/lib/purify.ts`（净化兜底）+ `src/client.ts` 新增 fetchEntryRaw（匿名）/fetchEntryRawAuthenticated + `src/tools/getEntry.ts` 重写（ref+file）+ `src/tools/publishFiles.ts` 加 Raw URL + `src/types.ts` 新增 EntryRawResponse/RawFileItem
- **实现语义（P2-design.md 已定稿）**：
  - parseEntryRef：5 形态解析（页面/raw 长/raw 短/分享/裸 slug）+ 协议白名单（https 任意 / http 仅 localhost）+ 抛 EntryRefError
  - fetchEntryRaw：匿名 fetch（无 Authorization，仅 X-PeekView-Source: mcp）+ AbortController 30s 超时 + 响应结构校验（slug/summary/files 非空）
  - 净化：`data:image` 变体（大小写/空白/<img>/![alt]）→ `[image: {alt} ({kb} KB, base64)]`；普通文本不误伤
  - 返回策略：单文件 ≤200KB 全量 / >200KB 全量+warning / 多文件 ≤32KB 全量 / >32KB 清单+片段+file= 提示 / file= 取单个（path+filename 优先）
  - raw 端点：?share= 复用 get_entry_with_share（404 无效 token）/ ?purify= 净化非二进制文本 / 缺省向后兼容
- **P2-review 非阻塞建议采纳**（P4 实现 + P3 测试覆盖）：
  - fetch 加 `redirect: 'manual'`/'error'（或跟随后校验最终 host）+ P3 补重定向场景测试
  - P3 补 SSRF 白名单测试（BDD-10/11）+ file= 匹配的无匹配/多匹配错误路径

## 测试用例映射（26 BDD → 用例）

| BDD | 后端 pytest | MCP vitest |
|-----|------------|-----------|
| BDD-1 页面链接 | — | parseEntryRef 页面形态 + fetch 集成 |
| BDD-2 raw 长链接 | — | parseEntryRef raw 长形态 |
| BDD-3 raw 短链接 | — | parseEntryRef raw 短形态（不经 302） |
| BDD-4 裸 slug | — | parseEntryRef slug 形态 + fetchEntryRawAuthenticated |
| BDD-5 分享链接 | raw ?share= 集成 | parseEntryRef share 提取 + 透传 |
| BDD-6 跨 host 公开 | — | fetchEntryRaw 任意 host |
| BDD-7 私有无 token | raw 私有 404 | fetchEntryRaw 404 → 明确错误 |
| BDD-8 凭据隔离 | — | fetchEntryRaw 请求头无 Authorization（mock 断言） |
| BDD-9 非 PeekView 拒绝 | — | 响应校验缺字段 → 无法识别 + 错误不含响应体 |
| BDD-10 非白名单协议 | — | ftp:// file:// 请求前拒绝 |
| BDD-11 http 非 localhost | — | http://非localhost 请求前拒绝 |
| BDD-12 base64 净化保 alt | purify_content 单测 | purify.ts 兜底单测（共用样例） |
| BDD-13 二进制 content=null | raw 响应结构 | 类型映射 |
| BDD-14 无 base64 不误伤 | purify_content 单测 | purify.ts 单测 |
| BDD-15 单文件全量 | — | 返回策略单文件 ≤200KB |
| BDD-16 单文件 >200KB 软警告 | — | 返回策略 warning |
| BDD-17 多文件 ≤32KB 全量 | — | 返回策略多文件小 |
| BDD-18 多文件 >32KB 清单+片段 | — | 返回策略多文件大 + file= 提示 |
| BDD-19 file= 取单个 | — | file= 匹配（path+filename 优先）+ 无匹配/多匹配错误 |
| BDD-20 publish_files raw_url | — | publishFiles 返回含 Raw URL |
| BDD-21 raw ?share= 200 | raw ?share= 集成测试 | — |
| BDD-22 raw ?share= 无效 404 | raw ?share= 无效 token 404 | — |
| BDD-23 raw ?purify= 剥离 | raw ?purify= 集成测试 | — |
| BDD-24 raw 缺省兼容 | raw 无 query 现有行为 | — |
| BDD-25 错误不打印 token | — | 错误消息不含 token 明文 + 完整 URL |
| BDD-26 fetch 超时 | — | 挂起服务器 → 超时错误 |

## 约束

1. **只写测试代码，不写实现**：files.py / purify.py / entryRef.ts / purify.ts / client.ts / getEntry.ts / publishFiles.ts 一律不改（P4 的事）
2. **test_code_dir 声明**：后端 `backend/tests/`（raw 端点测试 + purify 测试）+ MCP `packages/mcp-server/tests/`（现有 tests/tools.test.ts 扩展 + 新增 entryRef/purify 测试文件）
3. **红灯要求**：新测试在实现未写时**必须失败**（B 类红灯：import 失败 / 模块不存在 / 组件未导出——P2 声明的 project_module: packages/mcp-server/src/ + backend 包名）
4. **净化测试共用样例**（DEBT0004 closure_criteria + P2-review）：后端 pytest 与 MCP vitest 用**同一组净化输入样例**（data:image 变体：![alt]/<img>/大小写/空白），作为双端契约锚点
5. **重定向场景测试**（P2-review 非阻塞采纳）：mock 服务器返回 302 → fetch 应拒绝（redirect: 'manual' 后 3xx 视为异常）或跟随后校验——按 P4 实现语义写测试
6. **环境隔离**：后端测试走 conftest 隔离（tmp_path）；MCP 测试走 msw mock（现有 tests/tools.test.ts 先例）或本地 mock 服务器；严禁触碰 :8080/~/.peekview/；不跑 debug backend 集成（那是 P5/P6）
7. **vitest mock hoisting 反模式**：`vi.mock()` 回调只使用字符串字面量，不引用外部变量；动态 mock 用 `vi.doMock` 在 beforeEach 设置
8. 产出写 `agate-workspace/tasks/TPV0092-mcp-get-entry-fetch/P3-test-cases.md`
9. 每读完一个输入文件，把发现追加到 `P3-progress.md`

## 输入文件

1. `agate-workspace/tasks/TPV0092-mcp-get-entry-fetch/P2-design.md`（方案：§2 详细设计 / §5 gate_commands / files_to_read）
2. `agate-workspace/tasks/TPV0092-mcp-get-entry-fetch/P1-requirements.md`（26 条 BDD）
3. `agate-workspace/tasks/TPV0092-mcp-get-entry-fetch/P2-review.md`（非阻塞建议——重定向 + P3 补测）
4. `backend/peekview/api/files.py`（raw 端点现状）
5. `packages/mcp-server/src/tools/getEntry.ts` + `src/client.ts`（现有实现/测试模式）
6. `packages/mcp-server/tests/tools.test.ts`（msw mock 测试先例）
7. `backend/tests/`（现有 pytest 结构 + conftest 隔离先例）
8. `AGENTS.md`（铁律）

## 验证手段（可用）

- 写测试后自跑确认红灯：`make test-quick`（后端）+ `make test-mcp-unit`（MCP）——红灯（实现未写）
- 不实跑 debug backend 集成（P5/P6 跑）

## 产出规格

P3-test-cases.md 必须包含：
- `test_code_dir:` 声明（后端 + MCP）
- 用例清单：编号 ↔ BDD-NN 映射 ↔ 预期（双端标注）
- 红灯确认方式说明

## 返回

路径 + 一句话摘要（N 个测试用例，当前全部红灯——双端红灯状态）。
