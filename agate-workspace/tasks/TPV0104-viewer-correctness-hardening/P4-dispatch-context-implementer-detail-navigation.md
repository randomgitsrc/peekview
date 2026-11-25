---
phase: P4
generated_by: agate-inject-card.py + 主 Agent
task_id: TPV0104
role: implementer
batch: detail-navigation
---

<dispatch_guide>
> ⚠️ 以下派发指引是本次任务的强制指令，不是参考信息。执行优先级：派发指引 > 客观查证信息 > 阶段卡片（参考规范）

### 目标

**P4 第 3 批 `detail-navigation`（complexity: high）**：实现默认入口 resolver 单点（D3）+ `?file=` 持续态机制替换（D4）+ 删死代码（BDD-47）+ **全屏入口 I/O 链（D5）与 zen 侧栏 DOM 移除** + 接通 `data-viewers` 批留下的两个 prop。

> **范围含 D5**：P2 的 `dispatch_plan` 把全屏入口相关 4 个文件都划给本批。原 `detail-outline` 派发误覆盖了它们，已纠正——**这部分由你实现**。

**不得修改 P3 的测试文件**（`tpv0104-*`）——它们是验收依据。

### ⚠️ 核心铁律（RM-AG0107 / DEBT0054）
契约优先于既有测试全绿。设计要求与既有测试冲突时必须实现设计要求并同步更新受影响测试。若认为设计有误 → `[CLARIFY: …]` 停下报告主 Agent。

> **本批已知会触及的既有测试**：`t031-entry-detail-view.spec.ts` / `t067-detail-framework.spec.ts`（前者 mock 了 `extractHeadings`、后者有 `mockActiveFile.value = entry.files[0]` 之类）。按 RM-AG0107 更新。

### ⚠️ 本批必须接的两处 prop（`data-viewers` 批留下的跨批待办）

`data-viewers` 批给 `HtmlViewer`/`TreeView` 加了可选 `file`/`size` prop，但**调用点在 `EntryDetailContent.vue`**（属本批 output），它按批间隔离没碰。**你必须补上**，否则真实字节判定在生产路径不生效、BDD-42/44 的 E2E 会红：
- `EntryDetailContent.vue` 的 `<HtmlViewer ...>`（约 `:54`）加 **`:file="activeFile"`**
- `EntryDetailContent.vue` 的 `<TreeView ...>`（约 `:62`）加 **`:size="activeFile.size"`**
> 该文件本批**本来就要改**（zen 侧栏已在 `detail-outline` 批处理，但 prop 接线归你），不构成范围扩张。

### 本批要实现的 P2 设计（逐条）

#### A. 默认入口 resolver 单点（D3）
1. **新建 `frontend-v3/src/utils/default-file.ts`**：
   ```ts
   export function resolveDefaultFile(files: File[]): File | null
   ```
   - 规则（P0 决策 7.2）：**根 `README.md`（大小写不敏感）> 根 `index.md` > 稳定排序首个**
   - **根判定**：`effectivePath = (path 非空 ? path : filename)`；`effectivePath` **不含 `/`** 才是根
   - **匹配键**：`basename(effectivePath)`；子目录项**永不被选中**
   - **排序**：`path` 非空取 `path`、否则 `filename` 的字典升序；同键按 `id` 升序
   - **单测要点（eng G7，护住 R10）**：`{path:'sub', filename:'README.md'}` 必须返回**回退项**而非该 README（`path='sub'` 落盘为根级文件 `sub`，basename 非 readme → 不选中）；另补真嵌套 `{path:'sub/README.md'}` 的非根用例。两条都断言返回值的 `id`。
   > **注意**：若 `detail-outline` 批已先创建了 `default-file.ts` 的最小版（它在 `handleFullscreen` 里需要 `resolveDefaultFile`），**你要在此补齐完整规则 + 单测**，并在 `P4-implementation.md` 记 `[DESIGN_GAP]` 说明。
2. **`stores/entryDetail.ts`（`:49-53`）**：`entry.files[0]` 两处兜底 → `resolveDefaultFile(entry.files)`。这是**唯一消费点**（详情页三条来源最终都汇聚到 `loadEntry`）。
3. **删死代码（BDD-47）**：
   - `EntryCard.vue`（`:150-152`）：**删除** `files?.[0]?.id` 分支，导航统一 `router.push('/' + slug)`
   - `EntryListRow.vue`（`:153-155`）：同样删除
   > 这两处是**死代码**（`client.ts:91-99` 的 `transformListItem` 硬编码 `files: []`，故 `files[0]` 恒 `undefined`）。**是删不是修**。

#### B. `?file=` 持续态机制替换（D4，**本批最核心**）

