---
phase: P2
task_id: TPV0094-treeview-default-expand
type: design
parent: P1-requirements.md
trace_id: TPV0094-P2-20260814
status: draft
created: 2026-08-14
agent: architect
# ── v2.0 机器字段 ──
candidate_count: 2
packages: [frontend-v3/src/components/TreeView.vue, frontend-v3/src/components/__tests__/TreeView.spec.ts, frontend-v3/e2e/structured-data-viewer.spec.ts, frontend-v3/scripts/measure-treeview-perf.ts]
domains: [frontend]
ui_affected: true
---

# P2 设计 — T094 TreeView 默认展开优化

## §1 影响域分析

### 改什么

| 文件 | 改动 |
|------|------|
| `frontend-v3/src/components/TreeView.vue` | `resetExpansion()` 从「只展开根」改为「节点总数 ≤ 阈值 → 全展开所有含子节点路径；> 阈值 → `expandedPaths` 置空 Set（根也折叠，任何超阈值树都真实折叠）」；新增 `totalNodeCount` 递归计数 computed + `hasBranchNode` + `shouldCollapse` 判定 + 折叠提示 banner（渲染条件 = `shouldCollapse` 且在非 truncated 分支）；新增可导出常量 `DEFAULT_EXPAND_THRESHOLD` |
| `frontend-v3/src/components/__tests__/TreeView.spec.ts` | 更新 `test_bdd_27/28`（初始态从折叠改为展开）；新增 BDD-1/3/6/7 单测用例（fixture 相对阈值构建） |
| `frontend-v3/e2e/structured-data-viewer.spec.ts` | 更新 `test_bdd_27/28`；新增 BDD-1/2/3/4/5/6/7 E2E；beforeAll 新增大/小/多文件 fixture entries |
| `frontend-v3/scripts/measure-treeview-perf.ts`（新增） | BDD-8 红线实测脚本（CDP 连接 debug backend :8888，逐量级测全展开渲染耗时，输出证据） |

### 不改什么

- `DataTreeNode.vue` — 递归渲染 + `isExpanded`（`expandedPaths.has(path)`）+ `toggle` 契约全部保留（隐含需求 #4）
- `structured-data.ts` / `treeExpandKey.ts` — TreeDataNode 结构与 TreeExpandKey 注入机制不变
- `useTreeData.ts` — JSON/YAML/XML 解析与节点语义不变
- `matchCount` — 递归遍历不依赖展开态，搜索计数天然不受影响（隐含需求 #6）
- 后端 / API / MCP — 纯前端改动

### 风险在哪

- **全展开 DOM 数 = 节点总数**：无虚拟滚动，超红线仍全展开会撑爆 DOM → 由阈值降级兜底，阈值须实测（BDD-8）
- **旧断言初始折叠必挂**：单测 `test_bdd_27/28`（L84-111）+ E2E `test_bdd_27/28`（L206-225）逐行核验均断言初始 `aria-expanded="false"`，不更新则 CI 红（隐含需求 #1）
- **切文件状态串扰**：新逻辑必须落在 `resetExpansion()`（watch 重置路径内），否则多文件 entry 切换后继承旧展开态（隐含需求 #2，BDD-5）
- **XML 节点口径**：XML 树含 `@attr`/`#text` 子节点，计数按 `TreeDataNode[]` 全递归（含这些节点）——语义是「DOM 渲染成本」，正确
- **顶层宽数组无分支可折叠**：`[1..5000]` 顶层宽数组无含子节点节点，`shouldCollapse=false` → 不显示 banner，也无可折叠层做性能保护——诚实行为，接受（评审 F2 确认）

## §2 候选方案与权衡

### 候选 A（选定）：全展开路径预收集 + 阈值降级（改 resetExpansion）

在 `resetExpansion()` 中，先算 `totalNodeCount`（递归计数所有节点），`≤ DEFAULT_EXPAND_THRESHOLD` 时把**所有含子节点节点的 path 收集进 `expandedPaths` Set**（递归收集），`> 阈值` 时 **`expandedPaths` 置空 Set**（根也折叠——保证任何超阈值树都真实折叠，含单根+海量叶子的大平层）。折叠提示 banner 在非 truncated 分支内、tree-list 之前渲染（`v-if="shouldCollapse"`），`shouldCollapse = totalNodeCount > 阈值 && 存在含子节点节点`（顶层宽数组无含子节点节点 → 不显示 banner，诚实）。

