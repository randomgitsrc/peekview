---
phase: P4
task_id: TPV0099
type: implementation
parent: P2-design.md
trace_id: TPV0099-P4-20260928
status: done
created: '2026-09-28'
agent: implementer
implementation_dir: frontend-v3/src
implementation_dirs:
  - frontend-v3/src
  - frontend-v3/e2e
  - frontend-v3/src/composables/__tests__
  - docs            # DESIGN.md / CHANGELOG.md / docs/roadmap/improvement-backlog.md（三处文档改动）
---

# P4 实现 — 全屏模式链接 `/{slug}/f`（TPV0099）

> 上游：`P2-design.md` §1.1「最终规格」表（**唯一形态权威**）+ §6 `gate_commands` + §7 `files_to_read`
> TDD：P3 已写好 26 用例并确认真红灯；本阶段**让它们变绿，未改动任何测试断言**

---

## 0. 形态合规声明（P2 §1.1 最终规格表逐项对齐）

| 面 | P2 规定 | 实现落点 | 状态 |
|---|---|---|---|
| composable 签名 | `useZenMode(locked: () => boolean = () => false)` | `useZenMode.ts:6` | ✅ 逐字 |
| 调用点（M3） | `useZenMode(() => route.meta?.zen === 'locked')` | `EntryDetailView.vue:155` | ✅ thunk + `?.` 二者均在 |
| 读取方式 | 在 composable 内一律 `locked()` | `useZenMode.ts:9,11,16` | ✅ 无 `locked.value` / 无 `lockedMode` 状态变量 |
| 返回对象 | `{ zenMode, zenAriaText, handleZenKeydown }`（无 `updateZenAria`） | `useZenMode.ts:30-34` | ✅ 三键，`updateZenAria` 整体移除 |

**三个禁止变体均未触碰**：① 未传裸值；② `zenAriaText` 无任何赋值分支（computed，非 ref）；③ 签名未退化为 `locked: boolean`（`locked` 是被调用的 thunk，锁定态**不落任何 ref/mutable state**）。

---

## 1. 改动清单（M1~M9）

| # | 文件 | 改动 | 状态 |
|---|---|---|---|
| **M1** | `frontend-v3/src/router.ts` | `/:slug/f` 路由（`name: 'detail-zen-locked'`、`component: EntryDetailView`、`props: true`、`meta: { zen: 'locked' }`）插在 `/:slug` 之后、`/:pathMatch(.*)*` 之前 | ✅ |
| **M2** | `frontend-v3/src/composables/useZenMode.ts` | ① `locked: () => boolean = () => false` 入参；② `zenMode = computed(() => locked() \|\| manualZen.value)`；③ `zenAriaText` 改 computed、`updateZenAria` 移除（含返回键）；④ `handleZenKeydown` 首行锁死短路 | ✅ |
| **M3** | `frontend-v3/src/views/EntryDetailView.vue:155` | 传 `() => route.meta?.zen === 'locked'`；`provide`（:158/:160）与 `:class`（:2）写法**未动** | ✅ |
| **M4** | `DESIGN.md:210-212` | 「Zen Mode」节补全屏链接入口说明（既有 f 键语义明确写"不变"） | ✅ |
| **M5** | `CHANGELOG.md` `[Unreleased]`→「新增」 | 用户可见功能条目（铁律 8，未延后） | ✅ |
| **M6** | `docs/roadmap/improvement-backlog.md` #56 | 状态改 ✅ 已完成 + 划除并更正**已被证伪的前提**（"zen 外观统一…同时影响 f 键 zen"） | ✅ |
| **M7** | `frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts` | P3 产出，**未改动**，16 用例 | ✅ **32 passed / 0 failed**（16×2 project） |
| **M8** | `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts` | P3 产出，**未改动**，3 用例 | ⚠️ BDD-15 ✅ 双 project 绿；BDD-9 / BDD-10 各 2 failed = **用例缺陷**（诊断见 §4.3/§4.4；Then 本体经独立实跑全绿） |
| **M9** | `frontend-v3/src/composables/__tests__/useZenMode.spec.ts` | P3 产出，**未改动**，7 用例 | ✅ **7 passed** |

