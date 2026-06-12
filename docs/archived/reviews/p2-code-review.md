# spec-html-render P2 代码实现 — 专家评审

> Reviewer: Independent Reviewer (Code Quality / Security / Architecture)
> Date: 2026-05-18
> Commits: 189147d2 (feat), a35b9e9d (fix)
> 评审标的：HtmlViewer.vue / HtmlViewerTestKeys.ts / EntryDetailView.vue / entry.ts

---

## 总体结论

**P2 实现质量优秀，可以合并 main，推进 P3 验证。**

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | ⭐⭐⭐⭐⭐ | spec 全部功能落地，无漏项 |
| 安全性 | ⭐⭐⭐⭐⭐ | Blob URL、最小 sandbox、DOMParser 容错均正确 |
| 代码质量 | ⭐⭐⭐⭐⭐ | 清晰可维护，注释到位 |
| 架构一致性 | ⭐⭐⭐⭐ | 与项目风格吻合，1 处轻微不一致 |
| 测试可测性 | ⭐⭐⭐⭐⭐ | HtmlViewerTestKeys.ts 的设计干净，测试与生产边界清晰 |

共发现 **1 个 MEDIUM、3 个 LOW**，无 CRITICAL / HIGH。

---

## ✅ 实现亮点

**1. Blob URL 生命周期管理无懈可击**

创建、变更、卸载三个时机的 revoke 全部覆盖：

- `initRender()` 里先 `revokeBlobUrl(blobUrl.value)` 再赋新值——content 变更时旧 URL 不泄漏
- `onUnmounted` 里释放——组件销毁时不泄漏
- `revokeBlobUrl` 函数内有 null 守卫——防御性编程

**2. DOMParser 的错误处理正确**

```typescript
try {
  const parser = new DOMParser()
  const doc = parser.parseFromString(props.content, 'text/html')
  // ...
} catch {
  return 0
}
```

DOMParser 通常不抛错（错误 HTML 会被浏览器容错解析），但在 jsdom 等测试环境里可能行为不同。加 try/catch 是对的，且 catch 返回 0 而非抛出——组件不会因为畸形 HTML 而崩溃。

**3. `HtmlViewerTestKeys.ts` 的设计干净**

用 Symbol 而不是字符串 key，避免命名冲突。文件独立，职责单一，注释明确"仅供测试"。这是一个很小但很专业的细节。

**4. `content` 变更时 `manuallyTriggered` 重置**

```typescript
watch(() => props.content, (newContent) => {
  manuallyTriggered.value = false  // ← 重要
  initRender(newContent)
})
```

用户切换文件后，如果新文件也是 > 2MB 的 HTML，不应该继承上一个文件"已手动触发"的状态。这个 reset 防止了一个微妙但真实的 bug。

**5. entryStore.canCopy 没有排除 html**

这是正确的决策。HTML 文件的 Copy（复制源码）是有意义的，spec §3.5 也定义了保留 Copy。`canWrap` 排除 html，`canCopy` 不排除——两者的处理方式与 spec 完全一致。

---

## 🟡 MEDIUM-1：`relativePathCount` 是 `computed`，但 `showRelativePathWarning` 是 `ref`，两者通过 `watch` 连接——引入了不必要的间接层

**位置：** `HtmlViewer.vue` lines 147–151

**问题：**

```typescript
const showRelativePathWarning = ref(false)

watch(relativePathCount, (count) => {
  showRelativePathWarning.value = count > 0
}, { immediate: true })
```

`showRelativePathWarning` 需要同时满足两个条件才能显示：
1. `relativePathCount > 0`（由 content 决定）
2. 用户没有点关闭（本地状态）

当前实现用 `watch` 把两者拼在一起，逻辑分散。问题在于：

**当 `content` 变更（切换文件）时，`relativePathCount` 会重新计算，`watch` 会把 `showRelativePathWarning` 重置为 `count > 0`——但如果用户关闭了上一个文件的警告条，切换到下一个有相对路径的文件后，警告条会重新显示。** 这个行为本身是对的（每个文件独立）。

然而，如果用户在同一个文件上关闭了警告，然后执行某个操作导致 `relativePathCount` 的依赖被重新触发（理论上不会，因为 `content` 没变），警告会意外重显。

更简洁的写法，避免 ref + watch 的隐式耦合：

```typescript
// 用户是否主动关闭了警告
const relativePathWarningDismissed = ref(false)

// content 变更时自动重置（切换文件时 content 会变）
watch(() => props.content, () => {
  relativePathWarningDismissed.value = false
})

// 单一 computed 决定显示逻辑
const showRelativePathWarning = computed(() =>
  relativePathCount.value > 0 && !relativePathWarningDismissed.value
)
```

这样：
- `showRelativePathWarning` 永远是派生状态，不是可变状态
- 关闭逻辑变成 `relativePathWarningDismissed.value = true`
- content 变更时 dismissed 自动重置，无需额外 watch