4. **`normalizeFileQuery` 纯函数**（放 `default-file.ts` 或新建 `utils/file-query.ts`）：
   ```ts
   export function normalizeFileQuery(
     query: Record<string, string | string[]>,
     activeFileId: number | null,
     defaultFileId: number | null,
   ): Record<string, string | string[]>
   ```
   - 恒保留非 `file` 键（**含 `share`**）
   - 默认文件 → **无 `file` 键**；非默认 → `file=<id>`（**字符串**）
   - **删参数用「键不出现」而非 `null`**——实测 `file: null` 会得到 `?file`（空值键仍在 search 里），会让 BDD-20 的「不含 `file=`」断言变脆
5. **`EntryDetailView.vue`** 按 D4 的时机表实现：

| 时机 | 行为 |
|---|---|
| 首次加载 | 读 `route.query.file`（`Number` 转换 + `Number.isInteger` 校验，失败即 `undefined`）→ `loadEntry(slug, fileId, shareToken)` |
| 加载后归一 | `suppressUrlSync = true` 期间；完成后按「当前是否默认文件」决定 URL |
| **一次性参数清理** | **只删 `firstFileId`**（白名单化）；**`file` / `share` 一律保留**（BDD-22/51） |
| 页内切换 | `watch(activeFile.id)` → `router.replace` + **合并** query（`{...route.query}`）；非默认写 `file`、默认删 `file`；**不新增历史**（BDD-19③） |
| 刷新 | 走首次加载路径 → 保留 `file`（BDD-21） |

   > **现状必须改掉**：`EntryDetailView.vue:238` 的 `router.replace({ path: route.path, query: {} })` 是**一锅端清空全部 query**（会误删 `file`/`share`）。这是 BDD-22 要修的核心。
   > **必须显式合并**：实测 `router.replace({query:{file:'99'}})` 会**丢弃 `share`**；`{...route.query, file:'99'}` 才保留。
6. **`number` 校验**：`?file=<非数字>` → `Number` 得 `NaN` → `Number.isInteger` false → `undefined` → 回退默认入口（BDD-18）。
7. **无效/跨 entry 回退**：`loadEntry` 内 `entry.files.find(f => f.id === fileId) ?? resolveDefaultFile(entry.files)`。跨 entry 的 id 查不到 → 自然回退（BDD-17）。**静默回退、不给可见提示**（P1 BDD-16②/18② 明确要求「无错误横幅、不白屏」）。

#### C0. ⛔ TOC 数据链接线（**必修，否则真实页面 TOC 永远为空**）

> **这是 `detail-outline` 批完成的必然连带，落点在本批的两个文件里。主 Agent 原派发漏写了这条，现补上。**
>
> **背景**：`detail-outline` 已按 P2 `:106` 把 `tocHeadings` 从 computed（逐行正则）改成 `ref<TocHeading[]>` + `setTocHeadings(list)` 容器，并删除了 `extractHeadings`。**但全仓当前无一处调用 `setTocHeadings`** → `tocHeadings` 恒为 `[]`。
>
> **后果（若你不补）**：真实页面 TOC 永远空 → 桌面默认展开失效（`v-if="tocHeadings.length > 0"` 永假）→ **E2E 的 BDD-01/02/03/04/05/06/52 全红**。而 **vitest 看不出来**（`t031`/`t067` 把 `useEntryDetailComputed` 整个 mock 掉了）→ 单元测试全绿 ≠ 这条链通。

**P2 `:191` 规定的数据流（三段，缺一即断）**：
```
MarkdownViewer  --emit('headings')-->  EntryDetailContent  --透传-->  EntryDetailView  --> setTocHeadings()
```

要改两处（**都在你的 output 内**）：

1. **`EntryDetailContent.vue`**（约 `:56`）：把传给 `<MarkdownViewer>` 的
   `:headings="tocHeadings"` 与 `@select-heading="$emit('scroll-to-heading', $event)"` **删除**，改为
   **`@headings="$emit('toc-headings', $event)"`**（把子组件 emit 出来的 `TocHeading[]` 向上转发）；
   同时在其 `defineEmits` 里加 **`'toc-headings': [headings: TocHeading[]]`**（并删掉不再使用的 `'select-heading'`）。
   > P2 `:107` 明确：`MarkdownViewer` 的 `emit('headings')` **保持不变**，`select-heading` 是**无用**的（要删）。

2. **`EntryDetailView.vue`**：在 `<EntryDetailContent>` 上加
   **`@toc-headings="setTocHeadings"`**，并从 `useEntryDetailComputed(...)` 的返回值里取出
   **`setTocHeadings`** 一并解构。