### M2 的四个子点（逐点说明）

```ts
import { computed, ref } from 'vue'

const LOCKED_ARIA_TEXT = 'Fullscreen view. Content only.'
const MANUAL_ON_ARIA_TEXT = 'Zen mode on. Press f or Escape to exit.'
const MANUAL_OFF_ARIA_TEXT = 'Zen mode off.'

export function useZenMode(locked: () => boolean = () => false) {
  const manualZen = ref(false)

  const zenMode = computed(() => locked() || manualZen.value)
  const zenAriaText = computed(() => {
    if (locked()) return LOCKED_ARIA_TEXT
    return manualZen.value ? MANUAL_ON_ARIA_TEXT : MANUAL_OFF_ARIA_TEXT
  })

  function handleZenKeydown(event: KeyboardEvent) {
    if (locked()) return          // ← ④ 锁死短路：整函数 return
    if (!shouldHandleZenShortcut(event)) return
    if (event.key === 'Escape' && zenMode.value) {
      manualZen.value = false
      event.preventDefault()
      return
    }
    if (event.key === 'f' || event.key === 'F') {
      manualZen.value = !manualZen.value
      if (manualZen.value) {
        redirectFocusIfHidden()
      }
      event.preventDefault()
    }
  }

  return { zenMode, zenAriaText, handleZenKeydown }
}
```

1. **`zenMode` 是 computed 派生**（不是 ref，也不是 setup 期快照）——`locked()` 为只读 thunk，锁定态**不落任何可变状态**。组件在 `/{slug}` ↔ `/{slug}/f` 客户端导航间被复用（P2 §4 V3：`onMounted` 仅 1 次）时，`zenMode` 随 `route.meta` 响应式翻转，离开锁死路由**无残留**（M9 `test_m9_*` 的 `[false,true,false]` 三元组即此不变量的可执行拦截）。
2. **`manualZen` 是被重命名的内部状态**（原 `zenMode` ref）——语义收窄为"仅承载 f 键手动进出"，锁死态不再与它同源。这样 `locked()` 为真时 `zenMode` 恒真、且手动态被完全旁路，R-01（锁死态误写进全局 zen）无写入点。
3. **`handleZenKeydown` 首行锁死短路 = 整个函数 `return`**：**既不 `preventDefault` 也不 `stopPropagation`**，保持既有 **bubble 相位**（`EntryDetailView.vue:216` 的 `document.addEventListener('keydown', ...)` 未加 capture 参数，未改动）。→ BDD-7 成立：内容区内嵌元素（`TableView.vue:227` 分页浮层的 Escape）先于 document 收到事件并消费，锁死短路只是"什么都不做"。**未按 P1 §2.1 原措辞去"避免 preventDefault"**——按 P4 派发指引 §R3 的关键澄清，真正吞事件的是 capture + stopPropagation，本实现两者皆无。
4. **`zenAriaText` 为 computed，锁死文案为常量 `'Fullscreen view. Content only.'`**——逐字自检不含 `Escape` / `exit` 子串（BDD-6 词表为闭集），也不含退出提示词组。非锁死态两个分支文案**逐字保留既有字符串**（`'Zen mode on. Press f or Escape to exit.'` / `'Zen mode off.'`），故 BDD-12 的既有公告语义与外观零变化。**无任何对 computed 的赋值分支**（否则 `TS2540`，打红 `P5_typecheck`）→ `updateZenAria` 整体移除（全仓非测试代码零消费方，已核）。

---

## 2. 未改动（Not Modify，逐项遵守）