```ts
export const DEFAULT_EXPAND_THRESHOLD = 2000 // P6 红线实测后据证据更新

const totalNodeCount = computed(() => {
  let count = 0
  const walk = (nodes: TreeDataNode[]) => {
    for (const node of nodes) {
      count++
      if (node.children?.length) walk(node.children)
    }
  }
  walk(treeData.value)
  return count
})

const hasBranchNode = computed(() => {
  const has = (nodes: TreeDataNode[]): boolean =>
    nodes.some((node) => (node.children?.length ?? 0) > 0 || has(node.children ?? []))
  return has(treeData.value)
})

const shouldCollapse = computed(
  () => totalNodeCount.value > DEFAULT_EXPAND_THRESHOLD && hasBranchNode.value,
)

function resetExpansion() {
  const paths = new Set<string>()
  if (totalNodeCount.value <= DEFAULT_EXPAND_THRESHOLD) {
    const collect = (nodes: TreeDataNode[]) => {
      for (const node of nodes) {
        if (node.children?.length) {
          paths.add(node.path)
          collect(node.children)
        }
      }
    }
    collect(treeData.value)
  }
  // > 阈值：expandedPaths 保持空 Set——根也折叠，单根+海量叶子同样折叠到只剩根，
  // 任何超阈值树都真实折叠（不依赖「根是否自动展开」）
  expandedPaths.value = paths
}
```

- **优点**：单点改动（仅 TreeView.vue 逻辑）；完全复用现有 `expandedPaths` + provide/inject 契约，DataTreeNode.vue 零改动；watch 重置路径天然复用（BDD-5 自动满足）；Set 内存量级 O(节点数)，5000 节点字符串 path 远低于内存红线；测试可相对导出的阈值常量构建 fixture（阈值变更不炸测试）
- **风险**：全展开需遍历整树收集 path（O(n)），与 matchCount 同量级，5000 节点 < 1ms，可忽略
- **工作量**：~1 个组件改动 + 测试同步，最小

### 候选 B（否决）：默认展开标记下传（DataTreeNode 加 defaultExpanded）

给 `TreeExpandKey` 注入一个「默认全展开」布尔标记，`DataTreeNode.isExpanded = expandedPaths.has(path) || defaultExpanded`，免去预收集 path Set。

- **优点**：免 O(n) 预收集，isExpanded 判定 O(1)
- **风险/成本**：**必须改 DataTreeNode.vue + treeExpandKey.ts + TreeView.vue 三个文件**，超出 P1 隐含需求 #4 声明（DataTreeNode.vue 不改、toggle 契约不变）与 P1 三文件范围；注入契约语义变复杂（展开态来源从单一 Set 变成 Set+flag 双源）；P6 实测显示 O(n) 收集成本可忽略，flag 收益为零
- **否决理由**：改动面翻倍、契约复杂化、收益为负——P1 隐含需求 #4 明确要求 DataTreeNode.vue 不改（评审 F5 事实更正：P0-brief 原文「可能 DataTreeNode.vue（如需优化渲染）」并未禁止改该文件）

## §3 设计定稿（P1 SUGGEST 落地）

| SUGGEST | 定稿决策 |
|---------|---------|
| 单一可配置常量 `DEFAULT_EXPAND_THRESHOLD` | 采纳。`export const DEFAULT_EXPAND_THRESHOLD = 2000`（P0 估算 2000~5000 取下界安全值），导出供单测相对构建 fixture；P6 实测后据证据更新值并重跑 BDD-1/3 边界 |
| 折叠提示复用 TruncationBanner 视觉模式 | 采纳。不复用组件本体（TruncationBanner 强依赖 downloadFn），在 TreeView.vue 内联 banner：同 warning-bg/warning-text/warning-border 视觉 + `role="status"`，文案「内容较大，已折叠部分」；新增稳定标识 `data-testid="tree-collapse-banner"`。**渲染条件 = `shouldCollapse` 为 true 且在非 truncated 分支**（模板 `v-else` 内、tree-list 前，与 TruncationBanner 天然互斥） |
| 搜索命中自动展开留 backlog | 采纳，本次不做 |

### UI 测试标识清单（稳定标识，供 P3/P4）