**自查方式（必须做，单测抓不到）**：
```bash
# 全仓必须有至少一处调用
grep -rn "setTocHeadings" frontend-v3/src --include=*.vue --include=*.ts | grep -v "useEntryDetailComputed.ts"
```
应命中 `EntryDetailView.vue` 的**至少一处**（`@toc-headings="setTocHeadings"`）。若只有 `useEntryDetailComputed.ts` 自身定义 → 说明你没接上。

> 另：`t031`/`t067` 的 mock 里还留着 `extractHeadings: vi.fn()`（它已不再导出）。**多余属性的 mock 不会报错**，但你按 RM-AG0107 更新它们时**顺手删掉那行**。

**3. ⚠️ 连带必改：桌面 TOC「默认展开」的时序已失效（`detail-outline` 实测发现）**

`EntryDetailView.vue:242-246` 现有实现是：
```ts
await nextTick()
if (isDesktop.value) {
  if (entryDetailStore.isMultiFile) isFileTreeOpen.value = true
  if (isMarkdown.value && tocHeadings.value.length > 0) isTocOpen.value = true
}
```
但 `tocHeadings` 现在**改为 `ref` + `setTocHeadings()`**，数据是 **`MarkdownViewer` 渲染完成后经 emit 异步到达**的——`onMounted` 里那个 `nextTick` 时点 `tocHeadings.value.length` **仍是 0** → 桌面默认展开**永不触发**。

**正确形态**（P2 的 R 系列已隐含要求，`detail-outline` 给出了确切改法）：
```ts
const userToggledToc = ref(false)     // 用户手动开/关过就不再自动接管

watch(tocHeadings, (list) => {
  if (!isDesktop.value) return
  if (userToggledToc.value) return
  if (isMarkdown.value && list.length > 0) isTocOpen.value = true
}, { flush: 'post' })                  // flush: 'post' 保证 DOM 已更新

// 在「用户点击 TOC 按钮」的处理里置 userToggledToc = true
```
> **判据依据**：P1 的 TOC 类 BDD（01–06/52）都要求**桌面默认展开**、且**用户点击后按用户意愿**。`userToggledToc` 是必要的——否则用户手动关闭 TOC 后，任何一次 `tocHeadings` 变化（如切换文件）都会把它重新打开。


#### C. 全屏入口 I/O 链 + zen 侧栏 DOM 移除（D5，**从 `detail-outline` 批移交过来，本批必须做**）

