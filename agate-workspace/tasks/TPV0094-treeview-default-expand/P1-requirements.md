---
phase: P1
task_id: TPV0094-treeview-default-expand
type: problems
parent: P0-brief.md
trace_id: TPV0094-P1-20260814
status: draft
created: 2026-08-14
agent: analyst
# ── v2.0 机器字段 ──
risk_level: low
phases: [P1, P2, P3, P4, P5, P6, P7, P8]
packages:
  - frontend-v3/src/components/TreeView.vue
  - frontend-v3/src/components/DataTreeNode.vue
  - frontend-v3/src/components/__tests__/TreeView.spec.ts
  - frontend-v3/e2e/structured-data-viewer.spec.ts
domains: [frontend]
design_trivial: true
follows_existing_pattern: [frontend-v3/src/components/TreeView.vue]
requires_minimal_validation: true
capability_requirements:
  - need: playwright-cdp-browser
    why: P6 需实测多量级（100/500/1000/2000/5000 节点）全展开首帧渲染时间确定红线阈值
    available:
      - playwright-cdp skill
      - Chrome CDP :18800
    status: available
  - need: multi-scale-json-fixture
    why: 需构造 100~5000 节点量级的 JSON entry 供 P6 实测（现有 t075 E2E beforeAll 经 API 建 entry 是现成先例）
    available:
      - 现有 e2e/structured-data-viewer.spec.ts beforeAll 建 entry 模式
      - 脚本生成 fixture 灌入 debug backend
    status: supplementable
  - need: vision-analysis
    why: P6 截图后视觉确认 UI 状态（折叠提示 / 展开态）
    available:
      - vision-engine skill
    status: available
---

# P1 需求基线 — T094 TreeView 默认展开优化

## 1. 需求复述

详情页 TreeView（JSON/YAML/XML 结构化数据查看器）当前默认只展开根节点（`TreeView.vue` `resetExpansion()` 只把根 path 加入 `expandedPaths`），小文件也要手动逐层点开，体验繁琐。用户需求：

1. **默认全部展开**：小/中文件打开即全部节点可见，一眼看完。
2. **性能保护**：节点总数超过实测红线时，降级为默认折叠 + 显示"内容较大，已折叠部分"类提示，用户仍可手动逐层展开。
3. **红线实测**：红线阈值不是拍脑袋，须用 Playwright CDP 对不同节点量级实测首帧渲染时间后据实确定（预估 2000~5000 区间，P0-brief known_risks）。

本次是纯前端改动，不动后端/API/MCP/数据。

## 2. 隐含需求识别

| # | 隐含需求 | 为什么必须 | 影响面 |
|---|----------|-----------|--------|
| 1 | **同步更新现有断言"默认折叠"的测试** | 单测 `TreeView.spec.ts:84-111`（test_bdd_27/28）和 E2E `e2e/structured-data-viewer.spec.ts:206-225`（test_bdd_27_expand_node / test_bdd_28_collapse_node）都断言初始 `aria-expanded="false"`。默认全展开后这些用例必挂（FAIL），必须改成适配新默认态的断言 | P4/P5/P7 范围；**改动不再是单文件**（TreeView.vue + 2 个测试文件） |
| 2 | 切文件/切格式后按新内容重新决定展开态 | 现有 `watch([content, format])` 会清空 `expandedPaths` 并走 `resetExpansion()`——新的默认展开逻辑必须落在该重置路径里，否则多文件 entry 切换后状态错乱 | TreeView.vue resetExpansion + watch |
| 3 | 总节点数统计口径需覆盖递归子树 | 阈值判断基于"节点总数"（含所有层级），不是顶层节点数——否则单根含 5000 子节点的数组会被误判为小文件 | 节点计数实现（P2/P4） |
| 4 | 大文件折叠态下交互仍可用 | 折叠只是默认态，用户必须能手动展开任意层（现有 toggle 机制保留），否则大文件等于不可读 | DataTreeNode.vue 不改，toggle 契约不变 |
| 5 | 折叠提示的展示与 2MB 截断提示不冲突 | 已有 `TruncationBanner`（>2MB 截断）走 `truncated` 分支，与 TreeView 渲染互斥。折叠提示是**渲染路径内**的新提示，两者语义不同、路径不同，需互不干扰 | TreeView.vue 模板 |
| 6 | 搜索行为不回归 | `matchCount` 遍历全树不依赖展开态，折叠态下搜索计数仍应正确（命中节点若被折叠隐藏，高亮不显示但计数存在——现有行为，保持即可） | TreeView.vue matchCount |
| 7 | 红线阈值本身是交付物 | "据实定阈值"意味着 P6 必须产出测量证据（各量级首帧时间 + 选定阈值 + 判定依据），写进任务记录 | P6 证据 |
| 8 | 空输入/标量根/无子节点根不崩 | 现状 `resetExpansion` 对 `treeData.length===1 && 有 children` 才有根 path，其余空 Set。全展开逻辑需对空树、标量叶子、无 children 根安全（无东西可展开即空） | TreeView.vue 边界 |

