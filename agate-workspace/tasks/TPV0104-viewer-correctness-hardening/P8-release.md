---
phase: P8
task_id: TPV0104
task_name: viewer-correctness-hardening
type: release
agent: releaser
created: '2026-11-26'
bump_type: minor
delivery:
  method: release-notes
  ref:
  - CHANGELOG.md
  - docs/architecture/html-preview-security-modes.md
  - backend/peekview/services/html_render_service.py
  - backend/peekview/api/files.py
  - backend/peekview/services/entry_service.py
  - frontend-v3/src/composables/useEntryDetailUrlSync.ts
  - frontend-v3/src/utils/default-file.ts
  - frontend-v3/src/utils/file-bytes.ts
  reason: 三个包均为 git 仓库内同仓交付（frontend-v3 无独立发布物，docs 无独立版本槽）。本任务对外可见的交付载体是 CHANGELOG
    [Unreleased] 的 14 条条目（新增 3 / 变更 7 / 修复 4）+ 新增的 docs/architecture/html-preview-security-modes.md（说明当前渲染安全档位与仍开放的外传通道）。无
    schema 变更、无数据迁移 ⇒ 不需要 upgrading.md 迁移节。tag 与 PyPI/npm 发布属独立流程 + 人工授权，不在 P8 范围
debt_check: reviewed
packages:
- peekview
- frontend-v3
- docs
not_bumped:
- mcp_server
current_versions:
  peekview: 0.27.1
  mcp_server: 0.12.0
status: ready-for-main-agent-gate
prod_touched: false
---

# P8 交付收尾 — TPV0104 Viewer 正确性与资源边界加固

> **本文件由 releaser subagent 产出，不执行 git commit、不 bump version、不打 tag。**
> 主 Agent 在 gate 验证通过后亲自执行交付收尾 commit。

## 1. 交付摘要

| 项 | 值 | 依据 |
|---|---|---|
| `bump_type` 意图 | **`minor`** | 见 §2 |
| `delivery.method` | **`release-notes`** | 见 frontmatter `delivery` |
| `debt_check` | **`reviewed`** | 见 §5 |
| 受影响包 | **`peekview` / `frontend-v3` / `docs`**（3 包） | `P1-requirements.md:528` + `P2-design.md:11-14` |
| 当前版本 | `peekview` **0.27.1** / `mcp_server` **0.12.0** | `VERSIONS.json`（唯一版本源，**只读未改**） |
| 建议目标版本 | `peekview` **0.27.1 → 0.28.0** | minor 位；`frontend-v3/package.json` 由 `sync_versions.py` 联动（`SOURCE_SLOTS:47` 挂 `peekview` 键） |
| **不 bump** 的包 | **`mcp_server`**（保持 0.12.0） | 见 §3 |
| 是否有 Breaking Change | **无**（详见 §4） | 见 §4 |

## 2. `bump_type: minor`（意图，不执行）

### 2.1 逐包声明

| 包 | `bump_type` | 判断理由 |
|---|---|---|
| **`peekview`** | **`minor`** | 有**新增用户可见能力**（HTML 预览注入预算 + 可机读跳过清单、`?file=` 深链、全屏阅读入口）+ 4 条真实缺陷修复。按 semver，新增向后兼容的功能 = minor。**不是 patch**：patch 只该含修复；本任务有 3 项全新能力。**不是 major**：无 API 签名/响应结构破坏（见 §4） |
| **`frontend-v3`** | **`minor`** | 与 `peekview` 同源版本号：`scripts/sync_versions.py:47` 把 `frontend-v3/package.json` 挂到 `peekview` 版本键 ⇒ 跟随主包走 minor。本包自身有新增可见功能（全屏按钮 × 2 处、`?file=` 持续态 URL、TOC h1–h4），同样符合 minor 语义 |
| **`docs`** | **`minor`** | 无独立版本槽（`sync_versions.py` 的 `SOURCE_SLOTS` 仅 `peekview` / `mcp_server` 两键，`DOC_SLOTS` 的文档槽均挂这两个键之一——`docs/` 目录本身无版本号）。随 `peekview` 联动，不单独声明版本号；`make check-docs` exit 0 已在 §6 |