| # | 范围 | 遵守情况 |
|---|---|---|
| N1 | 死选择器 `.mobile-actions` | 未动 |
| N2 | 重复的 `zen-shortcut.spec.ts` 两文件 | 未动（`zen-shortcut.ts` 亦未动 → 无同步义务） |
| N3 | `t052-header-redesign.test.ts:141` 恒真假绿 + `layout.css:480` 死 CSS | 未动 |
| N4 | `frontend-v3/src/styles/layout.css` **全文** | **零 CSS 改动**（git status 无此文件） |
| N5 | `entryDetailKeys.ts` | 未动。**实测类型兼容确认**：`ZenModeKey: InjectionKey<Ref<boolean>>` 接收 `ComputedRef<boolean>` —— `make typecheck` exit 0 证明成立 |
| N6 | `zen-shortcut.ts` | 未动（纯函数；短路正确位置在调用方） |
| N7 | `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` 的 `v-show="!zenMode"` | 未动（inject 侧响应式等价） |
| N8 | 后端 `backend/peekview/` 全部 | 未动（`make lint` 仅测后端 Python，exit 0；`git status` 无后端文件） |
| N9/N11 | `EntryDetailContent.vue` / `entryDetail.ts` `selectFile` / `useMarkdown.ts` | 未动（保态天然成立，BDD-8 实测转绿） |
| N10 | MCP `packages/mcp-server/` | 未动 |
| N12 | `.archived-banner` / `.expired-warning-banner` **未加** zen 隐藏规则 | 未动（登记 DEBT0013，归属后续任务） |
| N13 | 既有 E2E spec（`viewer.spec.ts` 等） | **未改动任何既有 spec**（git status 无既有 spec 变更） |
| N14 | `EntryDetailView.vue` 300 行上限 | **265 行，与实现前一致**（单行替换 `useZenMode()` → 传参，未增行） |
| — | `.agate/formatters/vitest.sh` / `gate_commands.P3_formatter` | 未动（DEBT0014 规避点保留） |
| — | 后端 `static/` 构建产物 | 由 `make build-frontend-fast` 重建（陷阱 1 要求，非手改） |

**追加约束（T031/T067 mock 面）**：`t031-entry-detail-view.spec.ts:106` / `t067-detail-framework.spec.ts:119` 的 `useZenMode` mock 仍返回多出的 `updateZenAria: vi.fn()` 键——**未改动它们**（派发指引已确认无害），两 spec 的实现后实测仍绿（见 §3）。

---

## 3. 实测结果（自查，**≠ P5 gate**）

| 检查 | 命令 | 结果 |
|---|---|---|
| 新增单测（M9，7 用例） | `npx vitest run src/composables/__tests__/useZenMode.spec.ts` | **7 passed**（P3 时点为 6 failed / 1 passed → 全绿） |
| 前端全量单测 | `timeout 400s make test-frontend` | **exit 0**；`111 passed (111)` / `1350 passed \| 4 skipped (1354)`（基线 110/1343\|4(1347) → **+1 file / +7 tests = 恰为 M9 新增**，既有 110 files **零回归**；`DiagramBlock.spec.ts` 的已知 flaky 本轮未触发） |
| 类型检查 | `timeout 400s make typecheck` | **exit 0**（`✓ type check passed`）——验证 M2/M3 的类型契约稳定性（composable 新签名 → computed provide → 组件模板三处全仓无错） |
| 后端 lint | `timeout 180s make lint` | **exit 0**（`All checks passed!`）——同时探测"后端确实未被越界改动" |
| 文档一致性 | `timeout 180s make check-docs` | **exit 0**（`✓ 所有文档与代码保持一致`）——M4/M5/M6 三处文档改动未破坏契约 |
| 构建产物（UI 任务要求） | `timeout 600s make build-frontend-fast` | **exit 0**；`✓ 388 static files` → `backend/peekview/static/index.html` **存在**且**新鲜**（`find frontend-v3/src -newer backend/peekview/static/index.html` 为空 → 陷阱 1 已满足） |
| 本任务 E2E（匿名组 16 用例） | `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test` | 见下方 §4 |
| 本任务 E2E（登录组 3 用例） | `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test` | 见下方 §4 |