## 3. BDD 验收条件

### 默认全展开（小文件）
#### BDD-1: 小 JSON 默认全部展开
- Given 打开一个节点总数远小于红线（如 ≤100 节点，与红线预留量级余量）的 JSON entry
- When TreeView 完成渲染
- Then 所有含子节点的行 `aria-expanded="true"`，且渲染出的 `.tree-node` 数量等于该 JSON 的节点总数（深层叶子无需点击即可见）

#### BDD-2: 小 YAML / 小 XML 同样默认全展开
- Given 打开一个节点总数远小于红线的 YAML entry（或 XML entry，各自独立验证）
- When TreeView 完成渲染
- Then 全部节点默认可见：含子节点行 `aria-expanded="true"` 且 `.tree-node` 数量等于节点总数

### 超红线降级折叠（大文件）
#### BDD-3: 超红线大 JSON 默认折叠并显示提示
- Given 打开一个节点总数远超红线上限余量（如 10000 节点）的 JSON entry
- When TreeView 完成渲染
- Then 页面出现"内容较大，已折叠部分"类提示文案，且渲染出的 `.tree-node` 数量小于该 JSON 的节点总数（部分层级未渲染，默认未全展开）

#### BDD-4: 大文件折叠态下仍可手动展开
- Given 已按默认折叠显示的大 JSON（BDD-3 场景）
- When 用户点击某个未展开的含子节点行的展开箭头
- Then 该行 `aria-expanded` 变为 `true` 且其子节点渲染可见

### 切换文件重置
#### BDD-5: 多文件 entry 切文件后按新文件大小重新决定展开态
- Given 一个多文件 entry 同时含小 JSON 与大 JSON（节点数分居红线两侧）
- When 用户从大文件切换到小文件
- Then 小文件按自身节点数重新决定：全展开可见，不继承上一文件（大文件）的折叠状态

### 交互不回归
#### BDD-6: 展开态下手动折叠/再展开可逆
- Given 小 JSON 已默认全展开
- When 用户点击某含子节点行展开箭头一次，再点击一次
- Then 第一次点击后该行 `aria-expanded="false"` 且子节点隐藏；第二次点击后恢复展开且子节点可见

#### BDD-7: 折叠态下搜索计数不受影响
- Given 大 JSON 已按默认折叠显示
- When 用户在搜索框输入存在于被折叠子树的匹配关键词
- Then 搜索匹配计数显示非零（`aria-live="polite"` 计数正确，遍历不依赖展开态）

### 红线实测（P6 验收）
#### BDD-8: 红线阈值据实测定并记录证据
- Given 红线阈值未定（预估 2000~5000）
- When P6 用 Playwright CDP 对 100/500/1000/2000/5000 节点量级的 JSON entry 分别实测全展开首帧渲染时间（页面导航至 `.tree-node` 渲染完成）
- Then 任务记录各量级首帧时间、据此选定的阈值及判定依据；实测覆盖到 5000 节点且该量级不出现白屏/页面无响应

## 4. 待确认清单

[NO_NEED_CONFIRM]
无阻塞项。方向性判断（是否默认全展开、是否折叠+提示、红线实测确定）均已由用户确认（P0-brief 核心需求）。

[SUGGEST: 实现采用单一可配置常量（如 `DEFAULT_EXPAND_THRESHOLD`），值由 P6 实测后定，倾向取实测安全上限；不做自适应复杂度]
[SUGGEST: 折叠提示样式复用 `TruncationBanner` 的视觉模式，文案用"内容较大，已折叠部分"（用户已确认文案方向，具体样式 P2 定）]
[SUGGEST: 大文件折叠态下搜索命中节点自动展开属超出本次范围的增强，本次不做，留作后续 backlog]

## 5. 裁剪说明

`phases: [P1, P2, P3, P4, P5, P6, P7, P8]`，全走，无裁剪。

- **P3 保留**：新增节点计数 + 阈值判断逻辑有可测行为（BDD-1/3 可单测）。
- **P6 不可裁**：红线须实测（BDD-8），`ui_affected: true`。
- **P7 保留**：dispatch 允许"仅改 TreeView.vue"时裁 P7，但隐含需求 #1 确认本次必然改动 `TreeView.vue + TreeView.spec.ts + e2e/structured-data-viewer.spec.ts` 三个文件——不满足单文件条件，P7 跨文件一致性检查保留。

## 6. 能力需求声明

见 frontmatter `capability_requirements`（三态判定）：

- `playwright-cdp-browser`：**available**（playwright-cdp skill + Chrome CDP :18800 已配置）
- `multi-scale-json-fixture`：**supplementable**（沿用现有 `e2e/structured-data-viewer.spec.ts` beforeAll 经 API 建 entry 的先例，或脚本生成）
- `vision-analysis`：**available**（vision-engine skill）

无 GAP，不触发 `[CAPABILITY_GAP]`。
因红线判定依赖浏览器渲染行为，frontmatter 已标 `requires_minimal_validation: true` → P2 须产出 `minimal_validation` 块（实测协议），result 为 confirmed 后方可定阈值。