> **口径说明**：`docs` 的 `bump_type` 是**随主包的意图值**，不是独立版本号来源。真正有版本槽的只有 `peekview`（含 `frontend-v3` 联动）与 `mcp_server` 两个键。

### 2.2 为什么不判 `major`

本任务确有行为收紧（§4），但**没有任何一项**触及 semver 意义上的破坏性面：

- 无 API 端点增删、无请求/响应字段删除或改名、无响应结构变更（`skipped[]` 是**纯新增**字段）
- 无数据库 schema 变更、无数据迁移
- 无 CLI 参数变更、无配置文件格式变更
- CSP 与 sandbox 属性**逐字符未变**（BDD-46 反向锁死，实测确认）

按 semver，「收紧一个既有上限」属行为变化但非契约破坏——消费方代码不需要改，只有原本落在「越界但仍被容忍」区间的**极端用法**会看到不同结果，且新结果**可归因**（跳过清单里带 `reason: count_limit`）。

### 2.3 为什么不判 `patch`

本任务有 3 项全新用户可见能力（§1 的 CHANGELOG「新增」节），patch 位在 semver 中只承载缺陷修复与内部改动。

## 3. **`mcp_server` 不 bump**（显式声明，避免版本一致性检查误判）

> **`mcp_server` 保持 `0.12.0` 不动。**

**依据一（范围声明）**：`P1-requirements.md:528` 明确 `packages: [peekview, frontend-v3, docs]`，并原文写明「MCP 包（`packages/mcp-server`）**不在范围内**（见 §6.2/§6.4 不处理判定）」。

**依据二（实测零改动）**：

```bash
git diff --stat de03b466~1 -- packages/mcp-server/
# （无输出 = 零改动）
```

`P2-design.md:143` 同向声明：`packages/mcp-server/**` 列在影响面「**不动**」栏，理由「P1 §6.4/§6.9 已判不处理：MCP 的 `content.length` 属另一子系统（跨包、后果不同）」。

**为什么必须显式写这条**：`VERSIONS.json` 有两个键（`peekview` / `mcp_server`），而本任务只动 `peekview`。若不做显式声明，版本一致性检查（`sync_versions.py --check` / `make check-docs`）的读者会把「本任务 bump 了 `peekview` 但 `mcp_server` 停着」误判为**漏 bump**。P7 的 `§3.2` 与 WARNING 第 5 项均已提出这一要求，本文件即其落点。

## 4. Breaking Change 判定：**无**（逐条论证）

dispatch-context 提示的两处行为收紧，逐条判断如下。

