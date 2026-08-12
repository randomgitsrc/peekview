# PeekView HTML 多文件资源注入 实现计划

> 版本: 1.0
> 日期: 2026-05-18
> 关联规格: [spec-html-multi-file-inject.md](../specs/spec-html-multi-file-inject.md) v1.3
> 状态: 待执行

---

## 实现顺序

4 个步骤，按依赖关系排列。

---

### Step 1: HtmlViewer — 注入逻辑 + 新 props

**文件**: `frontend-v3/src/components/HtmlViewer.vue`

**新增 prop**:

```typescript
interface SiblingFile {
  filename: string
  content: string
  language: string
}

const props = defineProps<{
  content: string
  siblingFiles?: SiblingFile[]      // 兄弟文件内容，fetch 完成后传入
  loadingSiblings?: boolean         // 明确表达"正在 fetch 兄弟文件"状态
}>()
// 不用 siblingFiles=undefined 隐式表达 loading 态：
// undefined 是 prop 未提供的合法默认值，语义不清晰且脆弱。
```

**新增函数** (按 spec §4.2):

1. `normalizeRef(ref)` — 规范化引用路径，排除绝对 URL / 协议 / # / 路径绝对引用
2. `injectResources(html, siblings)` → `{ html, unmatchedCount }`
   - DOMParser 解析 → 匹配 siblingFiles filename → 替换 `<link rel="stylesheet">` 为 `<style>` + 替换 `<script src>` 为 inline `<script>`（排除 `type="module"`）
   - 返回序列化 HTML + 未匹配引用计数
3. `serializeDoc(doc)` — 保留 DOCTYPE，避免 quirks mode
4. `countRelativePathsInDoc(doc)` — 统计注入后剩余未匹配引用数

**修改 `initRender()`**:

```typescript
function initRender(content: string) {
  if (!content) return
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  const { html: processed, unmatchedCount } = injectResources(content, props.siblingFiles ?? [])
  relativePathWarningCount.value = unmatchedCount
  revokeBlobUrl(blobUrl.value)
  isLoading.value = true
  blobUrl.value = createBlobUrl(processed)
}
```

**修改 `relativePathCount`**: 改为使用 `relativePathWarningCount` ref（来自 `injectResources` 返回值），不再用 DOMParser 单独计算。

**修改 loading 态**: `loadingSiblings=true` 时显示 Loading 态（复用现有 spinner UI），不创建 Blob URL。

**修改 watch**: `siblingFiles` 变化时也重新渲染，**新增独立 watch**（不与 content watch 合并）：

```typescript
// content 变化时重新渲染（已有）
watch(() => props.content, (newContent) => { initRender(newContent) }, { immediate: true })

// siblingFiles 到齐后触发渲染（新增）
// 不合并到 content watch：合并会导致 content 先到时先渲染一次无注入版本，
// siblingFiles 到了再渲染一次有注入版本，用户看到闪烁
watch(() => props.siblingFiles, (siblings) => {
  if (siblings && siblings.length > 0) initRender(props.content)
})
```

**data-testid**: 无需新增，已有 `html-loading` / `relative-path-warning` 覆盖。

**验证**: 单文件 HTML（无 siblingFiles）行为与当前完全一致。

---

### Step 2: EntryDetailView — 并行 fetch 兄弟文件

**文件**: `frontend-v3/src/views/EntryDetailView.vue`

**新增逻辑**:

```typescript
const siblingFilesContent = ref<SiblingFile[]>([])
const isFetchingSiblings = ref(false)
let fetchToken = 0

watch(
  () => entryStore.activeFile,
  async (file) => {
    siblingFilesContent.value = []
    if (!file || file.language !== 'html') return
    if (!entryStore.currentEntry) return

    const siblings = entryStore.currentEntry.files.filter(f => f.id !== file.id && !f.isBinary)
    if (siblings.length === 0) return

    isFetchingSiblings.value = true
    const token = ++fetchToken  // 竞态防护
    try {
      // Promise.allSettled：单文件失败不影响其他文件注入
      const settled = await Promise.allSettled(
        siblings.map(async f => ({
          filename: f.filename,
          language: f.language ?? '',
          content: await api.getFileContent(entryStore.currentEntry!.slug, f.id),
        }))
      )
      if (token !== fetchToken) return  // 已切换文件，丢弃过期结果

      const results = settled
        .filter((r): r is PromiseFulfilledResult<SiblingFile> => r.status === 'fulfilled')
        .map(r => r.value)
      const failedCount = settled.filter(r => r.status === 'rejected').length
      if (failedCount > 0) {
        // toast 提示：N 个资源文件加载失败
      }
      siblingFilesContent.value = results
    } finally {
      if (token === fetchToken) isFetchingSiblings.value = false
    }
  },
  { immediate: true }
)
```

**模板修改**:

```vue
<HtmlViewer
  v-if="isHtml"
  :content="entryStore.fileContent"
  :sibling-files="siblingFilesContent"
  :loading-siblings="isFetchingSiblings"
/>
```

**验证**: 切换到 HTML 文件时兄弟文件自动 fetch；切换到非 HTML 文件时 siblingFilesContent 清空。

---

### Step 3: 单元测试

**文件**: `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts`

新增 `describe('多文件注入')` 测试组：