**debug 环境探活（开工前 + 每次跑 E2E 前）**：`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8888/health` → **200**。
**seed 探活**：`dsh-architecture` / `tsv-server-metrics` / `unicode-filenames` / `svg-icons` → 全部 **200**；`nonexistent-slug-xyz/f` → **200**（BDD-18 对照基线成立）。

---

## 4. E2E 实跑结果（实测输出转录）

跑前已 `make build-frontend-fast`（陷阱 1 满足：`find frontend-v3/src -newer backend/peekview/static/index.html` 为空）。

### 4.1 匿名组 `E2E_SPEC=e2e/tpv0099-fullscreen-link.spec.ts make debug-test`

```
  32 passed (13.9s)

=== ✓ 所有 E2E 测试通过 ===
```

**exit 0，32 passed = 16 用例 × 2 project（chromium + Mobile Chrome）全绿。** 含 3 条回归护栏（BDD-11/12/19）仍绿，P3 时点的 26 failed 全部转绿。
截图产物：`/tmp/e2e-results/`（含 BDD-16 的 `test-results/tpv0099-bdd16-desktop_1280x800.png`，供 P6 视觉验收）。

### 4.2 登录组 `E2E_SPEC=e2e/tpv0099-fullscreen-link-auth.spec.ts make debug-test`

```
  4 failed
    [chromium]      › test_bdd_9_toc_hidden_and_anchor_scroll_works
    [chromium]      › test_bdd_10_private_entry_share_token_fullscreen
    [Mobile Chrome] › test_bdd_9_toc_hidden_and_anchor_scroll_works
    [Mobile Chrome] › test_bdd_10_private_entry_share_token_fullscreen
  2 passed (16.9s)   ← BDD-15 双 project 全绿
```

**exit 2（make 错误 1）。** BDD-15 已从 P3 的 6 failed/0 passed 转为**双 project 绿**；剩余 4 个失败（BDD-9 ×2 project、BDD-10 ×2 project）经逐条实测诊断为**测试用例自身缺陷，非实现缺陷**——两处断言与本任务路由设计（`/f` 后缀必须保留，见 BDD-2/8/13/14/18）及 Playwright 夹具语义相矛盾，**在不改测试的前提下不可同时成立**。诊断证据见 §4.3/§4.4。

### 4.3 BDD-9 失败诊断：断言期望值与自身 Given 矛盾（P3 转写错误）

失败断言（`tpv0099-fullscreen-link-auth.spec.ts:151`）：

```
Error: BDD-9: 锚点跳转不得改变 pathname
Expected: "/markdown-test"      Received: "/markdown-test/f"
```

该文件的 Given（`:101`）本身导航到 **`/${SLUG_MD}/f?firstFileId=...`**，即 `/markdown-test/f`；`:144`（目录侧栏不可见）与 `:147`（`.content-area.scrollTop` 由 0 增加）**均已通过**（断言顺序在前），仅 `:151` 失败。

- **期望值 `/markdown-test` 的来源**：P1 §3.3 BDD-9 的实测锚点（`P1-requirements.md:226`）写「**zen 态**……`location.pathname` 仍为 `/markdown-test`」——该测量是在**单段路径 `/{slug}` 上用 f 键进入 zen** 时做的（P1 写作时 `/{slug}/f` 路由尚不存在，P2 §4 V1 实测其落 catch-all NotFoundView）。P3 把这个**在另一条路径上测得的字面值**搬进了「Given 为 `/{slug}/f`」的用例。
- **与 BDD 基线直接冲突**：P1 BDD-9 的 **Then 原文**（`:222`）只要求「目录侧栏不可见；且 `.content-area` 的 `scrollTop` 增加 > 0」，**从未要求 pathname 等于 `/${slug}`**；`:151` 是 P3 自行追加的"附"断言。而 BDD-2/8/13/14/18 与本 spec BDD-15（`:210`）**一律要求 `/f` 后缀被保留**。
- **结论**：若为迎合 `:151` 而在锚点点击时剥掉 `/f`，会同时打红 BDD-8/13/14/18 与本 spec BDD-15 —— **该断言与实现正确性无关，属用例缺陷**。