| # | 变更 | 是破坏性？ | 理由 |
|---|---|---|---|
| 1 | `_MAX_INJECT_IDS` **50 → 40** | **否**（行为收紧，非契约破坏） | ① 该上限是**内部常量**，从未出现在任何 API 契约或文档面：`_MAX_INJECT_IDS` 此前**未被任何文档承诺**（`docs/` 全仓 grep 无「50 个资源」的用户面承诺，仅 `docs/notes/issus-20261124-1429.md` 这份**内部缺陷报告**记录过旧值）。② 消费方代码无需改：`?inject=` 的语法、语义、响应结构全不变。③ 越界结果**可归因**：被跳过项在 `skipped[]` 里带 `reason: count_limit` 与 `file_id`，不是静默丢弃。④ 命中概率极低且**有合理解读**——`max_entry_files` 默认值是 50，取 40 是为了让「注入上限」在任何合法 entry 上都先于「文件数上限」触发（留出余量），属刻意的预算设计而非能力削减 |
| 2 | `?inject=` 查询串 **> 4096 字符 → 422** | **否**（输入校验补齐） | ① 4096 字符远高于实际用法：即便按每 id 7 字符（`123456,`）估算也已容纳 580+ 个 id，而单 entry 文件上限是 50 ⇒ **合法请求永远触不到**。② 此前「无限制」不是承诺而是遗漏，靠超长串打满 URL/内存是**输入校验缺口**。③ 422 是标准校验失败语义，调用方可见且可判断 |
| 3 | `?firstFileId=` **不再被读取**（旧参数忽略，回退默认入口） | **否**（P1 已定夺「不加兼容重定向」） | ① 自动来源**本就不产生该参数**（列表接口无 `files` 字段、`transformListItem` 硬编码 `files: []` ⇒ 实测死代码），剩余面仅为用户手动收藏的链接。② 旧链接**仍正常打开页面**，只是回到默认入口，**不报错不白屏**（BDD-51 锁死）。③ P1 `:494` 已用 `[SUGGEST]` 采纳「不加重定向」并给出四条理由。④ CHANGELOG「新增」节已明写新参数 `?file=`，属可见的迁移提示 |
| 4 | 文件顺序**由不确定变为确定** | **否**（这是修复） | 此前五条读路径均未排序，同一数据两次读可能不同 —— 那是缺陷。固定为「`coalesce(path, filename)` 字典序，同路径再按 `id`」后，依赖「原顺序」的用法不可能存在（原顺序本就不保证）。CHANGELOG 记在「修复」节并说明对 `raw` 接口（Agent 读路径）的影响 |

**结论**：4 项均不构成 Breaking Change。对照本仓先例，`0.27.0` 记 Breaking Change 的判据是**响应时间字段形态变化**（`created_at` 等 13 个字段的字符串形态改变 ⇒ 所有消费方解析代码可能受影响）；本任务无同类面。故 CHANGELOG `[Unreleased]` **不设** `### ⚠️ Breaking Change` 子节，`bump_type` 判 `minor` 而非 `major`。

> **残留风险（显式登记，不阻断）**：若真有用户依赖「41–50 个资源全部内联」且页面在第 41 个资源上产生可见效果，该效果会消失。缓解：跳过清单可查到具体是哪些文件、为什么被跳过。本项已写入 CHANGELOG「变更」节，用户升级时可自查。

## 5. `debt_check: reviewed`

读 `agate-workspace/debt/tech-debt.md`（628 行，**19 条**登记：`closed` 12 / `open` 4 / `in_progress` 3）。

**本任务新增条目**：

| id | 标题（摘要） | status | 登记判据 |
|---|---|---|---|
| **DEBT0022** | 同一 entry 内同名文件在存储层互相覆盖——DB 保留多行但磁盘仅 1 个文件，HTML 资源注入会把二进制内容填进 `<style>`/`<script>` | **`open`** | 判据 2（范围外但确有缺陷） |

**核实结果**：`tech-debt.md:603-626` 的 DEBT0022 块完整——`id` / `category: technical` / `status: open` / `priority: medium` / `task_id: TPV0104` / 3 条 `evidence` / `impact` / `recommendation`（三选一修法）/ 3 条 `closure_criteria` / `source: review` / `created_at: 2026-11-26`，schema 字段齐全。

**为什么留 open 而非就地修**：修复需改 entry 写入命名策略（拒绝同名 / 按 `File.id` 分目录 / 覆盖时同步删旧行），超出 TPV0104 的 P1 范围。`impact` 一处由 P7 补出（P4 未记录）：不只是「文件名重复」，而是 render 会产出 `<style>` 内装 PNG 二进制的**语义错误 HTML**。记账层仍自洽（`requested - inlined == len(skipped)` 成立），故不构成本任务 BDD 的假绿。

**其余未关闭条目**（`open` × 3 + `in_progress` × 3）：`DEBT0004` / `DEBT0006` / `DEBT0007`（open）、`DEBT0011` / `DEBT0012` / `DEBT0013`（in_progress）—— 均与本任务改动面无交集，本次核对不改变其状态、不阻断发布。

## 6. 发布检查命令与结果