| 用例 | 验证 |
|------|------|
| 无 siblingFiles | 行为与当前一致，相对路径警告正常 |
| CSS 内联注入 | `<link href="styles.css">` 替换为 `<style>`，Blob 内容含注入 CSS |
| JS 内联注入 | `<script src="app.js">` 替换为 inline script |
| 混合注入 | CSS + JS 同时注入 |
| `./` 前缀 | `href="./styles.css"` 匹配 `styles.css` |
| 不匹配引用 | 保留原节点，unmatchedCount 正确 |
| 非 stylesheet link | `rel="icon"` 不替换 |
| `type="module"` | 不注入，计入 unmatchedCount |
| `type="application/json"` | 不替换 |
| 空文件内容 | 不崩溃 |
| siblingFile filename 含 `./` 前缀 | `normalizeRef` 正确 strip，匹配成功 |
| siblingFile filename 为绝对路径 | `normalizeRef` 返回 null，文件静默跳过（不崩溃）|
| loadingSiblings=true | 显示 Loading 态，不渲染 iframe |
| DOCTYPE 保留 | 注入后 Blob 内容含 `<!DOCTYPE html>` |
| unmatchedCount | 部分匹配时只计未注入数 |

**验证**: `cd frontend-v3 && npm run test` — 所有单元测试通过。

---

### Step 4: E2E 测试

**文件**: `frontend-v3/e2e/html-render.spec.ts`

新增测试用例：

| 用例 | 验证 |
|------|------|
| 多文件 HTML 应用 | 创建 index.html + styles.css + app.js → iframe 内样式生效、JS 交互可用 |
| 相对路径警告消失 | 注入成功后无 `relative-path-warning` |
| 部分匹配 | HTML 引用不存在的文件 → 仅对未匹配项显示警告 |
| 竞态快速切换 | 切到 HTML → 切到 CSS → 切回 HTML → 最终渲染正确 |

**验证**: `make debug-test` — 52+ E2E 测试通过。

---

## 关键文件清单

| 文件 | 变更 |
|------|------|
| `frontend-v3/src/components/HtmlViewer.vue` | siblingFiles/loadingSiblings props, injectResources, normalizeRef, serializeDoc, initRender 更新 |
| `frontend-v3/src/views/EntryDetailView.vue` | siblingFilesContent ref, fetchToken 竞态, Promise.allSettled fetch, HtmlViewer props |
| `frontend-v3/src/components/__tests__/HtmlViewer.spec.ts` | 多文件注入测试组 (13 用例) |
| `frontend-v3/e2e/html-render.spec.ts` | 多文件 E2E 测试 (4 用例) |

---

## 自评审

### 逐项检查 spec v1.3 关键要求

| 要求 | 实现计划覆盖 |
|------|-------------|
| ✅ `normalizeRef` 排除绝对 URL、协议、#、/ 开头、./ 前缀 | Step 1 |
| ✅ CSS `<link rel="stylesheet">` → `<style>` 替换 | Step 1 injectResources |
| ✅ JS `<script src>` → inline `<script>` 替换 | Step 1 injectResources |
| ✅ `type="module"` 排除注入 | Step 1 injectResources (if type !== 'text/javascript' return) |
| ✅ `type="application/json"` 不替换 | Step 1 injectResources (同上逻辑) |
| ✅ `serializeDoc` 保留 DOCTYPE | Step 1 |
| ✅ `injectResources` 返回 `{ html, unmatchedCount }` | Step 1 |
| ✅ `loadingSiblings` 明确 prop | Step 1 + Step 2 |
| ✅ B2 方案：EntryDetailView fetch, HtmlViewer 只渲染 | Step 2 |
| ✅ `Promise.allSettled` + 失败 toast | Step 2 |
| ✅ fetchToken 竞态防护 | Step 2 |
| ✅ 只 fetch 文本文件（排除 is_binary） | Step 2 siblings.filter(!f.isBinary) |
| ✅ §3.6 安全风险已说明（已知，接受） | 无代码改动，spec 已覆盖 |

### 潜在风险

| 风险 | 缓解 |
|------|------|
| DOMParser 序列化可能丢失某些属性 | serializeDoc 只处理 DOCTYPE；`<html>` 属性在 outerHTML 中保留，测试覆盖 |
| 大条目并行 fetch 耗时 | loadingSiblings prop 让用户看到 Loading 态；只 fetch 文本文件，排除二进制 |
| siblingFiles watch 与 content watch 冲突 | 合并为单一 watch 或在 siblingFiles 变化时也调用 initRender |
| `normalizeRef` 对 filename 也需处理 | siblingFiles 的 filename 通常不含路径，`normalizeRef` 只做 ./strip |

### 结论

计划完整覆盖 spec v1.3 所有 P1 要求，无遗漏。4 步顺序合理（先核心逻辑 → 再数据获取 → 测试 → E2E）。可以进入实现。

---

## 验证流程

1. `cd frontend-v3 && npm run test` — 单元测试通过
2. `cd frontend-v3 && npm run build` — 构建成功
3. `make debug` — 构建 + 启动 + E2E 通过
4. 手动创建包含 `index.html` + `styles.css` + `app.js` 的 entry，浏览器打开验证样式和交互生效、无警告条