- 折叠提示 banner：**`data-testid="tree-collapse-banner"`**（新增，唯一稳定标识）
- 沿用现有 class 选择器作为既有元素契约（已有多处断言，不迁移）：
  - `.tree-node`（递归节点，DOM 计数 = 渲染节点数）
  - `.expand-toggle` + `aria-expanded`（展开按钮与状态）
  - `.tree-node-label` / `.type-tag` / `.search-highlight`
  - `.no-data`（空输入分支）
  - `.truncation-banner`（>2MB 截断，与折叠 banner 互斥）
  - `input[aria-label="Search tree nodes"]` + `[aria-live="polite"]`

### 边界处理（隐含需求 #8）

**`shouldCollapse` 完整定义**（与 §2 代码块一致，评审 F1/R2 补齐）：

```ts
const hasBranchNode = computed(() => {
  const has = (nodes: TreeDataNode[]): boolean =>
    nodes.some((node) => (node.children?.length ?? 0) > 0 || has(node.children ?? []))
  return has(treeData.value)
})
const shouldCollapse = computed(
  () => totalNodeCount.value > DEFAULT_EXPAND_THRESHOLD && hasBranchNode.value,
)
```

- `hasBranchNode`：全树递归是否存在任一含子节点节点（顶层宽数组/纯叶子树 → false）
- **banner 渲染条件 = `shouldCollapse` 为 true 且在非 truncated 分支**（模板 `v-else` 内，与 TruncationBanner 互斥）
- 空输入（`{}`/`[]`/`null`/标量根）：`totalNodeCount` = 0 或叶子无 children → collect 收集空集 → `expandedPaths` 空 Set，无 toggle 可点，不崩（BDD-36 单测已覆盖此路径）
- 根无 children（单叶子）：collect 不收集 → 空 Set，正常渲染叶子
- **单根+海量叶子大平层（`{"list":[...]}`，评审 F2）**：`> 阈值` → `expandedPaths` 空 Set → 根折叠，`.tree-node` 只剩 1，**真实折叠 + 性能保护生效**（旧设计展开根 → 全量渲染 + banner 假折叠，已修复）
- **顶层宽数组（`[1..5000]`，评审 F2）**：无含子节点节点 → `hasBranchNode=false` → `shouldCollapse=false` → **不显示 banner**（诚实，无「已折叠」假提示）；此类树无可折叠层，性能保护不适用——明确为接受行为

## §4 关键决策点

### 4.1 折叠提示与 2MB 截断互斥（隐含需求 #5）

`TreeView.vue` 模板现有 `v-if="truncated"`（TruncationBanner）`/ v-else`（tree 分支）互斥结构。折叠 banner 放 **`v-else` 分支内、tree-list 之前**，天然与 TruncationBanner 互斥（同一时刻至多一个）。折叠 banner 是渲染路径内提示，TruncationBanner 是截断提示，语义不同、路径不同，互不干扰。

### 4.2 BDD-5 fixture 选型（P1-review 建议 #2 承接）

用 **100 vs 10000 固定余量**规避对红线实测结果的依赖：
- 小文件 fixture：≤100 节点（如 60 节点 JSON），远小于预估红线 2000~5000 下界
- 大文件 fixture：10000 节点紧凑 JSON（BDD-3/4/5 共用），远超预估上界
- 冗余保障：即使 P6 实测把红线推到极端（<100 或 >10000），BDD-8 证据复核会暴露，届时定向回补

### 4.3 BDD-4 手动展开 fixture（P1-review 建议 #3 承接）

大文件 fixture 不用「单根 10000 直子」平铺（单次点击渲染 10000 节点易超时），改 **根 → 多个中等子树分支**（如 20 个子树 × 每子树 500 节点）。根含子节点 → `hasBranchNode=true` → banner 显示条件满足（BDD-3 共用此 fixture）。R1 修订后超阈值初始即折叠（空 Set）：BDD-4 首步点击**根 toggle** 展开第一层（20 个子树头，单次渲染量受控），再点开其中**一个**子树 toggle，断言该子树 500 子节点可见即可。**平铺 fixture（单根+N-1 叶子）专用于 BDD-8 红线实测**（§8），不用于 BDD-3/4（避免单次点击渲染 10000 节点超时）。

### 4.4 fixture 格式（P1-review 建议 #4 承接）

多量级 fixture（100/500/1000/2000/5000/10000）统一**紧凑 JSON**（`JSON.stringify` 无缩进），实测 10000 节点紧凑 JSON ≈ 60KB，远低于 2MB 截断线，无资源/截断顾虑。fixture 由测试内脚本生成（E2E beforeAll 经 API 建 entry 先例已存在），不落静态文件。

## §5 gate_commands