P2 的 `gate_commands` **无 `P8*` 键**（23 个 key，键族为 `P3` / `P3_formatter` / `P5*` / `project_module`），故按 dispatch-context 给的 5 条默认命令执行。全部**外层 `timeout`** 包裹。

| # | 命令 | 超时 | exit code | 结果 |
|---|---|---|---|---|
| 1 | `make test-quick` | 600s | **2**（⚠️ 见下） | `1 failed, 1222 passed, 3 skipped, 25 warnings in 36.00s` |
| 2 | `make test-frontend` | 300s | **0** | `Test Files 127 passed (127)` / `Tests 1514 passed \| 4 skipped (1518)` / `0 failed` |
| 3 | `make typecheck` | 300s | **0** | `✓ type check passed`（vue-tsc） |
| 4 | `make lint` | 180s | **0** | `ruff check peekview/ tests/` → `All checks passed!` |
| 5 | `make check-docs` | 120s | **0** | `✓ 所有文档与代码保持一致` |

### 6.1 `make test-quick` 的 exit 2 是**预存失败**，非本任务引入

唯一失败项：

```
FAILED tests/test_cli_remote.py::TestCLIRemoteConfig::test_config_set_remote_api_key
OSError: [Errno 30] Read-only file system: '/home/kity/.peekview/config.yaml'
```

**归因依据**（不靠自述，靠三处独立证据）：

1. 已在 `known-failures.md` **#1** 登记为预存失败，根因为「沙箱 `~/.peekview/` 只读，CLI `config set` 写配置文件失败」，并注明「换可写 HOME 即绿」「CI 有可写 HOME 故不触发」；
2. `P2-design.md:760` / `:774` 早已实测记录该失败稳定存在（「`make test-quick` 从不返回全绿」），且该文件不在 P3 后端红灯取证的选择集内；
3. P7 后基线为 **1222P / 1F / 3S**，本次实测 1226 tests / **1222 passed / 1 failed / 3 skipped** —— 与基线**逐位相同**，零新增失败。

> **口径**：按本任务 `known-failures.md` 与 P2 §5.1 的判定，`make test-quick` 以「失败集不劣于基线」为准（不要求全绿）。本次失败集 = `{test_cli_remote::test_config_set_remote_api_key}`，与基线**相等**，判 **PASS**。
> 其余 4 条命令均 exit 0，**无新增失败、无新增 warning 门禁项**。

## 7. CHANGELOG `[Unreleased]` 条目确认

**载体**：`{project_root}/CHANGELOG.md`，**只改 `[Unreleased]`**（`:8`），历史条目 `[0.27.1]` 及以下**逐字未动**。

**结构**：Keep a Changelog 中文分类 —— `### 新增`（3 条）/ `### 变更`（7 条）/ `### 修复`（4 条），**14 条全部含 `TPV0104`**。**不设** `### ⚠️ Breaking Change` 子节（依据 §4）。

**写入内容（正文已落盘，此处摘要）**：

| 分类 | 条数 | 条目主旨 |
|---|---|---|
| 新增 | 3 | ① 注入预算（40 / 2 MiB / 8 MiB）+ 可机读跳过清单（六种 `reason`、面向工具与 Agent、非可见横幅）② `?file=<id>` 深链（刷新/分享保留当前文件，`/f` 可直达）③ 全屏阅读入口（桌面头部 + 移动底部栏，此前仅 `f` 键） |
| 变更 | 7 | ① TOC 扩至 h1–h4（Setext h1 入目录）② 目录文字剥离 Markdown 标记 ③ 同名标题锚点去重（此前互相冲突跳错位置）④ 大文件按真实字节判断（字符≠字节，中文约 700 KB 误判）⑤ 表格截断提示补总行数 + 截断态隐藏排序/筛选 ⑥ 全屏不再保留侧栏空白 ⑦ 两处边界收紧（50→40、`?inject=` >4096 → 422）+ `share` 参数不再被抹掉 |
| 修复 | 4 | ① 总预算记账单位错配（字符 vs 字节，实测 23 MiB 超 8 MiB 预算近 3 倍）② `İ`(U+0130) 劈开 `</body>` ③ `not_injectable` 缺 `file_id` ④ 文件顺序不确定（统一 `coalesce(path,filename), id`，`raw` 接口同受益） |