> **说明**：这批文件（`EntryDetailView.vue` / `EntryDetailContent.vue` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue`）在 P2 的 `dispatch_plan` 里本就归**本批**，原 `detail-outline` 派发误覆盖了它们，已纠正。**所以这部分由你实现，不与任何批重叠。**

8. **`EntryDetailHeader.vue`**：
   - `defineProps` 加 `activeFile?: File | null`（`withDefaults` 默认 `null`）
     > ⚠️ **`File` 必须 `import type { File } from '@/types'`**（或从现有 types 导入），否则被解析成 DOM 的 `File` → **TS2322**
   - `defineEmits` 加 `'fullscreen': []`
   - `.actions-area` 内新增 `icon-btn`（`Maximize` / `:size="16"` / `aria-label="全屏阅读"` / `data-testid="detail-fullscreen-btn"` / `<span class="tooltip">全屏阅读</span>`）
     - **显隐守卫（M2，必须）**：`v-if="currentEntry && activeFile"`——实测 404 页 `.actions-area` 仍渲染（DOM 1）而 `activeFile` 为 `null`，无守卫会点击执行 `activeFile.id` 抛 **TypeError**
     - **图标 16px 理由**：跟随既有 `.icon-btn` 兄弟按钮（`CopyIcon`/`Share2Icon`/`Star` 都是 `:size="16"`）。**不要**引用 `DESIGN.md §7` 论证（§7 compact 档 18px，既有代码与 §7 本就有偏差，本任务**不修正**）
     - **变体 `.icon-btn`**：按 `DESIGN.md:162` Selection rule，全屏是 stateless one-shot action（非持久 on/off）
     - **不设 `disabled`**：用 `v-if` 让元素「不存在」而非「存在但灰」（`v-if` 即禁用态）
     - **过渡**：继承既有 `.icon-btn` 的 `transition: all var(--transition-fast)`，**不加自定义**
9. **`EntryDetailMobileBar.vue`**：
   - props 加 `activeFile?: File | null`、emits 加 `'fullscreen': []`
   - 左簇新增同型 `icon-btn`（`data-testid="mobile-bar-fullscreen-btn"`）
   - **间距收窄（M1/R7，必须）**：scoped `.mobile-bottom-bar { gap: var(--space-2) → var(--space-1) }`（8px→4px）。**`layout.css:538` 的 `gap: 4px` 不要动**（已被 scoped 覆盖、不生效）。实测 @360：`gap 8px` 溢出 10px → `gap 4px` 溢出 0（spacer 余 5.39px）
   - **移动端只给 `aria-label`、不加 tooltip**（M6，跟随既有底栏形态；实测既有按钮 `tooltipCount = 0`）
10. **`EntryDetailView.vue`**：
   - `<EntryDetailHeader>` 加 `:active-file="activeFile"` + `@fullscreen="handleFullscreen"`
   - `<EntryDetailMobileBar>` 加 `:active-file="activeFile"` + `@fullscreen="handleFullscreen"`
   - 新增 `handleFullscreen()`：
     ```ts
     const isDefault = activeFile.id === resolveDefaultFile(currentEntry.files)?.id
     const query = { ...route.query }                 // 保留 share
     if (isDefault) delete query.file; else query.file = String(activeFile.id)
     router.push({ path: `/${slug}/f`, query })
     ```
     > 可直接复用你本批做的 `normalizeFileQuery`（`normalizeFileQuery(route.query, activeFile.id, resolveDefaultFile(currentEntry.files)?.id)`）——**这样与 URL 归一逻辑同源，避免双源**。
11. **zen 侧栏 DOM 移除（BDD-28 / BDD-53③）**：`EntryDetailContent.vue` 注入 `ZenModeKey`，两个 desktop `<aside>`（`.file-sidebar` `:4`、`.toc-sidebar` `:78`）的 `v-if` 各加 **`&& !zenMode`**。
    > 现状两者是「DOM 存在 + 全局 CSS `display:none`」；改为 DOM 0 后全局 CSS 规则对它们失效但**保留**（继续服务 `.detail-header` 等 `v-show` 项）。**不要删全局 CSS 规则**。

### 必须自查

本批 `tests_filter`（在 `frontend-v3/` 下）：
```
npx vitest run src/utils src/components/__tests__/t031-entry-detail-view.spec.ts src/components/__tests__/t067-detail-framework.spec.ts
```
- 本批红灯（`tpv0104-default-file`、`tpv0104-source-scan` 的 BDD-47 项）应转绿
- **`make typecheck` 必须 exit 0**
- 既有契约：`t031` / `t067` 若因设计要求转红 → 按 RM-AG0107 更新并逐条列出

### 环境隔离（强制）
- 只用 `:8888`（**严禁** `:8080`、**严禁** `~/.peekview/`）
- 状态标记二值：`[PROD_TOUCHED]` / `[PROD_NOT_TOUCHED]`
- 造/删 entry 只经 debug HTTP API、**禁 CLI**、用完即删（用 slug）、须同时给 `path` + `filename`
- 临时文件放 `<项目根>/.agate-tmp/`（**不用 `/tmp`**）
- **不要 commit**；**不要改 P3 的 `tpv0104-*` 测试**
- **只改本批 output 的 8 个文件**（+ 新建 `utils/default-file.ts` 与/或 `utils/file-query.ts`）。`backend-render-budget` 可能仍在改 `backend/` → 不要碰

### 产出
- 代码落地 `frontend-v3/src/`
- `TASK_DIR/P4-implementation.md` 追加本批章节
- 每完成一个模块立刻往 `TASK_DIR/P4-progress.md` 追加一行

### 输入文件
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P2-design.md`（**1070 行**；本批依据：D3 全节 `:296`、D4 全节 `:303`、D9 测试标识表）
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P3-test-cases.md`
- `{AGATE_WORKSPACE}/tasks/TPV0104-viewer-correctness-hardening/P1-requirements.md`（本批相关 BDD：08-22、47、49-51）
- `{project_root}/AGENTS.md`（铁律：**前端 URL 路径是 `/:slug` 不是 `/entries/:slug`**）
- 源码：`frontend-v3/src/{stores/entryDetail.ts,views/EntryDetailView.vue,components/{EntryDetailContent,EntryCard,EntryListRow}.vue}`、`frontend-v3/src/api/client.ts`（`:91-99` 看死代码根因）

</dispatch_guide>

<!-- AGATE_CARD_START -->
## 当前阶段卡片：P4

路径：phase-cards/P4-implementation.md
---
# P4 — 代码实现

> 当前状态：[首次 / 重试 #N / 裁剪跳阶]
> 裁剪跳阶 → 确认 P1 phases 不含 P4 且有合规理由（check-pruning.py 已检查）→ 跳过，读 P5 卡片

## 如果是首次进入本阶段

0. 跑 `agate-capture-env-baseline.py $TASK_DIR`（自动捕获环境基线）。
   该步骤不会阻塞流程——任何 stderr 输出（含 WARNING）均可忽略，直接继续步骤 1，
   无需查看结果、无需判断、无需因为看到 WARNING 而停下来处理。

**创建型测试清理钩子（强制要求，与 P3 卡同源）**：实现含创建资源用例时，须落地清理钩子——创建即注册、测试结束无条件删除（不因响应非 2xx 中止删除）、删除接受 200/204/404 为已清理（afterEach 清理队列模式）；只修 P3 卡不修本卡即复发，两处须同步。

1. 派发 implementer subagent → 产出代码文件
   1.1 写 P4-dispatch-context-implementer.md（派发指引：目标/约束/上游关联/输入文件 + 客观查证信息）
2. 按 P2 的 gate_commands 跑单元测试（非 gate，只是自查）
3. 按 C8 映射表派发评审（见下方）
4. 预跑 check-gate.py P4（确认暂存区有代码文件）
5. git add {AGATE_WORKSPACE}/tasks/{Txxx}/ + 代码文件（含 .state.yaml，若 .gitignore 忽略需 git add -f）
   ⚠️ 此时 .state.yaml 的 phase 保持 P4，不要提前写 P5——phase = 本 commit 的产出阶段
6. git commit -m "wf({Txxx}-P4): {摘要}"（phase=P4，P4 产出含 P4-implementation.md + 代码文件）
7. P4 commit 完成后进入 P5：**phase 推进 P5 随 P5 产出 commit 一起**（P5-test-results/ 就绪后），不是单独 phase commit

## 如果是重试

确认上一轮失败原因（来自 gate 输出 / review rejected 理由）
→ 只修复失败项，不重做已通过的部分
→ 修复后重跑全量测试（T027 教训：修复可能引入回归）
→ 读 agate/rules/state-transitions.md 确认 retry 上限（P4 MAX=3）

**若这次是从 P6（或其他更后的阶段）退回来的**：`{AGATE_WORKSPACE}/tasks/{Txxx}/` 下不会再有旧的 P6-acceptance.md（已被归档），但当初具体是哪条 BDD 失败、失败原因是什么，会摘要在 `{AGATE_WORKSPACE}/tasks/{Txxx}/.retreat-history.md` 里——**重新派发 implementer 时，dispatch-context 必须引用这份摘要**，不能让 implementer 只看到"现有代码"却不知道具体要修哪里。已有代码不会被撤销、也不需要重新实现，是在已有实现基础上定向修复。**回退落地后必须建 DEBT 条目**（`source: retreat`，`evidence` 引用 retreat 提交哈希，模板 `assets/templates/tech-debt-template.md`——TAG0001 强制，见 `agate/rules/state-transitions.md` 回退规则节）。

## 前置条件

- [ ] P2-design.md 存在且 files_to_read 字段完整（导航清单）
- [ ] P2-review.md status: approved（P2 不可裁剪）
- [ ] P3-test-cases.md 存在（测试已设计）
- [ ] check-tdd-red.py 确认红灯（测试先于实现）
- [ ] 未跳过 P4（如有裁剪理由，见上方裁剪跳阶）

## 派发

- **角色**：implementer（`{agate_root}/assets/execution-roles/implementer.md`）
- **输入**：P2-design.md（files_to_read 导航 + gate_commands）+ P3-test-cases.md + P0-brief.md（env_constraints）
- **输出**：代码文件（在 P4-implementation.md 声明的 implementation_dir 下）
- **派发 prompt 模板**：`{agate_root}/assets/templates/dispatch-prompt.md` + 以下阶段特定追加：

```
## 上下文控制
读取代码文件以 P2-design.md 的 files_to_read 清单为准，按需读取（标了行号范围的只读片段）。
不要在项目里盲目搜索或整目录全读。

