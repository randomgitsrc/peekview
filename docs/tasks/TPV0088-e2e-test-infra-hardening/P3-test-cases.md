---
phase: P3
task_id: TPV0088-e2e-test-infra-hardening
type: test-cases
parent: P2-design.md
trace_id: TPV0088-P3-20260812
status: draft
created: 2026-08-12
agent: test-designer
---

# P3 — 测试用例设计：TPV0088 e2e-test-infra-hardening

[PROD_NOT_TOUCHED]

环境隔离声明：本阶段仅写测试设计与 shell 测试代码，未启动任何服务、未触碰生产 :8080 / `~/.peekview/`。红灯自检仅运行 `scripts/e2e-safety-check.sh --test-mtime`（当前未实现该模式，命中 Check 1 guard，于读取生产 DB 之前退出）与临时 fixture 断言，全程不读写生产数据。

## test_code_dir

`docs/tasks/TPV0088-e2e-test-infra-hardening/P3-test-code/`

- `test-mtime.sh` — 子任务 B 的 TDD 测试 harness（临时 fixture + env 注入，无需 debug backend）
- 运行方式：`bash docs/tasks/TPV0088-e2e-test-infra-hardening/P3-test-code/test-mtime.sh`

## 总体结构

| 子任务 | 范围 | P3 处理 | 当前状态 |
|--------|------|---------|----------|
| B | `scripts/e2e-safety-check.sh` Check 6 + `--test-mtime` | 真 TDD 红灯测试（TC-B1~B7） | **5 红 1 绿**（TC-B1/B2/B3/B4/B6 红，TC-B7 回归守卫绿） |
| A | `frontend-v3/e2e/viewer.spec.ts` 19 用例 | 修复清单（不写红灯测试，验收锚点 = BDD-1 的 P6 实跑 19/19） | — |

---

## 一、子任务 B：Check 6 static 新鲜度校验（BDD-6/7/8）

### 被测行为（P2-design.md §2.2.1 批准设计）

- 新增函数 `check_static_freshness`，置于脚本顶部、Check 1 之前；`--test-mtime` 自检块紧跟其后（绕过 E2E_GUARD 等既有检查）。
- `PV_SRC_DIR`（默认 `frontend-v3/src`）/ `PV_STATIC_INDEX`（默认 `backend/peekview/static/index.html`）env 注入路径。
- 逻辑：static 缺失 → `[ ! -f ]` 先判 → FATAL + 提示 `make build-frontend`；否则 `find "$src_dir" -type f -newer "$static_index"` 有输出即过期（输出前 5 个过期文件）→ FATAL + 提示 `make build-frontend`；无输出 → `✓ 静态产物新鲜`。
- 退出码：新鲜 0，过期/缺失 1。

### 测试用例（shell 级，P2 gate_commands.P3 运行对象）

> 命名规则：`test_bdd_N` 引用 BDD 编号；此处为 shell harness，用例名用 TC-B 编号 + BDD 引用标注。

#### TC-B1 (BDD-7)：新鲜 static 放行

- Given 临时 fixture：`static/index.html` 比 `src/` 下所有文件新（src touch 2026-01-01，static touch 2026-01-02），`PV_SRC_DIR`/`PV_STATIC_INDEX` 指向 fixture
- When `bash scripts/e2e-safety-check.sh --test-mtime`
- Then 退出码 0，输出含 `静态产物新鲜`
- 当前状态：**红**（未实现 `--test-mtime`，命中 Check 1 guard，exit 1）

#### TC-B2 (BDD-6)：过期 static 拦截

- Given 临时 fixture：`src/` 下文件比 `static/index.html` 新（static touch 2026-01-01，src touch 2026-01-02），env 指向 fixture
- When `bash scripts/e2e-safety-check.sh --test-mtime`
- Then 退出码 1，输出含 `FATAL` 与 `make build-frontend` 提示
- 当前状态：**红**（实际 exit 1 但输出为 Check 1 guard，无 FATAL/make build-frontend）