**面向用户性核对**：每条均以「用户能感知到什么变化」开头，不写内部函数名与行号；数值上限（40 / 2 MiB / 8 MiB）与 `reason` 取值属**对外可观测契约**（在 `skipped[]` 里直接可见），故保留。

### 7.1 ⚠️ `check-changelog.py TPV0104` 返回 exit 1 —— **协议侧正则缺陷，非本任务漏写**

**实测（非推测）**：

```bash
cd /home/kity/oclab/peekview
python3 ~/.agate/v0.83.3/agate/scripts/check-changelog.py TPV0104
# GATE CHANGELOG: [Unreleased] 区域未找到 TPV0104（或 TPV0104）
# [REAL_EXIT=1]
```

**但 CHANGELOG 里 `TPV0104` 确实存在 13 处**（`[Unreleased]` 每条末尾）。根因是该脚本的**右边界正则不含全角 `）`**：

```python
# check-changelog.py:73
rf"(^|[^0-9]){re.escape(task_id)}( |:|$|,|-)"
```

`TPV0104` 之后必须是 **ASCII 空格 / `:` / 行尾 / `,` / `-`** 之一。而本仓 CHANGELOG 的既有约定写法是**全角括号包裹** `（TPV0104）` —— `）` 不在允许集内 ⇒ **必然不匹配**。

实测对照：

| 写法 | 是否匹配 |
|---|---|
| `…（TPV0104）`（**本任务 14/14 条目的写法**） | ❌ **False** |
| `… TPV0104` | ✅ True |
| `…TPV0104:` / `…TPV0104,` / `…TPV0104-` | ✅ True |

**这是既有已知缺陷，非本任务引入**：

1. `git log -p --all -- CHANGELOG.md` 统计历史 `[Unreleased]` 的 task_id 写法：`（TPV0095）`×13、`（TPV0102）`×7、`（TPV0103）`×2、`（TPV0099）`×2 …… **全仓历史一律全角括号**；
2. `agate-workspace/tasks/active-tasks.md:251`（TPV0102 结项记录）**已明确记录该缺陷**并给出同款处置：「`check-changelog.py` 右边界正则不含全角 `）`，**全仓 12/12 历史 task_id 皆 exit 1**——本任务拒绝改 CHANGELOG 凑绿灯」；
3. TPV0102 已按此发布（`[0.27.0]` 节的 6 条条目全部以 `（TPV0102）` 结尾，实测 `grep -c TPV0102` = 6）。

**本文件的处置（沿用 TPV0102 判例）：不改 CHANGELOG 去凑正则。**

