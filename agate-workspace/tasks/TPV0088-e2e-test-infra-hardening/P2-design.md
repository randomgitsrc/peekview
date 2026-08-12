---
phase: P2
task_id: TPV0088-e2e-test-infra-hardening
type: design
parent: P1-requirements.md
trace_id: TPV0088-P2-20260812
status: draft
created: 2026-08-12
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 1
packages: [frontend-v3, makefile, scripts]
domains: [test-infra, frontend]
ui_affected: false
---

# P2 — 方案设计：E2E 测试基础设施加固（TPV0088）

## 0. 方案选择声明

- `candidate_count: 1`
- `follows_existing_pattern: [frontend-v3/e2e/viewer.spec.ts, scripts/e2e-safety-check.sh, Makefile]`
- 理由：本任务是对**既有测试资产**的修复，非新功能。子任务 A 是"修现有 spec 文件"——模式即 spec 内既有 `waitForShiki`/`getColoredTokens` helper + seed 数据引用 + `page.goto` 导航，不引入新的测试架构；子任务 B 是"往既有 shell 检查脚本加一段逻辑"——模式即脚本既有 Check 1-5 的 `echo "→ Check N"` + `exit 1` 结构。两者均无方案取舍空间（是否新增独立测试文件、是否改 Makefile 逻辑 vs 脚本逻辑，均被 P1 IMPL-C1/IMPL-B2 与 P0 审计锁定）。

## 1. 影响域分析

### 改什么

| 文件 | 改动 | 子任务 |
|------|------|--------|
| `frontend-v3/e2e/viewer.spec.ts` | 路由格式 + slug 映射 + 12 项死选择器/过时断言修复（见 §2.1） | A |
| `scripts/e2e-safety-check.sh` | 新增 Check 6（static 产物新鲜度校验）+ `--test-mtime` 自检模式（见 §2.2） | B |
| `Makefile:633-640`（`debug-test` Step 1） | 向 e2e-safety-check.sh 传递 `PV_SRC_DIR`/`PV_STATIC_INDEX` 绝对路径（基于 `$(CURDIR)`），保证 Check 6 不受调用目录影响 | B |
| `CHANGELOG.md` | `[Unreleased]` 记录（P8 阶段，遵循铁律 8） | 两者 |

### 不改什么（降低风险的明确边界）

- **不改后端业务代码**：`backend/peekview/` 下无任何改动（P1 范围声明）。
- **不改 MCP/CLI/API 行为**：IMPL-M1。
- **不改 e2e-safety-check.sh 既有 Check 1-5 逻辑**：IMPL-C1，只追加 Check 6。
- **不改 `make debug` / `make debug-quick` / `make debug-build` 的主流程顺序**：IMPL-C3，build→start→test 顺序天然满足 mtime 放行条件。
- **不改生产 :8080 服务与 `~/.peekview/`**：铁律 1/2/5。
- **不改 `frontend-v3/dist/` 作为比对基准**：IMPL-B2 明确只比 `frontend-v3/src/` vs `backend/peekview/static/index.html`。

### 风险在哪

| 风险 | 级别 | 缓解 |
|------|------|------|
| 测试修复无现成覆盖兜底，选择器/断言改错产生假绿 | medium | P1 BDD-3 白黑清单 + 本方案 §2.1 逐条给出"死→活"替换目标；P6 逐条实跑非抽样 |
| `.theme-toggle` 在 detail 页与 landing 页均有实例，选择器可能误匹配 | medium | TC-030 用 `.detail-header .theme-toggle`（桌面 header 内实例），TC-031 用 landing 页 `.theme-toggle`——两者页面不同，无歧义 |
| mermaid 断言目标 `.mermaid` 类在当前渲染器已不存在（实际为 `.diagram-viewer`/`.diagram-svg-container` 内 SVG） | medium | 本方案 IMPL-S12 改为断言 `.diagram-viewer svg` 可见（已对照 DiagramBlock.vue / MermaidRenderer.vue 核实） |
| Check 6 对"目录 mtime"产生假阳性（无 `-type f` 时 src 目录本身可能被 `-newer` 匹配） | medium | minimal_validation 实测发现，方案统一加 `-type f` 只比文件；且 static 缺失时 find 静默无输出→须先判 `[ -f ]` |
| `make debug-test` 从非仓库根目录调用导致相对路径失效 | low | Makefile Step 1 传 `$(CURDIR)` 绝对路径 |
| 更新后 mtime 精度问题（同秒操作 touch 与 build） | low | BDD-8 实测 `make debug-quick → debug-test` 全链路；find `-newer` 以秒级 mtime 为准，build 产物必然晚于 src 编辑（编辑→build 间隔>1s） |