#### TC-B3 (BDD-6 边界)：static/index.html 缺失拦截

- Given 临时 fixture：`src/` 存在但 `static/index.html` 缺失（P2 §6 minimal_validation Case 3：不判 `[ -f ]` 时 `find -newer` 对不存在文件静默无输出会误放行）
- When `bash scripts/e2e-safety-check.sh --test-mtime`
- Then 退出码 1，输出含 `不存在` 与 `make build-frontend` 提示
- 当前状态：**红**

#### TC-B4 (BDD-6 强化)：过期拦截输出列出过期文件

- Given 同 TC-B2 的过期 fixture
- When `bash scripts/e2e-safety-check.sh --test-mtime`
- Then 退出码 1，输出含 `过期文件` 清单（head -5 前 5 个）
- 当前状态：**红**

#### TC-B5 (BDD-7/BDD-8)：自检模式绕过 Check 1 guard

- Given 未设置 `E2E_GUARD_ENABLED`（`make debug-test` 之外直接调用）
- When 以任意 fixture 运行 `--test-mtime`
- Then 输出**不得**含 `Check 1`/`必须通过 'make debug-test'`（自检块在 Check 1 之前；不依赖既有检查、不触碰生产 DB）
- 当前状态：**红**（作为 TC-B1/B2/B3/B4/B6 失败时的诊断线索在 harness 中体现）

#### TC-B6 (BDD-7)：PV_SRC_DIR / PV_STATIC_INDEX env 注入生效

- Given fresh fixture，经 env 指向绝对路径（模拟 Makefile debug-test Step 1 传 `$(CURDIR)` 绝对路径）
- When `bash scripts/e2e-safety-check.sh --test-mtime`
- Then 退出码 0（env 路径被用于比对而非默认相对路径）
- 当前状态：**红**

#### TC-B7 (IMPL-C1 回归守卫)：无 `--test-mtime` 时既有行为不变

- Given 无参数运行 `bash scripts/e2e-safety-check.sh`，未设 `E2E_GUARD_ENABLED`
- When 直接调用
- Then 退出码 1，输出含 `Check 1`（Check 1-5 保持原样，只追加不改）
- 当前状态：**绿**（回归守卫，防 P4 破坏既有检查；非 TDD 新行为）

### 红灯自检结果（2026-08-12 实测）

```
bash docs/tasks/TPV0088-e2e-test-infra-hardening/P3-test-code/test-mtime.sh
=== 结果: PASS=1 FAIL=5 ===
=== 红灯确认完成: 被测模块（Check 6 / --test-mtime）未实现，期望行为全部未满足 ===
HARNESS_EXIT=1
```

- 红（FAIL=5）：TC-B1、TC-B2、TC-B3、TC-B4、TC-B6
- 绿（PASS=1）：TC-B7（既有 Check 1 guard 回归守卫）
- 红灯原因统一诊断：`--test-mtime` 未实现、脚本落入 Check 1 guard → **B 类红灯（被测模块缺失，非测试代码 bug）**

### gate 命令（P2 固化）

```bash
bash scripts/e2e-safety-check.sh --test-mtime
```

当前实测 exit 1（命中 Check 1 guard）→ 红灯成立。P4 实现 Check 6 后该命令在仓库根目录应 exit 0（当前仓库真实状态 fresh，P2 §6 minimal_validation 第④点）。

---

## 二、子任务 A：viewer.spec.ts 19 用例修复清单（BDD-1~5）

> P1 已核实实际 19 条 `test()`：Code Viewer 5 + Markdown 4 + Responsive 4 + Theme 2 + File Ops 3 + Entry List 1。修复点对照 P2 §2.1（S1~S12 死选择器映射表）与当前 DOM grep 核实结果。验收锚点 = BDD-1 的 P6 实跑 19/19。

### 通用修复（BDD-2 / BDD-4）