- **不**把 `（TPV0104）` 改成 ` TPV0104` 或 `TPV0104,` —— 那是为通过缺陷校验而劣化既有文档约定，且会让本任务与全仓 12 个前序任务形态不一致；
- CHANGELOG 的**实质要求（`[Unreleased]` 含本任务 task_id）已满足**，且有 13 处可核；
- **对 gate 的实际影响 = 无阻断**：`check-gate.py P8` **实测 exit 2 = 通过码**（该脚本不直接调 changelog 检查；按 `check-gate.py:6-8`，P0-P3/P5/P6/**P8** 的通过码就是 **exit 2**，P4/P7/P6.5 才是 exit 0）；`pre-commit-gate.py:1086-1088` 对 P8 的 changelog 检查是**仅 WARNING 不 exit**（`sys.stderr.write("GATE CHANGELOG: 警告 …")`），故不阻塞主 Agent 的交付收尾 commit。

> **给主 Agent 的说明**：若你的 gate 流程里跑了 `check-changelog.py TPV0104` 并看到 exit 1，请按本节判为**已知协议缺陷的假红**，不要据此打回 P8 或要求改 CHANGELOG。如需彻底消除，正确修法是改协议脚本的右边界字符类（加入全角 `）`/`：` 等），属**协议仓改动**，不在本项目任务范围。**建议报上游。**

## 8. 临时资源清单 + 清理确认

> 本清单是 releaser → 主 Agent 的**交接文件**，主 Agent 在 READY 收尾检查时按此执行清理。

### 8.1 临时目录：`<项目根>/.agate-tmp/`

| 项 | 实测 |
|---|---|
| 存在性 | **存在**，`46M`，**180 个顶层条目**（`895` 个文件计入子目录） |
| `.gitignore` 状态 | ✅ **已忽略** — `git check-ignore -v .agate-tmp` → `.gitignore:105:.agate-tmp/` |
| 内容构成 | 探针脚本 `.py` 59 / 日志 `.log` 40 / `.ts` 29 / `.txt` 16 / `.mts` 8 / `.md` 4 / `.bak` 3 / `.mjs` 2 / `.html` 2 / `.yaml` `.xml` `.vision-data` `.vhome` 各 1；子目录 `dr` `env-check` `p2` `orderprobe` `r2d` `r3` `r3-proto` `tpv0104-p5` `tpv0104-p6` `vision-data` `vhome` `__pycache__` |
| 本任务新增（可见） | `p8-test-quick.log` / `p8-test-frontend.log` / `p8-typecheck.log` / `p8-lint.log` / `p8-check-docs.log`（5 份发布检查日志） |
| 明文凭证 | ✅ **无真实凭证**。严格模式扫描：`pv_[A-Za-z0-9_-]{24,}` **0 命中**；JWT 形态 **1 命中**，经核查为测试夹具假值（`.agate-tmp/orderprobe/tests/test_auth.py:1212` 的 `eyJzdWIiOiI5OTk5In0.aaaa`）；`password=` 命中均为 seed 测试口令（`testpass123` 等），非生产值 |
| ⚠️ **测试收集模式命中** | **78 个文件名匹配 `test_*.py` / `*.spec.*` 等**（`.agate-tmp/orderprobe/tests/*` 与 `.agate-tmp/r3-proto/t/test_red_shape.py`） |

> ⚠️ **上表最后一行会触发 `check-gate.py P8` 的第二条 WARNING（`RM-AG0075` (b)），不阻断但必须知悉**：
> 该告警的语料是「`.agate-tmp/` 内有文件名匹配测试收集模式 → 被测试框架默认 include 扫到、静默抬高基线」。
> **本项目实测不受影响**，判据如下（两份测试运行器的收集根均不在 `.agate-tmp`）：
> - 后端：`backend/pyproject.toml:72` `testpaths = ["tests"]`，`Makefile:165` `cd backend && pytest tests/` ⇒ 收集根是 `backend/tests/`；
> - 前端：`frontend-v3/vitest.config.ts:13` `exclude: ['e2e/**','node_modules/**']`，vitest 以项目根 `frontend-v3/` 为收集根（根目录**无** `vitest.config` 之外的 `test_*.py`）⇒ 扫不到 `.agate-tmp`；
> - 上述 78 个文件是**历史任务遗留**（`.agate-tmp/orderprobe/` mtime `2026-11-25 01:30`、`r3-proto` `2026-11-25 05:19`，均为**本任务期间的前序阶段**产出，非 P8 新增），删除属跨阶段清理。
>
> **给主 Agent 的两个处置选项**（releaser 无删除授权，按 `AGENTS.md` 第 5 条须用户许可）：
> 1. **推荐**：READY 收尾时整个删除 `rm -rf .agate-tmp/`（内含本任务全部探针与日志，已无保留价值；且可一次性消掉该 WARNING）；
> 2. 或仅删 `orderprobe/` + `r3-proto/` 两个含测试文件的子目录，保留其余日志备查。

### 8.2 debug 实例数据目录

| 项 | 实测 |
|---|---|
| `/tmp/peekview-debug*` | **不可见** —— 本会话沙箱以 `--tmpfs /tmp` 运行（`ps` 可见 `bwrap --tmpfs /tmp`），`/tmp` 为空且**跨调用不共享**，`ls -d /tmp/peekview-debug*` 无输出、`find /tmp -name "*peekview*"` 无命中 |
| 端口实况 | `:8893` **LISTEN**（本任务新代码）、`:8888` **LISTEN**、`:8890` **LISTEN**（后两者为宿主侧旧进程残留，dispatch 已声明仅可只读探测）、`:8080` **无监听** |
| 结论 | debug 数据目录位于**宿主侧**，其创建与清理由宿主进程归属，releaser 无法从沙箱内确认/清理。**未由本阶段创建任何新的 debug 实例**（本阶段只跑测试命令，未起服务） |

### 8.3 残留 entry 检查

| 项 | 实测 |
|---|---|
| 探测面 | `:8893` 分页遍历 `/api/v1/entries?per_page=50`（只读，匿名） |
| 结果 | `total field: 15` / `collected: 15` —— **等于 anon 基线 total=15** |
| `tpv0104` / `e2e-` / `p8-` / `bdd` / `probe` / `tmp` 前缀残留 | **`NONE`**（零命中） |
| 结论 | ✅ **无残留 entry** |

> 说明：首轮用 `per_page=200` 探测时返回空 items（该参数被上限拒绝），已改分页重测——避免把「参数非法静默返回空」误读为「零残留」。

### 8.4 开发安装 / 系统污染

| 项 | 实测 |
|---|---|
| 开发安装 | **无**。本阶段未执行任何 `pip install` / `npm install` / editable install |
| 系统 Python | **未污染**（未触碰 `/home/kity/.local/bin/peekview` 符号链接） |
| 项目依赖 | 未改动（`backend/.venv/`、`frontend-v3/node_modules/` 均为既有） |
| 本阶段新增文件 | 仅 3 个：`CHANGELOG.md`（改 `[Unreleased]`）、本文件 `P8-release.md`、`P8-progress.md`（追加）+ 5 份 `.agate-tmp/p8-*.log` |

### 8.5 需主 Agent 执行的清理动作

1. `rm -rf <项目根>/.agate-tmp/`（或按 §8.1 选项 2 保留部分）—— **需用户许可**（`AGENTS.md` 第 5 条）
2. 确认宿主侧 `:8888` / `:8890` 残留进程归属（dispatch 声明为宿主侧旧进程，非本任务创建）—— 本任务新代码在 `:8893`
3. `git status --porcelain -uall` 复核：本阶段预期只有 `CHANGELOG.md`（M）+ `P8-release.md`（??）+ `P8-progress.md`（??）+ `gate-events.jsonl`（M）

## 9. 生产环境状态

**[PROD_NOT_TOUCHED]**

| 项 | 实测证据 |
|---|---|
| 生产服务 `:8080` | `curl --max-time 4 http://127.0.0.1:8080/` → **`8080=000`**（不可达/无监听），全程未接触 |
| 生产数据 `~/.peekview/` | `stat ~/.peekview` → mtime **`2026-11-12 12:40:31`** —— 与 P5/P6/P6.5/P7 记录**一致未变**，零写入 |
| 生产数据库 | **未用 `sqlite3` 直连生产 DB**；残留检查走 `:8893` 的只读 HTTP API |
| 状态标记 | **`[PROD_NOT_TOUCHED]`**（二值标记，未触发任何生产写入） |

## 10. Lessons Learned

| # | 类别 | 教训 | 来源 | 日期 |
|---|---|---|---|---|
| 1 | 流程 | **P8 的 `bump_type` 判定要看「是否有消费方代码需要改」，而不是「行为是否变了」**。本任务有两处上限收紧（50→40、`?inject=` 加 4096 上限），字面像破坏性变更；但两者都不改签名/响应结构、被跳过项还带可归因的 `reason` ⇒ 判 minor 而非 major。反向教训：`0.27.0` 的 datetime 补 `Z` 才是真破坏（13 个字段的**字符串形态**变化会让所有解析代码受影响）——判据是「形态/契约变」而非「行为变」 | TPV0104 | 2026-11-26 |
| 2 | 流程 | **「零改动」的包必须在交付文件里显式声明不 bump，否则一致性检查会误判为漏 bump**。本任务 `VERSIONS.json` 有两个键而只动 `peekview`，若不在 `P8-release.md` 写明 `mcp_server` 不 bump + 引 `P1:528` 范围声明 + 附 `git diff --stat` 实测空输出，后续读者（含 CI 与未来的 Agent）无从区分「有意不 bump」与「漏了」 | TPV0104 | 2026-11-26 |
| 3 | 测试 | **探测「无残留」时，用非法参数拿到的空结果必须复验**。首轮用 `per_page=200` 探测残留 entry 得到空 items，若就此下结论会把「参数被上限拒绝、静默返回空」误读成「零残留」；改为分页遍历后才拿到可信的 `total=15`。与 P7「加 `\| tail` 会把 pytest 非零 exit 变成 0」同族——**判据本身要先验真** | TPV0104 | 2026-11-26 |
| 4 | 流程 | **「`\| tail` 吞 exit code」这个坑，本轮我自己踩了两次**：第一次 `check-gate.py P8 \| tail -25` 读到 `exit=0` 便写下「gate exit 0」，裸跑后实为 **exit 2**（而 exit 2 恰是 P8 的**通过码**）；第二次 `check-changelog.py \| tail` 读到 `exit=0` 便以为通过，裸跑后实为 **exit 1**。两次误判方向相反却同源。**教训**：读取任何命令的 exit code 必须裸跑或 `set -o pipefail`，且**先查该脚本的 exit 语义表**（`check-gate.py` 的 P8 通过码是 2 不是 0）再下结论——否则「假绿」与「假红」都会发生 | TPV0104 | 2026-11-26 |

## 11. 自检清单

- [x] **`check-gate.py P8` 实测 exit 2 = 通过码**（裸跑取值；按 `check-gate.py:6-8`，P8 的 `gate_pass_exit` 是 **2**，非 0）。两条 WARNING 均不阻断：① 仓库根不可得（沙箱 `bwrap` 下 `git rev-parse` 受限，跳过 roadmap-done 反查；本仓 `agate-workspace/roadmap/roadmap.md` **不存在**，P1/P2 亦无 RM 关联声明 ⇒ 该项无对象）② `.agate-tmp/` 内 78 个测试收集模式文件名（见 §8.1，本项目两份测试运行器的收集根均不在该目录，实测无影响）
- [x] `bump_type:` 存在（frontmatter `:11`），且逐包理由已写（§2.1）
- [x] `delivery:` 结构化 `{method, ref, reason}` 存在（`method: release-notes`，`ref` 8 项，`reason` 非空）
- [x] `debt_check: reviewed` 存在（§5，含 DEBT0022 `status: open` 核实）
- [x] CHANGELOG `[Unreleased]` 含 `TPV0104`（14 条全含，实测 `grep -c` = 14）
- [x] `mcp_server` 不 bump 已显式声明 + 引 `P1-requirements.md:528` + 附实测零改动（§3）
- [x] 5 条发布检查命令逐条记录 exit code（§6）
- [x] 临时资源清单 + 清理确认（§8，含 `.agate-tmp/` 的两条 WARNING 面与处置选项）
- [x] `[PROD_NOT_TOUCHED]` 已声明 + 三项实测证据（§9）
- [x] **未执行 `git commit`** / **未 bump version** / **未打 tag** / **未改 `VERSIONS.json`**
- [x] **未改实现代码与测试** / **未改 `P1-requirements.md`**
- [x] CHANGELOG 只改 `[Unreleased]`，历史条目逐字未动