**修复优先级：** 可以在 P3 前修，不影响当前功能正确性（当前实现的行为在用户角度是正确的），但改了之后代码更清晰，也消除了隐式的状态更新路径。

---

## 🟢 LOW-1：`isLoading` 在 `initRender` 里设为 `true`，但 `content` 为空时提前 return，`isLoading` 可能停留在 `true`

**位置：** `HtmlViewer.vue` lines 166–175

**问题：**

```typescript
function initRender(content: string) {
  if (!content) return  // ← 提前 return，isLoading 不动
  if (isBlockedBySize.value && !manuallyTriggered.value) return

  revokeBlobUrl(blobUrl.value)
  isLoading.value = true   // ← 这里才设 true
  blobUrl.value = createBlobUrl(content)
}
```

实际上 `isLoading` 只在通过两个 guard 之后才被设为 true，没有"提前 return 后 isLoading 仍为 true"的问题——我初读时以为有问题，但代码是对的。

**不过**，`isLoading` 的初始值是 `false`，只有 `initRender` 成功执行才变 `true`，只有 `onIframeLoad` 才变回 `false`。如果 blobUrl 创建后 iframe 的 `load` 事件因为某种原因没有触发（极罕见，但 Blob URL 加载失败时可能），`isLoading` 会永远停在 `true`，Loading 态永远不消失。

**建议：** 加一个保险 timeout，比如 10 秒后无论如何 `isLoading.value = false`，或者监听 iframe 的 `error` 事件：

```typescript
// iframe 加载失败时也要退出 loading 态
function onIframeError() {
  isLoading.value = false
}
```

然后在 template 里：

```html
<iframe
  ...
  @load="onIframeLoad"
  @error="onIframeError"
/>
```

---

## 🟢 LOW-2：`isHtml` 在 EntryDetailView 里定义，但 `isMarkdown` 已经在 store 里有对等逻辑——两者放置不一致

**位置：** `EntryDetailView.vue` line 328 / `entry.ts` line 34

**问题：**

```typescript
// EntryDetailView.vue（本地 computed）
const isHtml = computed(() => activeFile.value?.language === 'html')
const isMarkdown = computed(() => activeFile.value?.language === 'markdown')
```

这两个 computed 性质完全一样，都在 view 层定义，目前没问题。但是 `canWrap` 在 store 里有 `language === 'html'` 和 `language === 'markdown'` 的判断，而 `isHtml` / `isMarkdown` 却不在 store 里——两个地方重复了语言判断逻辑。

未来如果后端 `language` 的值发生变化（比如 `'html'` 改成 `'text/html'`），需要改两处。

这是项目已有的轻微不一致（`isMarkdown` 在 P2 之前就已经在 view 层），本次改动没有引入新的问题，所以是 LOW 而不是 MEDIUM。

**建议（非阻塞）：** 未来重构时可以考虑把 `isHtml` / `isMarkdown` 提升到 store，和 `canWrap` 的判断统一。

---

## 🟢 LOW-3：`fileSizeLabel` 在 < 512KB 时显示字节数，实际 HTML 文件不可能那么小以至于需要显示 B

**位置：** `HtmlViewer.vue` lines 103–108

```typescript
const fileSizeLabel = computed(() => {
  const size = contentSize.value
  if (size >= SIZE_BLOCK) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= SIZE_WARN)  return `${(size / 1024).toFixed(0)} KB`
  return `${size} B`  // ← 这行在 UI 上永远不会显示
})
```

`fileSizeLabel` 只在 `showSizeWarning`（≥512KB）或 `showManualRender`（≥2MB）时显示，而这两个条件下 size 一定 >= 512KB，第三个分支 `return \`${size} B\`` 永远不会出现在 UI 上。

这不是 bug，只是死代码，可读性上略有迷惑。建议加注释或直接删掉第三分支（因为该值不会在 < 512KB 时被使用），或者改成 `return \`${(size / 1024).toFixed(0)} KB\`` 作为 fallback。

---

## 总结

| 编号 | 级别 | 位置 | 建议 |
|------|------|------|------|
| MEDIUM-1 | 🟡 | HtmlViewer.vue | `showRelativePathWarning` 改为 computed，消除 ref+watch 隐式耦合 |
| LOW-1 | 🟢 | HtmlViewer.vue | 加 `@error="onIframeError"` 防止 loading 态永久卡住 |
| LOW-2 | 🟢 | EntryDetailView / entry.ts | 记录技术债，未来统一语言判断的位置 |
| LOW-3 | 🟢 | HtmlViewer.vue | `fileSizeLabel` 第三分支是死代码，加注释或删除 |

**MEDIUM-1 和 LOW-1 建议在 P3 前修掉，改动都很小（< 10 行），做完之后代码更健壮。**
