# P3-dispatch-context-test-designer — TPV0099

---
phase: P3
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0099
role: test-designer
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

> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）。

## 目标

为「全屏模式链接 `/{slug}/f`」产出 TDD 测试设计：`P3-test-cases.md` + 测试代码。

任务一句话：**分享场景下，接收者打开 `https://host/{slug}/f` 直接进入锁定的纯内容视图（只剩主体内容），且无任何页内出口**。

## 输入文件（必读，按序）

1. **`P2-design.md`（735 行，主要输入）** —— 特别注意：
   - **§1.1 的 M1~M9 改动清单**（落点已到文件+行号）
   - **`:60-77`「锁死态接口最终规格」四面板表 + 三个禁止变体** ← **实现的唯一权威**
   - **§6.1 E2E 键 → spec → BDD 覆盖映射**（P3 据此写用例，事后不得改）
   - §6.4 BDD-3 排除集**不可简化**、§6.5 验证执行约束（**BDD-1/2/3 须钉定非归档 seed**）
2. **`P1-requirements.md`（19 条 BDD 基线）** —— 每条 `#### BDD-NN` 对应一条测试用例（1:1 映射）
3. `P2-review.md`（组长汇总）+ `P2-review-design.md` / `P2-review-eng.md`（两份评审，含非阻塞项）
4. 参考代码：`frontend-v3/src/composables/useZenMode.ts`（36 行）、`frontend-v3/src/views/EntryDetailView.vue`、`frontend-v3/src/router.ts`、`frontend-v3/src/styles/layout.css`（`:208` + `:649-654`）
5. E2E 编写规范：`frontend-v3/playwright.config.ts` + `frontend-v3/e2e/t058-share-redesign.e2e.spec.ts`（share 认证链路范式）+ 任一近期 spec

## 产出规格（P3 卡强制）

- `P3-test-cases.md` 必须声明 **`test_code_dir`**（本项目先例：`TPV0096` 用 `test_code_dir: frontend-v3/e2e`；本任务测试跨两处，**请分别声明**，如 `test_code_dir: frontend-v3/e2e + frontend-v3/src/composables/__tests__`）
- 每条测试用例对应一条 `#### BDD-NN`（**1:1 映射，19 条全覆盖**）
- **UI 任务（`ui_affected: true`）→ 必须含 Playwright/E2E 用例**

## 本任务的测试分层（P2 已固化，照此写）

| 层 | 文件 | 覆盖 |
|---|---|---|
| 单测（vitest） | `frontend-v3/src/composables/__tests__/useZenMode.spec.ts`（**新建**，M9） | 锁死态按键不改状态 + 公告文本词表 + 非锁死态行为不变 + **「锁定态派生随 route meta 翻转」** |
| E2E（匿名） | `frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts`（**新建**） | BDD-1/2/3/4/5/6/7/8/11/12/13/14/16/17/18/19（16 条） |
| E2E（需 alice 登录/自建） | `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts`（**新建**） | BDD-9/10/15（3 条） |

**切分轴 = 认证前提**（P1 实测的客观可达性分界，非按技术层切）。

---

## ⚠️ 四条硬约束（P2 评审沉淀，**必须遵守，否则 P5 会误红或假绿**）

### 硬约束 1：M9 翻转用例**必须用 reactive 源**（eng-review NB-1，本轮最高价值项）

M9 的「锁定态派生随 route meta 翻转」用例，**必须让 thunk 读一个 reactive 源**（推荐 `reactive`/`ref` 模拟 `route.meta`）。

**为什么**：eng-review 实测——若用**非响应式局部变量**驱动，**正确实现也会返回 `[false,false,false]`**（computed 只在依赖变化时重算，非响应式变量不触发）→ **会误红正确实现**。

正确形态（P2 已实测通过）：thunk 读 reactive 源时，正确实现返回 `[false,true,false]`；而"签名是 thunk 但内部 setup 期一次性快照"的**禁止变体**返回 `[true,true,true]`（或 `[false,false,false]`，视构造）→ **判据有区分力**。