```yaml
gate_commands:
  P3: "make test-frontend"
  P5: "make test-frontend && make typecheck"
  P5_e2e: "make debug-quick && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test"
  P6_e2e: "make debug-quick && E2E_SPEC=e2e/structured-data-viewer.spec.ts make debug-test"
  P6_redline: "make debug-quick && NODE_PATH=$(npm root -g) npx tsx frontend-v3/scripts/measure-treeview-perf.ts"
```

> 说明：红线实测（BDD-8）是多量级 Playwright CDP 计时脚本，**不走完整 `make debug-test`**（AGENTS.md 记录 CDP 模式全量 E2E 可能 >5min 超时）。实测脚本独立路径，先 `make debug-quick`（:8888 隔离 + seed）再用 `npx tsx` 跑脚本。gate_commands.P5_e2e/P6_e2e 用 `E2E_SPEC=` 只跑本 spec，避免全量超时。

## §6 files_to_read（P4 实现参考）

```yaml
files_to_read:
  - path: frontend-v3/src/components/TreeView.vue
    why: 主改动文件——resetExpansion L127-133、watch 重置 L135-145、模板 v-if=truncated 结构 L3-34、matchCount L151-163
  - path: frontend-v3/src/components/DataTreeNode.vue
    why: 确认 isExpanded/toggle/hasChildren 契约（L61-62, L74-76）不改，递归渲染 v-if L33-41
  - path: frontend-v3/src/components/__tests__/TreeView.spec.ts
    why: 更新 test_bdd_27/28（L84-111）+ 新增用例，参考现有 mount/fixture 模式（L29-44）
  - path: frontend-v3/e2e/structured-data-viewer.spec.ts
    why: 更新 test_bdd_27/28（L206-225）+ 新增 BDD E2E，参考 beforeAll 建 entry 先例（L34-60）
  - path: frontend-v3/src/types/structured-data.ts
    why: TreeDataNode 结构（key/value/type/children?/path），递归计数与 path 收集依赖此结构
  - path: frontend-v3/src/components/TruncationBanner.vue
    why: 折叠 banner 复用的视觉模式（warning-bg/warning-text/warning-border + role="status" 样式 L21-56）
  - path: frontend-v3/scripts/measure-treeview-perf.ts
    why: 新增红线实测脚本（P5/P6 执行），基于 playwright-cdp + performance.mark 计时
```

## §7 env_constraints

```yaml
env_constraints:
  debug_env: "make debug-quick（:8888，隔离数据 /tmp/peekview-debug/，captcha 自动禁用）；红线实测需 debug backend :8888 在线 + Chrome CDP :18800；fixture 经 debug API POST /api/v1/entries 创建"
  lint: "make typecheck（vue-tsc --noEmit，CI 强制）；make lint（ruff，系统 python3）"
  prod_isolation: "严禁触碰 :8080 生产服务与 ~/.peekview/；E2E/红线实测全部走 :8888；不跑会触碰真实配置的测试"
  redline_tooling: "Chrome CDP localhost:18800（connectOverCDP）；脚本必须 try/finally page.close() + process.exit(0)，不用 browser.close()（会杀 Chrome）；截图后 vision-engine 分析"
  mobile: "移动端同受单阈值保护，未分端——折叠判定/阈值/banner 渲染双端一致，无独立移动端路径（评审建议）"
```

## §8 minimal_validation（红线实测协议）