- **BDD-2**：全文件 **17 处** `page.goto('/#/entry/{slug}')` → `page.goto('/{slug}')`（history 模式）；`page.goto('/')` 两处中 TC-031 保留 `/`、TC-050 改 `/explore`。
- **BDD-4**：slug 映射 `lu4prg` → `python-entry-service`（TC-004/005/030/042）、`ngajri` → `markdown-test`（TC-010/011/012/020/021/022/023/040）/`mermaid-charts`（TC-013）/`json-api-config`（TC-041，单文件）。已核实 seed-data 四个目录与 meta.json（is_public 均 true）。

### 逐用例修复清单

| # | 用例 | describe | 修复点（死→活） | 依据 |
|---|------|----------|-----------------|------|
| 1 | TC-001 | Code Viewer | goto hash→history（运行时 API 创建 `e2e-test-code` 已存在，保留）；`waitForShiki`/`getColoredTokens` 保留 | BDD-2；IMPL-D4 |
| 2 | TC-002 | Code Viewer | goto hash→history；`.code-body .line` 保留 | BDD-2 |
| 3 | TC-003 | Code Viewer | goto hash→history；桌面无 Wrap 按钮 → 移动端视口 375×812 + `[data-testid="mobile-bar-wrap-btn"]`（EntryDetailMobileBar.vue:35）；断言 `.code-body` `wrap-enabled` class 切换（CodeViewer.vue:16） | BDD-2/3；S7 |
| 4 | TC-004 | Code Viewer | goto → `/{python-entry-service}`；`button:has-text("Copy")` → `[aria-label="Copy"]`（EntryDetailHeader.vue:36）；clipboard 含 `def` 断言保留 | BDD-2/3/4；S6 |
| 5 | TC-005 | Code Viewer | goto → python-entry-service；`.code-header .filename` 死 → `.file-item .file-name` 含 `entry_service.py`（TreeNodeItem.vue:23）；`.code-header .lang` 断言删除（无 lang 头部元素）；`has-text("Copy")` → `[aria-label="Copy"]`；`.code-header button:has-text("Wrap")` 删除 | BDD-2/3/4；S1/S6 |
| 6 | TC-010 | Markdown | goto → `/{markdown-test}`；`.markdown-body h1,h2,h3` count>0 保留 | BDD-2/4 |
| 7 | TC-011 | Markdown | goto → markdown-test；`.toc-nav .toc-item` count>0 保留 | BDD-2/4 |
| 8 | TC-012 | Markdown | goto → markdown-test；`toHaveURL(/.*${href}$/)` 失败（TocNav `href="#id"` + `@click.prevent` 不改 URL）→ 点 `.toc-item a` 后 `expect.poll(() => page.locator('[data-testid="content-area"]').evaluate(el => el.scrollTop))` > 0（EntryDetailContent.vue:23，`.content-area` overflow-y:auto）；删除 `.toc-item.active` 辅助断言（无 scroll-spy，TocNav.vue:8 activeId 恒 null） | BDD-2/4；S11 |
| 9 | TC-013 | Markdown | goto → `/{mermaid-charts}`；`if (mermaidExists)` 条件式断言（假绿）→ 无条件断言 `.diagram-viewer svg` 可见（MermaidRenderer 渲染于 diagram-svg-container，无 `.mermaid` 类） | BDD-2/4；S12 |
| 10 | TC-020 | Responsive | goto → markdown-test；桌面 1280×800 `.file-sidebar`/`.toc-sidebar` visible 保留 | BDD-2/4 |
| 11 | TC-021 | Responsive | goto → markdown-test；`.mobile-actions` 死 → `[data-testid="mobile-bottom-bar"]`（EntryDetailMobileBar.vue:2） | BDD-2/3/4；S2 |
| 12 | TC-022 | Responsive | goto → markdown-test；`.mobile-actions .menu-btn` 死 → `[data-testid="mobile-bar-filetree-btn"]`（:7）；`.drawer-left`/`.drawer-overlay` 保留 | BDD-2/3/4；S3 |
| 13 | TC-023 | Responsive | goto → markdown-test；`.toc-btn` 死 → `[data-testid="mobile-bar-toc-btn"]`（:15）；`.drawer-right` visible 保留 | BDD-2/3/4；S4 |
| 14 | TC-030 | Theme | goto → `/{python-entry-service}`；`.list-header .btn-icon, .detail-header .btn-icon` 死 → `.detail-header .theme-toggle`（detail 页 header 内实例，ThemeToggle.vue:4）；data-theme 变化断言保留 | BDD-2/4；S5 |
| 15 | TC-031 | Theme | goto `/` 保留（landing）；`.list-header .btn-icon` 死 → `.theme-toggle`（LandingView.vue:21）；reload 持久化断言保留 | S5 |
| 16 | TC-040 | File Ops | goto → markdown-test（2 文件，`.file-item` nth(1) 存在）；nth(1) click + `toHaveClass(/active/)` 保留 | BDD-2/4 |
| 17 | TC-041 | File Ops | goto → `/{json-api-config}`（单文件 config.json，is_public/bob）；桌面 1280×800 断言 `.file-sidebar` count===0（isMultiFile=false 不渲染） | BDD-2/5；IMPL-D1/B3 |
| 18 | TC-042 | File Ops | goto → python-entry-service；`a[download]` 死断言（JS 动态建 a 后即移除，useEntryDetailComputed.ts:86-97）→ 点 `[data-testid="overflow-menu-trigger"]` → `getByText('Download', { exact: true })`（避免与 `Download as Pack` 子串歧义）→ `page.waitForEvent('download')` → 断言 `download.suggestedFilename()` 含 `entry_service.py` | BDD-2/4；S8 |
| 19 | TC-050 | Entry List | goto `/` → `/explore`（landing 不渲染 `.entry-card`，EntryListView.vue:130）；`toHaveURL(/\/entry\//)` → `toHaveURL(/\/([^/]+)$/)`（history 模式 URL 是 `/{slug}`，router.ts:38） | S9/S10 |