### 4.4 BDD-10 失败诊断：基线断言受已登录 `request` context 残留凭据影响（**BDD 本体已通过**）

失败断言（`:288`，位于「区分力基线」前置块，非 BDD-10 的 Then）：

```
Error: BDD-10 基线: 匿名无 token 读私有 entry 须 404
Expected: 404      Received: 200
```

**机制（已独立实测确证）**：`:255` 的 `aliceToken(request)` 调 `/auth/login` 之后，响应头 `Set-Cookie: peekview_token=...`（实测存在）被存入该 `APIRequestContext` 的 cookie 存储 → 此后**无 `Authorization` 头**的 `request.get`（`:285` 无 token、`:286` 伪 token）仍被**自动以 alice 身份**发出 → 读自己的私有 entry 得 **200**，而非所期望的 404。

独立探针（`.agate-tmp/probe-bdd10.cjs`，2026-09-28 实跑，`pw.request.newContext()` 直连）：

```json
{
  "created_is_public": false,
  "SAME_ctx_no_header": 200,      ← 登录过的同一 request context（cookie 已被存储）
  "SAME_ctx_fake_token": 200,
  "FRESH_ctx_no_header": 404,     ← 全新未登录 context = 真匿名
  "cookies_in_login_ctx": ["peekview_token"]
}
```

即：**同 context 200 / 全新匿名 context 404** —— 该断言失败唯一取决于"这个 `request` 是否登录过"，与实现是否让匿名读到私有 entry 无关。

**BDD-10 的 Then 本体用真匿名 context 实测全部通过**（独立探针 `.agate-tmp/probe-bdd10-then.cjs`，chromium + 1280×800 实跑）：

```json
{
  "share_status": 201,
  "no_token":  { "markerVisible": false, "zen": true, "chromeVisible": [false,false,false,false] },
  "fake_token":{ "markerVisible": false, "zen": true, "chromeVisible": [false,false,false,false] },
  "real_token":{ "markerVisible": true,  "zen": true, "chromeVisible": [false,false,false,false] },
  "distinguishing_triple": [false, false, true],
  "cleanup_raw_after_delete": 404
}
```

→ 逐项满足 P1 BDD-10 的 Then（私有正文可见 + 全屏形态成立 + 无鉴权失败提示）与 P2 §6.2 的**区分力硬约束**（三态互不相同 = `[false,false,true]`，**未退化为恒真假绿**），且清理钩子有效（删除后 alice 复查 raw = 404）。**测试路径的失败点全在"用共享 `request` 夹具冒充匿名"这一前置**，实现侧无可修之处（要让它按原样 200→404，只能让后端忽略 Cookie —— 违反 N8「后端零改动」）。

### 4.5 E2E 结论

| spec | 用例 | 结果 |
|---|---|---|
| 匿名组 | 16（×2 project） | ✅ **32 passed / 0 failed** |
| 登录组 BDD-15 | 1（×2 project） | ✅ 2 passed |
| 登录组 BDD-9 | 1（×2 project） | ❌ 2 failed —— **用例缺陷**（断言期望值与自身 Given 及 BDD-2/8/13/14/18 矛盾） |
| 登录组 BDD-10 | 1（×2 project） | ❌ 2 failed —— **用例缺陷**（基线断言受已登录 `request` context 残留凭据影响；**BDD Then 本体经独立实跑全绿**） |

**未改动任何测试文件**（含 M7/M8/M9 三个新 spec）——按 implementer 角色决策树第 2 条，测试断言与基线/设计矛盾时**标 `[DESIGN_GAP]` 而非改测试**，见 §8。

