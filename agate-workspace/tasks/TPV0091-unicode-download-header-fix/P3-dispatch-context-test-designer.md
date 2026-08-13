---
phase: P3
task_id: TPV0091-unicode-download-header-fix
type: test-cases
parent: P2-design.md
trace_id: TPV0091-P3-test-designer-20260813
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
3. 更新 .state.yaml phase=P3 → P4
4. git add {AGATE_WORKSPACE}/tasks/{Txxx}/（含 .state.yaml + 产出文件，若 .gitignore 忽略需 git add -f）
5. git commit -m "wf({Txxx}-P3): {摘要}"

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

产出 `P3-test-cases.md` + 测试代码（后端新用例 + 前端 e2e spec）。每条测试对应 P1 的 1 条 BDD（1:1 映射）。

## 设计已定（P2 选 C，勿改方案）

1. **后端** `backend/peekview/api/files.py`：新增 `_build_content_disposition(filename)` helper（紧邻 `_sanitize_filename`），`download_file` 用它构建 Content-Disposition：
   ```python
   def _build_content_disposition(filename: str) -> str:
       safe = _sanitize_filename(filename)
       if safe.isascii():
           return f'attachment; filename="{safe}"'
       fallback = "".join(c if ord(c) < 128 else "_" for c in safe)
       encoded = quote(safe, safe="")
       return f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{encoded}'
   ```
   - 需 `from urllib.parse import quote`（P2-review 观察）
2. **前端** `frontend-v3/src/api/client.ts` `getFileAsBase64`：URL `/entries/{slug}/files/{fileId}` → `/entries/{slug}/files/{fileId}/content`（1 行）
3. **不改**：`_sanitize_filename` 行为、`/content` 端点、`api.downloadFile`（死代码保留）、`useEntryDetailComputed.ts` blob 下载
4. **BDD-7**：按 test_security.py:604-608 现有断言范围（200 + 无 `\r`/`\n`），**不新增引号断言**（P1-review O1）

## 测试设计要点（test-designer 职责）

### 后端（P3 新增，BDD-4/5/6）

在 `backend/tests/test_api.py` 的 `TestFileDownload` 类追加：
- **中文文件名下载**（BDD-4/5）：POST 创建 entry + 中文文件名文件 → GET download → 200 + header 含 `filename*=UTF-8''` + `unquote` 后 == 原名 + 响应体与同文件 `/content` 一致
- **日文文件名下载**（BDD-4/5）：同上（`概要図.png`）
- **latin-1 café.png 下载**（BDD-6，P2-review 观察②）：200 + header 有效（filename* 形式）
- ASCII/空格文件名不回归（BDD-6）：现有 test_download_file 保持绿即可，可补显式断言

**P3 红灯要求**：这些测试当前必须**失败**（因为 `_build_content_disposition` 尚未实现）→ 真红灯（B 类：项目内 import 失败/assertion 失败）

### 前端 e2e（P3 新增，BDD-1/2/3/8）

新建 `frontend-v3/e2e/tpv0091-unicode-preview-download.spec.ts`（**注意命名用 tpv0091- 前缀避免与旧 t091- 混淆**，P2-review 观察③）：
- BDD-1/2：打开 `/unicode-filenames` → 点击文件树「中文图片.png」「概要図.png」→ 断言 `[data-testid="image-content"]` visible + `[data-testid="image-error"]` 缺席
- BDD-3：依次点击 café.png / report final.png / arch.png → 均正常显示
- BDD-5：`page.goto(download URL)` 触发下载 → `download.suggestedFilename()` == 原名
- BDD-8：markdown 内联 5 图正常（可复用 TPV0089 unicode-filename-link.spec.ts 模式）

e2e 当前必须红灯（后端 500 + 前端 URL 未改）。

## 约束

1. 产出 `P3-test-cases.md`（必须声明 `test_code_dir:`）+ 测试代码文件
2. 1:1 映射 BDD → 测试用例
3. 环境隔离：只读实现代码；**只写测试代码**（不实现 `_build_content_disposition` / 不改 client.ts）；debug :8888 可验证（勿停、勿碰 :8080）
4. 后端测试在 backend/.venv 跑（`cd backend && .venv/bin/python -m pytest tests/test_api.py::TestFileDownload -q --tb=short`）
5. 前端 e2e 不实际跑（P5 才跑），但代码必须可编译（可跑 `npx vue-tsc --noEmit` 对 e2e 目录验证语法，若有独立 tsconfig）
6. 每读一个输入文件追加 progress 到 `P3-progress.md`
7. 产出写 `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P3-test-cases.md`；测试代码写对应源码目录（backend/tests/、frontend-v3/e2e/）

## 输入文件

1. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P2-design.md`（设计 + 测试策略 §8 + 实现完成标志 §7）
2. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P1-requirements.md`（8 BDD）
3. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P1-review.md`（O1：BDD-7 断言范围）
4. `agate-workspace/tasks/TPV0091-unicode-download-header-fix/P2-review.md`（3 条观察：F841 safe_name / café 断言 / e2e 命名）
5. `backend/peekview/api/files.py`（_sanitize_filename / download_file / get_file_content）
6. `backend/tests/test_api.py`（TestFileDownload 现有模式：client fixture 匿名创建 entry + 下载断言）
7. `backend/tests/test_security.py`（573-645 净化断言范围）
8. `frontend-v3/src/api/client.ts`（getFileAsBase64 / getFileContent）
9. `frontend-v3/src/components/ImageViewer.vue`（image-content/image-error testid）
10. `frontend-v3/e2e/`（现有 spec 模式，如 unicode-filename-link.spec.ts）

## 返回

路径 + 一句话摘要（测试用例数、BDD 映射、test_code_dir）。