### BDD 覆盖对照

| BDD | 对应用例 | 覆盖方式 |
|-----|----------|----------|
| BDD-1 | 全部 19 | P6 实跑 `E2E_SPEC=e2e/viewer.spec.ts make debug-test`，19/19 PASS（非抽样） |
| BDD-2 | 全部 | grep 断言：无 `/#/entry/` 残留（修复清单 #1~19 的 goto 修复） |
| BDD-3 | #3/4/5/8/9/11/12/13/14/15/18 | S1~S12 死选择器替换表（上表"修复点"列） |
| BDD-4 | #4/5/6~13/16/17/18 | slug 映射表（lu4prg/ngajri → 现存 seed entry） |
| BDD-5 | #17 (TC-041) | `json-api-config` 单文件数据支撑（`.file-sidebar` count===0） |

---

## 三、P4 实现提示（测试如何驱动实现）

- `--test-mtime` 自检块**必须在 Check 1 之前**且**不要求 `E2E_GUARD_ENABLED`**，否则 TC-B5 红（harness 输出含 `Check 1` 即诊断此故障）。
- `check_static_freshness` 需在脚本顶部**先定义后调用**（bash 顺序），否则 TC-B1~B6 报 command not found。
- static 缺失先判 `[ -f ]`（TC-B3），`-type f` 必须保留（P2 §6：目录 mtime 假阳性）。
- 过期输出须同时含 `FATAL`、`make build-frontend`、`过期文件` 清单（TC-B2/B4）。
- Makefile debug-test Step 1 追加 `PV_SRC_DIR=$(CURDIR)/frontend-v3/src PV_STATIC_INDEX=$(CURDIR)/backend/peekview/static/index.html`（TC-B6 env 注入的落地）。