### 4.6 残留与清理核查

- E2E 探针自建 entry 均已清理：`alice` 检索 `tpv0099` 相关 entry **count = 0**；探针 entry 复查 raw = **404**。
- 本次 P4 的临时探针脚本全部落 `.agate-tmp/`（`probe-bdd10.cjs` / `probe-bdd10-then.cjs` / `probe-cookie-share.cjs`），**未在 `frontend-v3/` 下新增任何临时文件**。

---

## 5. 环境与纪律

- `[PROD_NOT_TOUCHED]`：未触碰生产 `:8080` 与 `~/.peekview/`；未 `uvicorn` 直接启动；未 `make debug` / `npm run dev`；全部 E2E 经 `make debug-test`（含 E2E 安全护栏）。
- 临时/探针文件：**零新增于 `frontend-v3/` 下**（`git status --porcelain frontend-v3/` 仅含 3 个正式改动 + 2 个 P3 产出的新 spec，见 §6）。
- 未使用 `git add` / `git commit`（主 Agent 负责）。
- 子派发未启用。
- 分阶段落盘：每完成一步追加 `P4-progress.md`。
- 项目规范：**未加任何注释**（改动文件不含新增注释行）；`make lint` + `make typecheck` 均 exit 0。

---

## 6. 改动文件与 `git status`

**修改（3 个源码 + 3 个文档）**：
```
 M frontend-v3/src/composables/useZenMode.ts
 M frontend-v3/src/router.ts
 M frontend-v3/src/views/EntryDetailView.vue
 M DESIGN.md
 M CHANGELOG.md
 M docs/roadmap/improvement-backlog.md
```

**新增测试文件（P3 产出，P4 未改动）**：
```
 frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts
 frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts
 frontend-v3/src/composables/__tests__/useZenMode.spec.ts
```

`git status --porcelain frontend-v3/` **仅含上述 6 项**（3 改 + 3 新），**无临时探针残留**。

---

## 7. 新增文件核对表

> 骨架机制（`P2-skeleton.md`）与 CODE-MAP（`agents/CODE-MAP.md`）**本项目均未采用**（已核实两文件均不存在）→ 本节按 P4 卡规定可省略。为可追溯仍列出：

| 新增文件路径 | 骨架归属 | CODE-MAP 处理 |
|---|---|---|
| `frontend-v3/e2e/tpv0099-fullscreen-link.spec.ts` | 骨架机制未采用（P3 产出） | `[CODE_MAP_EXEMPT: CODE-MAP 机制未采用；且为测试脚手架]` |
| `frontend-v3/e2e/tpv0099-fullscreen-link-auth.spec.ts` | 同上 | `[CODE_MAP_EXEMPT: 同上]` |
| `frontend-v3/src/composables/__tests__/useZenMode.spec.ts` | 同上 | `[CODE_MAP_EXEMPT: 同上]` |

---

## 8. 偏差声明