→ **写用例时请显式注释这一点**，否则后续维护者极易踩中（"令其返回 false→true→false"字面看很自然，实际必须靠 reactive 源驱动）。

### 硬约束 2：实现形态以 **§1.1 最终规格表 + `:47` M3 为唯一权威**

- 签名 `useZenMode(locked: () => boolean = () => false)`；调用点 `useZenMode(() => route.meta?.zen === 'locked')`；内部一律 `locked()`；返回对象**无 `updateZenAria`**
- **`route.meta` 访问必须带 `?.` 可选链**（P2 已二选一定案）
- 测试用例的断言**不得**依赖 `updateZenAria`（已移除）
- ⚠️ `:610` 的散文用 `route.meta.zen`（无 `?.`）是**行为描述、非实现规格**，不要据此写断言
- ⚠️ `:98`(N13) 的"既有 DEBT"指 **TPV0097/TPV0098**（非 DEBT0012）
- ⚠️ `:97`(N14) 引用的 300 行上限 spec 路径应为 **`frontend-v3/src/components/t082-error-format.spec.ts`**（实际无 `__tests__/` 层）

### 硬约束 3：E2E 用例必须**有区分力**，禁止恒真断言

本任务 P1 已两次出现"判据看似正确实则失效"（BDD-3 恒假 → 修完恒真 → 再修才闭环），P2 又发现**第三种不报错的假绿读法**。故：

- **BDD-10**：三结果必须**互不相同**——带真实 `?share=<token>` **可见正文**；**无 token** 与**伪 token** 均**不可见**。若三者相同则该用例退化为恒真假绿
- **BDD-3**：A/B 两组排除规则**不可简化**为"排除容器链"（已实测会退化成恒真）。A 组（`html`/`body`/`#app`/`.entry-detail`）取"自身+全部祖先，**不含后代**"；B 组（内容流容器链）取"自身+全部后代"。**写成可复现的脚本化遍历**
- 凡断言"某集合为空/某元素不存在"者，**须同时给出一条能证明判据有效的负向对照**（或至少在 P3 文档中说明该断言为何不恒真）

### 硬约束 4：BDD-1/2/3 的 E2E **必须钉定非归档、非过期 seed**

**用 `dsh-architecture`**（与 P1 rev2 自证一致，匿名 200）。

**理由（须写进 spec 注释防后人误改）**：BDD-3 的 Given 是 **entry 无关**的（只规定"桌面视口 1280×800，全屏视图已加载完成"，未指定 slug）。若挑到 archived/expired entry（如 `legacy-deploy`），BDD-3 会在一个**与本任务无关的既有条件**（`.archived-banner` 不在 zen 隐藏集 → 满宽横条）上判 FAIL，被误读成"本任务实现错了"。**禁止**用 `legacy-deploy` 或任何 `status: archived`/已过期 entry 跑 BDD-1/2/3。

---

## seed 可达性清单（P1 已逐条实测，直接用）

| BDD | seed | 可达性 |
|---|---|---|
| BDD-1/3/13 | `dsh-architecture` | 匿名 200 |
| BDD-7 | `tsv-server-metrics` | 匿名 200（表格 60 行） |
| BDD-8 | `unicode-filenames` | 匿名 200（zen 下正文有可点 `a[data-peekview-file-id]`） |
| BDD-17 | `svg-icons` | 匿名 200（独立 SVG 走 ImageViewer，**无 fullscreen 按钮**） |
| BDD-9 | `markdown-test` + `?firstFileId=43` | **需 alice 登录**（`is_public:true` 但带 `team_id` → 匿名 404） |
| BDD-15 | `mermaid-charts` | **需 alice 登录** |
| BDD-10 | **自建** | **alice 登录建私有 → alice 建 share → 匿名带 token 读**；清理 = alice 删除后复查 `raw`=404 |