## 2. 方案设计

### 2.1 子任务 A：viewer.spec.ts 修复

#### 2.1.1 路由格式（BDD-2）

`page.goto('/#/entry/{slug}')` → `page.goto('/{slug}')`。全文件共 **17 处** `page.goto` 含 `/#/entry/`（grep 核实：lines 33/45/54/72/87/105/118/127/141/159/172/186/201/217/264/276/285），统一替换；`page.goto('/')` 两处（TC-031/TC-050）保留但 TC-050 需改 `/explore`（见 S9）。

#### 2.1.2 slug 映射表（BDD-4，IMPL-D1~D4 落地）

| 用例 | 原 slug | 新 slug | 依据 |
|------|---------|---------|------|
| TC-001/002/003 | 运行时创建 `e2e-test-code` | 不变（API 创建，`allow_anonymous_create=true`，config.py:293） | IMPL-D4 |
| TC-004/005 | `lu4prg` | `python-entry-service` | IMPL-D2：entry_service.py 含 8 处 `def`（grep 核实），public/alice |
| TC-010/011/012 | `ngajri` | `markdown-test` | IMPL-D3：rich-markdown.md 含 h1-h3（grep 核实 5+ 个标题） |
| TC-013 | `ngajri` | `mermaid-charts` | IMPL-D3：flowchart.md 含 ` ```mermaid ` 块（grep 核实） |
| TC-020/021/022/023 | `ngajri` | `markdown-test` | IMPL-D3：多文件（rich-markdown.md + architecture.svg）+ TOC |
| TC-030 | `lu4prg` | `python-entry-service` | IMPL-D2 |
| TC-040 | `ngajri` | `markdown-test` | IMPL-D3：2 文件，`.file-item` nth(1) 存在（TC-040 需点第 2 个文件） |
| TC-041 | `lu4prg` | `json-api-config` | IMPL-D1：单内容文件（config.json），public/bob |
| TC-042 | `lu4prg` | `python-entry-service` | IMPL-D2 |

#### 2.1.3 死选择器/过时断言逐条替换（BDD-3，IMPL-S1~S12 落地）

| # | 用例 | 死选择器/过时断言 | 替换为（活选择器） | 依据 |
|---|------|-------------------|--------------------|------|
| S1 | TC-005 | `.code-header .filename` / `.code-header .lang` | 断言 `.file-item .file-name` 含 `entry_service.py`（文件名渲染在文件树）；lang 断言删除（代码查看器无 lang 头部元素） | P1 S1；grep 核实 `.file-name` 在 TreeNodeItem.vue:23 |
| S2 | TC-021/022 | `.mobile-actions` | `[data-testid="mobile-bottom-bar"]`（EntryDetailMobileBar.vue:2） | P1 S2 |
| S3 | TC-022 | `.mobile-actions .menu-btn` | `[data-testid="mobile-bar-filetree-btn"]`（:7） | P1 S3 |
| S4 | TC-023 | `.toc-btn` | `[data-testid="mobile-bar-toc-btn"]`（:15） | P1 S4 |
| S5 | TC-030/031 | `.list-header .btn-icon, .detail-header .btn-icon` | TC-030：`.detail-header .theme-toggle`；TC-031：`.theme-toggle`（landing 页 ThemeToggle 在 LandingView.vue:21） | P1 S5；grep 核实 ThemeToggle.vue:4 class="theme-toggle" |
| S6 | TC-004/005 | `button:has-text("Copy")` | `[aria-label="Copy"]`（桌面 header 内，EntryDetailHeader.vue:36）；TC-005 副本断言同此 | P1 S6 |
| S7 | TC-003 | `button:has-text("Wrap")`（桌面无 Wrap 按钮） | 桌面改移动端视口（375×812）+ `[data-testid="mobile-bar-wrap-btn"]`，断言 `.code-body` `wrap-enabled` class 切换（CodeViewer.vue:16 `:class="{ 'wrap-enabled': wrap }"`） | P1 S7；grep 核实 wrap 按钮仅移动端（EntryDetailMobileBar.vue:35） |
| S8 | TC-042 | `a[download]` 可见断言（JS 动态建 a 后即移除） | 触发真实下载：点 `[data-testid="overflow-menu-trigger"]` → 菜单项用**精确匹配** `getByText('Download', { exact: true })` 或 `hasText: /^Download$/`（OverflowMenu 含 `Download` 与 `Download as Pack` 两个 "Download" 开头项，子串匹配命中 2 个会 strict mode 报错） → `page.waitForEvent('download')` → 断言 `download.suggestedFilename()` 含 `entry_service.py` | P1 S8；grep 核实 useEntryDetailComputed.ts:86-97 + OverflowMenu 菜单项 label（useEntryDetailActions.ts:83 `Download` / :102 `Download as Pack`） |
| S9 | TC-050 | goto `/` 等 `.entry-card`（landing 不渲染） | goto `/explore`（EntryListView 渲染 `.entry-card`，EntryListView.vue:130） | P1 S9 |
| S10 | TC-050 | `toHaveURL(/\/entry\//)` | `toHaveURL(/\/([^/]+)$/)`（history 模式 URL 是 `/{slug}`，无 `/entry/`） | P1 S10；router.ts:38 `/:slug` |
| S11 | TC-012 | `toHaveURL(/.*${href}$/)`（TocNav `href="#id"` + `@click.prevent`，URL 不出现 hash） | 点击后断言**滚动容器**滚动位置变化：`expect.poll(() => page.locator('[data-testid="content-area"]').evaluate((el: HTMLElement) => el.scrollTop)).toBeGreaterThan(0)`；备选 `toBeInViewport()` 断言被点击标题进入可视区。**删除** `.toc-item.active` 辅助断言（当前 DOM 无 scroll-spy，见下方说明） | P1 S11；grep 核实 EntryDetailContent.vue:23 `data-testid="content-area"` + :227 `.content-area { overflow-y: auto }`；外层 `.entry-detail` `height:100dvh; overflow:hidden`（layout.css:2-8）⇒ `window.scrollY` 恒 0 不可用 |
| S12 | TC-013 | `if (mermaidExists)` 条件式断言（假绿） | 无条件断言 `.diagram-viewer` 可见且含 `svg`（mermaid 渲染容器，MermaidRenderer.vue:2 `.diagram-svg-container`） | P1 S12；grep 核实无 `.mermaid` 类 |

> 说明：P1 S12 原建议"断言 `.mermaid` 可见"，但 P2 对照当前 DOM 核实 `MermaidRenderer.vue` 渲染于 `.diagram-svg-container`（`v-html` 注入 mermaid SVG），无 `.mermaid` 类——采用 `.diagram-viewer svg` 作为真实可断言目标（即遵循"无条件断言渲染结果可见"的意图）。

> 说明（S11，评审 BLOCKER 修订）：滚动断言以 `.content-area`（`data-testid="content-area"`，EntryDetailContent.vue:23，`overflow-y: auto`）为锚——`.entry-detail` 外层 `height:100dvh; overflow:hidden`（layout.css:2-8），窗口本身不可滚，`window.scrollY` 恒 0。**不得依赖 `.toc-item.active`**：TocNav.vue:8 仅当 `activeId === heading.id` 才加 active class，而 EntryDetailContent.vue:77/107 均硬编码 `:activeId="null"`（无 scroll-spy 机制），active class 永不出现；若坚持用需另加 scroll-spy，超出本任务范围。

#### 2.1.4 单文件断言数据支撑（BDD-5）

TC-041 goto `/json-api-config`（桌面视口 1280×800），断言 `.file-sidebar` count === 0。EntryDetailContent.vue:4 `v-if="isFileTreeOpen && isMultiFile"`——json-api-config 单内容文件 ⇒ `isMultiFile=false` ⇒ 不渲染 ⇒ count 0。已验证该 entry 在 `scripts/seed-data/json-api-config/` 只含 config.json 一个内容文件（meta.json 非内容文件）。

#### 2.1.5 验收锚点

BDD-1：`E2E_SPEC=e2e/viewer.spec.ts make debug-test` 实跑 **19/19 用例 PASS**（非抽样、非 skipped 假绿）。

### 2.2 子任务 B：static 新鲜度校验（Check 6）

#### 2.2.1 新增脚本逻辑（`scripts/e2e-safety-check.sh`）

追加一个可独立测试的 shell 函数 + Check 6。**次序约定（评审 BLOCKER 修订）**：bash 函数须先定义后调用——`check_static_freshness` 定义与 `--test-mtime` 自检块均置于脚本顶部、Check 1 之前（自检块紧跟函数定义之后）；Check 6 的**调用**仍留在既有 Check 5 之后（只追加不移动 Check 1-5，IMPL-C1）。

```bash
# 函数定义（置于脚本顶部、Check 1 之前——bash 须先定义后调用，自检块才能命中）
check_static_freshness() {
    local src_dir="${PV_SRC_DIR:-frontend-v3/src}"
    local static_index="${PV_STATIC_INDEX:-backend/peekview/static/index.html}"
    if [ ! -f "$static_index" ]; then
        echo "✗ FATAL: $static_index 不存在"
        echo "   请先运行: make build-frontend"
        return 1
    fi
    local stale
    stale=$(find "$src_dir" -type f -newer "$static_index" 2>/dev/null)
    if [ -n "$stale" ]; then
        echo "✗ FATAL: frontend 源码比 static 产物新，E2E 将基于过期产物运行"
        echo "   过期文件（前 5 个）:"
        echo "$stale" | head -5
        echo "   请先运行: make build-frontend"
        return 1
    fi
    echo "✓ 静态产物新鲜 (src 未比 static/index.html 新)"
}

# --test-mtime 自检模式（P3 TDD 用；紧跟函数定义之后、Check 1 之前，绕过 E2E_GUARD 等既有检查）
if [ "${1:-}" = "--test-mtime" ]; then
    check_static_freshness
    exit $?
fi
```

在既有 Check 5 之后、`echo "=== ✓ 安全检查通过 ==="`（line 97）之前调用 Check 6：

```bash
# Check 6: 静态产物新鲜度
echo "→ Check 6: 验证静态产物新鲜度..."
check_static_freshness || exit 1
```

**与 P1 基线的一致性说明**：
- 基准 = `frontend-v3/src/` 最新 mtime vs `backend/peekview/static/index.html`（IMPL-B2）；`-type f` 仅比文件，规避"目录 mtime 更新导致假阳性"（minimal_validation 实测发现，见 §6）；static 缺失时先判 `[ -f ]` 否则 `find -newer` 对不存在文件静默无输出会误放行（minimal_validation Case 3）。
- 只追加不修改既有 Check 1-5（IMPL-C1）。
- 过期报错提示 `make build-frontend`（IMPL-C3，SUGGEST 已采纳）。
- `--test-mtime` 模式使 P3 可在临时 fixture 上直接断言退出码，无需启动 debug backend（配合 Makefile 传 env 覆盖路径）。

#### 2.2.2 Makefile `debug-test` Step 1 改动

现状（Makefile:636）：`E2E_GUARD_ENABLED=1 NONINTERACTIVE=1 bash scripts/e2e-safety-check.sh`。改为追加两个 env：

```make
@E2E_GUARD_ENABLED=1 NONINTERACTIVE=1 \
  PV_SRC_DIR=$(CURDIR)/frontend-v3/src \
  PV_STATIC_INDEX=$(CURDIR)/backend/peekview/static/index.html \
  bash scripts/e2e-safety-check.sh || exit 1
```

作用：使 Check 6 始终比对仓库根目录下的真实路径，不受 `make` 调用目录/相对路径影响；默认值兜底保持不变。

#### 2.2.3 三态验收（BDD-6/7/8）

- BDD-6（过期拦截）：`touch frontend-v3/src/某个文件`（不 rebuild）→ `make debug-test` → Step 1 失败、非零退出、提示 `make build-frontend`。
- BDD-7（新鲜放行）：刚 `make build-frontend` → `make debug-test` → Check 6 通过进入 E2E。
- BDD-8（不误伤）：`make debug-quick`（build→start→seed）→ `make debug-test` → 放行。

## 3. 四字段（gate_commands 在 P2 固化，P4-P6 不得修改）

```yaml
gate_commands:
  P3: "bash scripts/e2e-safety-check.sh --test-mtime"
  P5: "make test-quick"
  P5_typecheck: "make typecheck"
  P5_e2e: "E2E_SPEC=e2e/viewer.spec.ts make debug-test"
  project_module: ""
```

- P3 说明：`--test-mtime` 自检模式由 P3 test-designer 用临时 fixture（新鲜/过期两态）调用并断言退出码；fixture 路径经 `PV_SRC_DIR`/`PV_STATIC_INDEX` env 注入。命令本身可执行、输出见 §2.2.1。
- P5 说明：本任务无后端改动，`make test-quick` 全绿确认未波及；typecheck 是 CI 强制项（前端 spec 为 TS，`vue-tsc --noEmit` 覆盖）。
- P5_e2e 说明：`ui_affected: false` 但 E2E 验证针对测试本身（BDD-1 19/19），故仍声明（派发指引要求）。

## 4. files_to_read（P4 implementer 上下文地图）

```yaml
files_to_read:
  - path: frontend-v3/e2e/viewer.spec.ts
    why: 子任务 A 被修文件；逐条对照 §2.1.3 死选择器映射表
  - path: frontend-v3/src/router.ts
    why: 确认 history 模式与 /:slug 路由（BDD-2/IMPL-S10 依据）
  - path: frontend-v3/src/components/EntryDetailContent.vue:4,65,84,99-100
    why: file-sidebar v-if（isFileTreeOpen && isMultiFile）、toc-sidebar、drawer-left/right/overlay 结构
  - path: frontend-v3/src/components/EntryDetailMobileBar.vue:2-39
    why: mobile-bottom-bar / mobile-bar-filetree-btn / mobile-bar-toc-btn / mobile-bar-wrap-btn(:35) / mobile-bar-copy-btn 的 data-testid
  - path: frontend-v3/src/components/EntryDetailHeader.vue:13,36
    why: .detail-header 容器 + aria-label="Copy" 按钮（:36，TC-030/TC-004/TC-005）
  - path: frontend-v3/src/components/TocNav.vue:2-8
    why: .toc-nav/.toc-item 结构与 active class（TC-011/TC-012/IMPL-S11）
  - path: frontend-v3/src/components/TreeNodeItem.vue:18-23
    why: .file-item/.file-name/.active（TC-005/TC-040）
  - path: frontend-v3/src/components/ThemeToggle.vue:4
    why: .theme-toggle class（TC-030/TC-031）
  - path: frontend-v3/src/views/EntryListView.vue:3,11,130
    why: /explore 渲染 .entry-card + explore-header 内 ThemeToggle（TC-050/TC-031）
  - path: frontend-v3/src/views/LandingView.vue:21
    why: landing 页 ThemeToggle（TC-031）
  - path: frontend-v3/src/components/CodeViewer.vue:15-16
    why: .code-body + wrap-enabled class（TC-003/IMPL-S7/waitForShiki）
  - path: frontend-v3/src/components/DiagramBlock.vue:187-194
    why: diagram-viewer 容器（TC-013/IMPL-S12）
  - path: frontend-v3/src/components/OverflowMenu.vue + OverflowMenuDropdown.vue:20-32
    why: overflow-menu-trigger + .overflow-item 菜单项（TC-042/IMPL-S8）
  - path: frontend-v3/src/composables/useEntryDetailComputed.ts:86-113
    why: downloadFile/downloadPack 动态建 a 标签实现（TC-042 改写依据）
  - path: scripts/e2e-safety-check.sh
    why: 子任务 B 被修文件；Check 6 + --test-mtime 模式
  - path: Makefile:633-640
    why: debug-test Step 1 传 PV_SRC_DIR/PV_STATIC_INDEX
  - path: scripts/seed-data/{json-api-config,python-entry-service,markdown-test,mermaid-charts}/meta.json
    why: 确认 slug/is_public/owner 与文件数（BDD-4/BDD-5 数据依据）
```

## 5. env_constraints

```yaml
env_constraints:
  debug_env: "make debug-start + make debug-seed（或 make debug-quick 一步到位，:8888 /tmp/peekview-debug/ 隔离）；E2E: E2E_SPEC=e2e/viewer.spec.ts make debug-test"
  isolation_check: "make debug-verify-isolation（依赖 :8080 在线）或 sqlite3 /tmp/peekview-debug/peekview.db 'SELECT COUNT(*) FROM entries' 手动验证"
  lint: "前端无 lint gate；typecheck = cd frontend-v3 && npx vue-tsc --noEmit（CI 强制）"
  prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/；测试只走 debug backend :8888；严禁直接 sqlite3 操作生产 DB"
```

## 6. minimal_validation（子任务 B mtime 校验行为）

```yaml
minimal_validation:
  assumption: "find frontend-v3/src -newer backend/peekview/static/index.html 有输出=过期、无输出=新鲜"
  method: "临时目录构造 fixture：fresh（static 比 src 新）与 stale（src 文件 touch 晚于 static）两种场景，分别跑 find -newer（含/不含 -type f 两变体）"
  result: "confirmed_with_refinement"
  note: >
    ① 新鲜场景：`find <src> -type f -newer <static>` 无输出（正确放行）；stale 场景：输出过期文件（正确拦截）——核心假设成立。
    ② 关键发现：不加 `-type f` 时，src 目录本身（mtime 为目录内增删文件时间）可能被 `-newer` 匹配，产生假阳性；加 `-type f` 后仅比普通文件，规避之。方案 Check 6 统一用 `-type f`。
    ③ static 缺失场景：`find <src> -newer <不存在的文件>` 静默无输出（2>/dev/null 吞错）→ 若不判 `[ -f ]` 会误放行。方案先判文件存在，缺失即 FAIL 并提示 make build-frontend。
    ④ 真实仓库当前状态：`find frontend-v3/src -type f -newer backend/peekview/static/index.html` 无输出（fresh），与 BDD-7 预期一致。
```

## 7. 实现完成的标志

- [ ] viewer.spec.ts 无 `/#/entry/`、无 `lu4prg`/`ngajri` 残留（BDD-2/BDD-4，grep 可判）
- [ ] viewer.spec.ts 无 `.code-header`/`.mobile-actions`/`.menu-btn`（移动端文件抽屉语境）/`.toc-btn`/`.list-header`/`.btn-icon` 死选择器（BDD-3 白黑清单）
- [ ] 新增的每个选择器在当前组件模板中存在（§2.1.3 映射表逐条核对）
- [ ] `--test-mtime` 自检模式实现且 P3 fixture 测试通过（新鲜=0、过期=1、static 缺失=1）
- [ ] Check 6 位于既有 Check 5 之后、不破坏 Check 1-5
- [ ] Makefile debug-test Step 1 传入 `$(CURDIR)` 绝对路径 env
- [ ] `E2E_SPEC=e2e/viewer.spec.ts make debug-test` → 19/19 PASS（BDD-1）
- [ ] 三态实测：BDD-6 过期拦截 / BDD-7 新鲜放行 / BDD-8 正常流程不误伤
- [ ] `make lint && make typecheck` 通过（铁律 10）

## 8. 风险与缓解（相对 P1 风险登记增量）

| 风险 | 级别 | 缓解 |
|------|------|------|
| Check 6 `-type f` 与 P1 原字面命令（无 -type f）表述差异引发 P7 一致性争议 | low | 本方案已在 §2.2.1/§6 显式记录为"minimal_validation 驱动的最小修订"，BDD-6/7/8 语义不受影响 |
| TC-003 改移动端视口后 `.code-body` 在窄屏仍有 wrap-enabled 切换 | low | CodeViewer.vue:16 class 绑定与视口无关；P6 实跑断言真实性 |
| TC-012 滚动断言受内容长度影响（markdown-test 够长） | low | rich-markdown.md 19KB 含 h1-h3，点击 toc-item 触发 `scrollIntoView` 后 `.content-area` scrollTop 必 >0；备选 `toBeInViewport()` 断言标题进入可视区；不依赖 `.toc-item.active`（当前无 scroll-spy） |