[DESIGN_GAP: `e2e/tpv0099-fullscreen-link-auth.spec.ts:151` 断言 `pathname === '/markdown-test'` 与本用例自身 Given（`:101` 导航至 `/markdown-test/f`）及 BDD-2/8/13/14/18、本 spec BDD-15(`:210`) 的「`/f` 后缀必须保留」直接矛盾——该期望值系 P3 从 P1 §3.3「zen 态下 pathname 仍为 `/markdown-test`」的字面锚点搬入（P1 那次测量在 `/{slug}` 上用 f 键做，`/{slug}/f` 路由当时尚不存在），而 P1 BDD-9 的 Then 原文只要求「目录侧栏不可见 + `.content-area.scrollTop` 增加 > 0」（二者实测**均已通过**）。按 implementer 决策树第 2 条**未改测试**；请主 Agent 裁决（预期处置：修该断言为 `/${SLUG_MD}/f`，属 P3 产出修正，非本任务实现缺陷）]
[DESIGN_GAP: `e2e/tpv0099-fullscreen-link-auth.spec.ts:288` 的「匿名无 token 须 404」基线断言受 Playwright `request` 夹具自身 cookie 存储影响——`:255` 的 `aliceToken(request)` 调 `/auth/login` 后，`Set-Cookie: peekview_token=...` 进入该 `APIRequestContext`，此后无 Authorization 头的 `request.get`（`:285`/`:286`）被自动以 alice 身份发出 → 200 而非 404（独立探针实测：同 context 200 / 全新匿名 context 404）。该失败发生在任何页面交互之前，与本任务实现无关；BDD-10 的 Then 本体经独立探针（真匿名 browser context + 1280×800）实测**全部通过**且区分力三元组为 `[false,false,true]`（未退化恒真）。按决策树第 2 条**未改测试**（改后端忽略 Cookie 将违反 N8 后端零改动）；请主 Agent 裁决（预期处置：基线改用独立 `APIRequestContext`/`playwright.request.newContext()`，属 P3 产出修正）]

- **自主决策点**：**无**。M1~M3 逐字照 P2 §1.1「最终规格」表实现，无偏离（内部 `manualZen` 命名由 P2 §1.1 M2 第②条逐字给定）。
- `[SCOPE+]`：**无新增**。P2 §1.3 R-04 的 banner 项已在 P2 裁决为"不采纳，仅登记"，本阶段未重开。
- `[SCOPE_GAP]`：**无**。P2 §1.1 的 M1~M6 全部落地；M7~M9 未改测试（见上两条 DESIGN_GAP）。
- `[CLARIFY]`：**无**。
- `[BASELINE_CHANGE]`：**无**（未改 `P1-requirements.md`）。

**DESIGN_GAP 计数自检**：`grep -c '^\[DESIGN_GAP:' P4-implementation.md` → **2**（与上列 2 条一致，均为**测试缺陷**、均**未**改动测试文件）。

---

## 9. 回归护栏确认（P3 红灯分布中"已绿者"的实现后状态）

P3 时点有 1 个绿单测 + 3 个绿 E2E，属**回归护栏**（非锁死态行为本应不变 / 现状 catch-all 与实现后均满足 Then）。**实现后必须仍绿——已逐个确认**：

| 护栏 | 内容 | 实现后 |
|---|---|---|
| 单测 `test_bdd_12_non_locked_zen_shortcuts_and_announcement_unchanged` | 非锁死态 f 进入 / Escape 退出 / 公告含 `Escape` / 两键均 `preventDefault` | ✅ 仍绿（7/7 passed） |
| E2E `test_bdd_11_plain_slug_page_unchanged` | `/{slug}` 完整页面形态不变 | ✅ 仍绿（见 §4） |
| E2E `test_bdd_12_existing_f_key_zen_unchanged` | 既有 f 键 zen 外观/语义/公告零变化 | ✅ 仍绿（见 §4） |
| E2E `test_bdd_19_mid_path_segment_not_matching_entry` | `/{slug}/f/xyz` 不误渲染 | ✅ 仍绿（见 §4） |

---

## 10. 下游依赖（供 P5/P6）

- `gate_commands` 的 E2E 键**必须**用 `E2E_SPEC=<spec> make debug-test` 定向（裸调用只跑 `e2e/debug-server.spec.ts`，R-07 假绿）。
- **跑任何 E2E 前**：若在 P4 之后又改过 `frontend-v3/src` 下任一文件，必须重跑 `make build-frontend-fast`（~15s），否则 `scripts/e2e-safety-check.sh` Check 6 会 FATAL 拒绝。
- BDD-1/2/3 的 seed 必须钉定 `dsh-architecture`（非归档、非过期）。
- 既有 `viewer.spec.ts` 的 18 failed 是**预存红灯**（TPV0095 seed 语义回归，归属 TPV0097/TPV0098），**不进本任务 gate**。