## 自查≠gate
写完代码后应自跑测试确认基本功能（自查），但自查通过 ≠ P5 gate 通过。
P5 由主 Agent 派发 verifier subagent 执行 gate_commands.P5，主 Agent 验 gate（检查产出 + failed 计数 + N5 最小校验）。
不要在返回中声称"P5 已过"或"全部测试通过"——只返回路径 + 摘要。
UI/前端等需构建任务：单元测试全绿不代表可用，implementer 在 P4 完成后应构建并确认 dist 等构建产物存在，不能只跑单元测试就认为完成。
**这是本卡明确的 checklist 条目**（RM-AG0083 / DEBT0015 的落点）：`gate_commands` 声明了**构建 / 打包 / 部署**类命令时，P4 完成后须**实际产出并确认产物存在**（如 UI 任务的 `dist`）；协议**无**对应机械 gate（产物路径项目各异）⇒ 该条目即「无机械 gate 时的既定出口」，主 Agent 在 P4 gate 前逐项确认，不得只凭单元测试全绿判完成。

## 生产环境隔离
任何写入生产环境/生产数据库/生产 API 的操作都必须先 PAUSED 报告人工。
```

## 产出规格

- P4-implementation.md 必须声明 `implementation_dir: {实际路径}`
- 代码文件在声明的目录下
- 遵守 P2-design.md 的方案设计 + 现有项目代码规范

## 批级证据 P4-evidence（MVWU 阶段 1，不阻断，TAG0036）

> 适用于 P2 声明了 `dispatch_plan.batches` 的任务：每批一个证据日志，回答"这一批的 `tests_filter` 跑出了什么"。**记录不阻断**——它不是 gate、hook 或 CI 的一部分，非零退出的批仍可 commit。

- **路径**：任务目录下 `P4-evidence/{batch}.log`。`{batch}` = 该批在 `dispatch_plan` 中的 `id`，须 filename-safe（匹配 `[A-Za-z0-9._-]+`）。
- **写入方**：主 Agent 在该批 commit 前运行该批 `tests_filter`，并把运行结果**机械转录**入日志（重定向/脚本落盘，不是撰写内容；内容只来自命令实际结果）。
- **格式**：逐行 `key: value`，最小内容：
  - `command`：实际运行的命令
  - `exit_code`：命令退出码
  - `git_head`：运行时的 HEAD，须为全长 commit 对象名
  - `timestamp`：运行时间
  - `expected_red`：预期为红的用例，默认 `[]`
  - `duration_seconds`：耗时秒数
  - `failed_tests`（可选）：实际失败的用例，默认 `[]`
- **列表编码**：`expected_red` / `failed_tests` 的值为单行 flow 序列，元素为用双引号包裹的 pytest node id（如 `["tests/a.py::test_x[case 1]"]`）；元素相等按 node id 精确字符串相等比对，不可解析时观测器给 UNKNOWN。
- **观测**：`python3 agate/scripts/check-mvwu.py <task_dir>`（默认每批一行契约行）或 `--observe`（每批一行观察表）。观测**不阻断**；UNKNOWN 不等价于 PASS——无法核对时不得当作通过。
- **边界**：该目录不进 judge 白名单，也不登记进 rules / dispatch-protocol；P6.5 judge 不读取它。

## 新增文件核对表

> 仅当项目已采用骨架（`P2-skeleton.md` 存在）或 CODE-MAP（`{AGATE_WORKSPACE}/agents/CODE-MAP.md`
> 存在）机制时填写；未采用则本节可省略。

implementer 为本阶段**每个新增文件**填一行：

| 新增文件路径 | 骨架归属 | CODE-MAP 处理 |
|------------|---------|--------------|
| {path} | `within <dir>` / `[SKELETON_DEVIATION: 理由]` | `[CODE_MAP_UPDATED]` / `[CODE_MAP_EXEMPT: 理由]` |

- **骨架归属列**：新增文件落在骨架声明的目录内 → `within <dir>`；落在骨架外 → 标
  `[SKELETON_DEVIATION: 理由]`（不阻断，供 P7 核对）
- **CODE-MAP 处理列**：新增文件已同步更新 `agents/CODE-MAP.md` → `[CODE_MAP_UPDATED]`；判断
  该文件不需要更新 CODE-MAP（如临时/测试脚手架）→ `[CODE_MAP_EXEMPT: 理由]`

`change_type: refactor` 同样适用本表（不因换用回归口径而豁免）。

## 评审派发（C8 机械映射）

**在 P4 实现完成后、gate 前**，按 P1 声明的 domains 和 risk_level 派评审。C8 映射表是机械规则，不靠判断"需不需要"：

| domain | 派哪些评审 | 产出 |
|--------|----------|------|
| backend | review | P4-review.md |
| frontend | design-review | P4-review.md |
| mcp | review（关注 MCP 接口契约）| P4-review.md |
| security | cso | P4-review.md |
| risk=high | P4 实现评审（按 domains 派 review/design-review/cso；P2 plan-eng-review 已审方案，P4 实现评审不可省）| P4-review.md |
| full（tier=full 或声明 ceremony: full）| P4 实现评审（按 domains 派 review/design-review/cso，同 risk=high 不可省；P2 plan-eng-review 已审方案）+ cso（security 域）+ P7 不可裁（full 档任务 P7 为强制阶段）| P4-review.md |

多个评审角色 `专家组并行` → 所有返回后派组长汇总 → 统一 P4-review.md（status: approved / rejected）。
详见 `agate/rules/review-mapping.md`。

**并行派发**（多个评审角色时）：
1. 同时派发所有触发的评审 subagent（每个一个 task 调用）
   > **操作方式**：在一个 assistant 消息中连续发起多个 task 工具调用（每个评审角色一个）。
   > 不要等前一个 task 返回再发下一个——那是串行，不是并行。
   > 平台会并行执行多个 task，全部返回后再进入下一步（派发组长汇总）。
2. 每个评审 subagent 各写一个 dispatch-context + 各自产出文件
3. 所有评审返回后，派发组长汇总 subagent（角色：review + 指定为「专家组组长」）
4. 组长产出：P4-review.md。**agent 字段必须非 main**（与 P2 评审同规则，check-gate.py 在 P2 分支硬拦截 agent=main 的 approved）
5. 组长规则：不发表新意见，只汇总；任何 BLOCKER → rejected；分歧 → 交人工；全票无 BLOCKER → approved

**单评审角色时**：直接派发，无需组长汇总，产出直接写 P4-review.md。

**评审 checklist（RM-AG0046）**：`agate/scripts/check-maintainability.py` 检出 violations 非空时，评审角色 approve 前必须读过任务目录 `known-violations.md` 的登记理由——"是否接受该反模式"的判断权在评审角色，登记与数量对齐不单独构成放行依据。

review 不通过 → implementer 修改代码 → 再 review → … → approved（⑩迭代循环，review 和 gate 重试共享 retry 预算）

## 按包拆分并行（条件触发，需额外约束）

> 仅当 P2 packages > 1 且包间无依赖时适用。单包任务跳过本节。
> 并行上限 / 失败批 retry / 共享文件统一后处理见 dispatch-protocol「派发编排机制」并行规则。

当 P2 声明多个 packages 且包间无数据依赖时，P4 可拆分并行，但**有额外约束**：

1. 每个 package 派一个 implementer subagent
2. **各 implementer 只改自己 package 目录下的文件**——跨包的共享文件（类型定义、接口、配置）由主 Agent 在所有并行 implementer 返回后统一处理
3. 各自返回路径 + 摘要
4. 主 Agent 汇总后统一 commit
5. 主 Agent 在所有 implementer 返回后，统一处理共享文件改动（如果有）

**冲突预防**：
- dispatch-context 约束节必须写明：`只改动 {pkg}/ 目录下的文件。共享文件（{列出}）不在本次改动范围内`
- 如果某个 implementer 必须改共享文件 → 该包不能并行，改为串行（主 Agent 先派其他包并行，再串行处理含共享改动的包）
- 无法确定是否有共享改动 → 串行（安全默认值）

**基础设施隔离（并行时强制）**：
- debug server 端口：每个 implementer 的 dispatch-context 约束节分配不同端口（如 pkg-a: 3001, pkg-b: 3002）
- 测试数据库：每个 implementer 用独立数据库路径（如 `test-{pkg}.db`），不共享同一 test.db
- 环境变量：dispatch-context 写明各 subagent 独立的环境变量值（如 `PORT=3001` vs `PORT=3002`）
- 临时文件：各 subagent 写入 `P4-implementation/{pkg}/` 独立目录

主 Agent 在并行派发前**必须**为每个 subagent 的 dispatch-context 分配上述隔离参数。当前无 gate 脚本检查（已知缺口），但未分配导致运行时冲突（端口占用/数据库锁）时计为重试，不算环境问题。

## gate 规则（check-gate.py 会跑）

```bash
check-gate.py P4 $TASK_DIR
```

- **exit 0**：暂存区含非 md/yaml 代码文件（git diff --cached --name-only）
- **exit 1**：暂存区仅 .md/.yaml 文件（无实际代码变更）→ 不能推进
- **exit 1**（RM-AG0046 三重门槛）：检测 violations 非空时，`known-violations.md` 必须存在且登记条目数 ≥ violation 数（评审检查复用上方既有 exit 1 条件；violations 为空 / 检测未部署 / git 通道不可用时不阻断）
- WARNING（不改变 exit code）：骨架/CODE-MAP 机制已采用（P2-skeleton.md 或 agents/CODE-MAP.md 存在）但缺「新增文件核对表」标题

## 推进条件（全部满足才写 phase: P5）

- [ ] 暂存区含代码文件（非 .md/.yaml）
- [ ] 按 C8 映射表触发的评审全部完成：P4-review.md status: approved（所有任务都要求——risk=high 的 P2 plan-eng-review 审方案，P4 实现评审按 domains 另行派发，不可省）
- [ ] SCOPE+ 已处理（若本阶段产生）：P1-requirements.md 有 [SCOPE_RESOLVED]（行首声明格式）
- [ ] git commit 完成

## 常见错误

1. **不读 files_to_read，在项目里乱翻**：implementer 拿到 P2 的 files_to_read 清单后应按清单阅读，不要在项目里全文搜索或整目录全读——上下文会爆炸
2. **自行加范围外改动**：发现需要做但不在 P1 范围内的改动 → 标 [SCOPE+]（行首声明格式：裸 `[SCOPE+]` / `- [SCOPE+]` / `**[SCOPE+]**` / `> [SCOPE+]` 均可；句中引用与反引号包裹不触发 gate）而非直接做
3. **只跑单元测试不验证集成**：单元测试全绿 ≠ 功能可用。P5 会跑 gate_commands 做技术验证，但要确保实现时路径依赖的端点行为已验证
4. **先更新 .state.yaml 再 commit**：state 和产出在同一 commit 里——不要先 commit 产出再单独 commit state
5. **gate 不过 ≠ 你失败了**：红灯指向工作/设计的问题，不指向你。正确动作是诊断→退回/重试/PAUSED，不是修改产出让它变绿。

## 下游影响

- P5 验证依赖：P5 跑 gate_commands.P5 的命令（在 P2 声明），确保你的实现能通过
- P6 验收依赖：实现路径的端点行为必须可验证（确认 API 返回正确的 Content-Type、状态码等）
- 代码改动文件路径：P8 发布时确认版本文件变更需要知道你改动了哪些 package

> 完成 → 读 phase-cards/P5-verification.md

6. **修改 P1 文档**：P4 发现 BDD 矛盾时标 DESIGN_GAP，不直接改 P1-requirements.md。需变更 P1 时标 `[BASELINE_CHANGE: 理由]` 并经主 Agent 批准。
<!-- AGATE_CARD_END -->

<objective_info>
- 环境：debug `:8888` 在线；生产 `:8080` 不可达；git HEAD=`de03b466`。
- **前序批次状态**：`data-viewers` **已完成**（改了 `useCsvParser`/`TableView`/`HtmlViewer`/`TreeView`/`types/structured-data.ts`/`utils/file-bytes.ts`，全量前端 31F→21F）；`detail-outline` 可能**正在并行**改 `useMarkdown`/`useEntryDetailComputed`/`MarkdownViewer`/`TocNav`；`backend-render-budget` 可能在改 `backend/`。
  > **批间文件边界（主 Agent 已核）**：`detail-outline` 的 output 是 `useMarkdown.ts` / `useEntryDetailComputed.ts` / `MarkdownViewer.vue` / `TocNav.vue`；你的 output 是 `default-file.ts` / `store/entryDetail.ts` / `EntryDetailView.vue` / `EntryDetailContent.vue` / `EntryDetailHeader.vue` / `EntryDetailMobileBar.vue` / `EntryCard.vue` / `EntryListRow.vue`。**两批声明零重叠**。
  > 但请**实测确认**：若你打开某文件发现已被改过（出现你不认识的改动），说明并行批次越界了——**保留对方改动、只加你本批的部分**；若无法判断，写 `[CLARIFY]` 停下报告。
- **本批红灯现状**：`tpv0104-default-file.spec.ts`（8F/1P）、`tpv0104-source-scan.test.ts` 的 BDD-47 项（4F）。
- **关键实测事实（可直接引用）**：
  - `stores/entryDetail.ts:49-53` 的 `files[0]` 双兜底
  - `client.ts:91-99` `transformListItem` **硬编码 `files: []`** → `EntryCard.vue:150` / `EntryListRow.vue:153` 的 `files?.[0]?.id` 是**死代码**
  - `EntryDetailView.vue:234` 读 `route.query.firstFileId` → `:236` `loadEntry` → `:238` `router.replace({path, query: {}})` **清空全部 query**
  - 实测 `/k8s-deployment?firstFileId=14` 加载后 URL 立即变为 `/k8s-deployment`（消费即清）
  - `router.replace({query:{file:'99'}})` **会丢弃 `share`**；`{...route.query, file:'99'}` 才保留
  - `file: null` → 得到 `?file`（空值键仍在 search 里）
  - `useEntryDetailComputed.ts:124-127` 的 `handleNavigateFile(fileId)` → `entryDetailStore.selectFile(file)`（页内切换**唯一入口**）
  - `EntryDetailContent.vue` 的 `<HtmlViewer>`（`:54`）与 `<TreeView>`（`:62`）当前**未传** `file`/`size` prop（`data-viewers` 已给组件加 prop，接线归你）
  - `resolveFileSize` 已由 `data-viewers` 建于 `frontend-v3/src/utils/file-bytes.ts`
  - 排序实测参考：`sorted(['AAA.txt','README.md']) == ['AAA.txt','README.md']`；`sorted(['aaa.txt','README.md']) == ['README.md','aaa.txt']`
- 环境坑：临时产物落 `.agate-tmp/`（不用 `/tmp`）；DELETE 用 slug；造件须给 `path`+`filename`。
</objective_info>