⚠️ **不要依赖 `/entries` 总数做断言**：计数随 E2E 自建残留漂移（全新 seed 后 alice 22/匿名 15；跑过 E2E 后可达 alice 26/匿名 19）。**按 slug 精确断言**。

## 双视口（P2 已实测，P3 须显式钉定）

**双 project 默认视口 = 1280×720 / 393×727，两个都不是 BDD 要求的档位** → 请按 `tpv0091` 范式**显式 `test.use({ viewport })`** 钉定：
- 桌面 **1280×800**（BDD-1/2/3）
- 移动 **390×844**（BDD-14）

## 环境与纪律（强制）

- debug backend `http://127.0.0.1:8888` **已运行**。**开工前先探** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health`（本任务该服务已掉线 3 次，一律先探再用）
- **严禁**触碰生产 `:8080` 与 `~/.peekview/`；**严禁** `uvicorn` 直接启动、**严禁** `make debug`/`npm run dev`（vite :5173 代理到生产）。返回时标注 `[PROD_NOT_TOUCHED]`
- **探针/临时文件严禁放 `frontend-v3/` 下**（本轮评审期该处残留曾把 vitest 基线从 110 抬到 115 —— `vitest.config.ts` **未设 `include`**，走默认收集面会把 `**/*.spec.ts` 全部收进来）。临时产物落 `/home/kity/oclab/peekview/.agate-tmp/`
- **任何 bash 命令设 `timeout 180s <cmd>`**（E2E 类 600s+）
- Playwright 用全局包：`require('/home/kity/.nvm/versions/node/v24.15.0/lib/node_modules/playwright')`；脚本须 `try/finally { page.close() }` + `process.exit(0)`，**不要** `browser.close()`
- 前端基线：`110 files / 1343 passed | 4 skipped (1347)`（`DiagramBlock.spec.ts` 有一条**已知 flaky**，隔离复跑确认即可）
- 子派发能力：不启用
- **分阶段落盘**：每完成一步**立即追加**一行到 `P3-progress.md`

## 门槛（什么算完成）

- `P3-test-cases.md` 存在且含 `test_code_dir` 声明
- 19 条 BDD **1:1 映射全覆盖**（无缺号、无重号）
- 测试代码目录存在；UI 任务含 Playwright/E2E 用例
- **测试须为真红灯**（实现未写 → 断言失败；`check-tdd-red.py` 将判 exit 0）——**不得**因语法错/import 错而红（那是 A 类假红灯）
- 四条硬约束逐条落实并在 `P3-test-cases.md` 中显式说明

## 返回给我（只两行）

1. 产出文件路径（`P3-test-cases.md` + 测试代码目录）
2. 一句话摘要（≤30 字，含用例数 + 覆盖 BDD 数）

**不要返回文件全文。**

## 客观查证信息（objective_info）

- 环境：debug `http://127.0.0.1:8888`（v0.24.1），Chrome CDP `:18800` 在线
- `P2-design.md` 735 行，`check-frontmatter` exit 0，`check-gate P2` exit 2（已通过）
- **`P3: "make test-frontend"` + `P3_formatter: "vitest.sh"`**（已固化，P3 红灯由 `check-tdd-red.py` 用该 formatter 解析 vitest 输出）
- 关键选择器：`[data-testid="content-area"]`（几何断言主对象，**稳定**）、`[data-testid="mobile-bottom-bar"]`、`.entry-detail`（zen 类挂载点）、`.entry-detail.zen-mode`、`.not-found`（计数须 0）、`.error-state`、`.toc-sidebar`、`.per-page-trigger`/`.per-page-listbox`（BDD-7）、`.sr-only[aria-live]`（BDD-6）、`a[data-peekview-file-id]`（BDD-8）
- P2 §6.1 的 E2E 键 → spec → BDD 映射**已固化，事后不得改**

> 本文件不含通过/失败预判。