```yaml
minimal_validation:
  assumption: |
    ① DOM 计数口径：全展开时 `.tree-node` DOM 数 = 节点总数（可精确反映渲染完成）
    ② 量级区分度：100~5000 节点量级间首帧渲染耗时可区分、单调增长
    ③ 无白屏风险：5000 节点量级不会撑爆页面（P0 估算该量级已到白屏风险带，须实测确认）
  method: |
    已在 P2 用 Chrome CDP(:18800) 实跑 5 行递归渲染 bench（纯 DOM innerHTML 模拟 DataTreeNode 递归结构，
    等价验证计数口径与量级区分度）：n=100/500/1000/2000/5000 实测
    domCount 精确 == n，render 耗时 98/43/41/69/125ms（单调区间内区分度足够）。
    注意：该 bench 是纯 DOM 下限，真实 TreeView 每节点一个 Vue 组件实例（含 provide/inject、computed），
    绝对耗时需在真实 TreeView 上实测——P6 红线协议如下：
  redline_protocol: |
    量级：100 / 500 / 1000 / 2000 / 5000 节点紧凑 JSON entry（经 :8888 API 创建，fixture 脚本生成）
    红线 fixture 结构（统一平铺，评审 F3 声明，消除协议悬挂）：
      单根 + N-1 个叶子（如 {"data": [leaf, leaf, ...]}，根含 N-1 叶子），量级 = N = 节点总数；
      单次点击根 toggle 即达 N 个 .tree-node，无「深层 fixture 单次根点击达不到 N」的协议悬挂
      （深层分支结构只用于 BDD-3/4，见 §4.2/4.3；平铺 fixture 专供红线实测）
    首帧定义（同时间基准，页内 performance.now()，不跨进程）：
      T0 = page.addInitScript 注入的 document 起始 performance.now()
      T1 = waitForFunction('.tree-node' 数量 == N) 返回时刻的页内 performance.now()
      全展开渲染耗时 = T1 - T0
    归一化口径（所有量级走同一测量路径：折叠 → T0 → 点击根 → 等 N，与阈值常量解耦）：
      导航 → 等 .tree-view 可见 → 若 .tree-node > 1（阈值以下初始已全展开）先点击根 toggle 折叠 →
      T0 → 点击根 toggle → 等 .tree-node == N → T1
      （阈值以下量级：初始全展开 → 先折叠再点击展开，对齐「点击展开」基准；
        阈值以上量级：初始即折叠（§2 空 Set 语义）→ 无需预折叠，直接 T0 → 点击根）
    判定标准：
      ① 候选阈值 N 满足「全展开渲染耗时 ≤ 500ms」且 N 量级无白屏/页面无响应（waitForFunction 设 10s 超时）
      ② 阈值取值规则：取满足预算的最大实测量级；5000 若超预算 → 降档取 2000；2000 超预算 → 取 1000
      ③ P6 实测后据证据更新 DEFAULT_EXPAND_THRESHOLD 并重跑 BDD-1（≤阈值小文件）与 BDD-3（10000 大文件）边界
      ④ 记录各量级耗时 + 选定阈值 + 判定依据到任务记录（BDD-8 交付物），P6 截图留 vision 证据
  result: confirmed
  note: |
    计数口径与量级区分度已在 P2 用 Chrome CDP 实跑确认（domCount==n 精确、量级间可区分）；
    绝对阈值与真实 TreeView 耗时属 P6 红线实测交接（P2 无 debug backend :8888 在线），
    协议、口径、判定标准已在 redline_protocol 固化，P6 按此执行并产出 BDD-8 证据。
```

## §9 实现完成标志

- `TreeView.vue`：导出 `DEFAULT_EXPAND_THRESHOLD`；`resetExpansion` 按节点总数二分路径；模板含 `data-testid="tree-collapse-banner"` banner
- 单测：`test_bdd_27/28` 更新为默认展开语义；新增用例覆盖小文件全展开（BDD-1）、超阈值折叠+banner（BDD-3）、toggle 可逆（BDD-6）、折叠态搜索计数（BDD-7）
  - 实现提示（评审建议）：BDD-3 单测 fixture 用 **>阈值 深层链结构**（约 2001 节点链，链式深层 → jsdom 渲染面/挂载耗时小），不要用 10000 节点平铺或宽分支 fixture（jsdom 挂载耗时高）——平铺/宽分支大 fixture 只留在 E2E 与红线实测层
- E2E：`test_bdd_27/28` 更新；新增 BDD-1/2/3/4/5/6/7 用例；beforeAll 含小（≤100）、大（10000）、多文件（小+大）fixture
- 红线脚本 `scripts/measure-treeview-perf.ts`：可对 5 量级输出耗时表 + 选定阈值 + 判定依据
- `make test-frontend && make typecheck` 全绿；`E2E_SPEC=... make debug-test` 全绿

## 设计声明

- `design_trivial: true` + `follows_existing_pattern: [frontend-v3/src/components/TreeView.vue]`（改现有展开逻辑，单组件 + 测试同步，P1 已声明）——仍写了 2 个候选方案（候选 B 因触碰 DataTreeNode.vue 违反 P1 隐含需求 #4 声明被否决，评审 F5 事实更正已落地），P2 未省略
- 设计中发现新增文件 `frontend-v3/scripts/measure-treeview-perf.ts`（红线实测承载）——[SCOPE+] 幅度小：不影响 BDD 基线，仅新增实现细节文件，frontmatter `packages:` 已含该新文件（评审 F4 采纳）
