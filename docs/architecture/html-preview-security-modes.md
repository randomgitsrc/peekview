# HTML 预览的安全边界：两档模式与当前默认

> 面向使用者的运行预期文档：说清 HTML 预览现在**能做什么**、**不能做什么**，以及将来想收紧要在哪一层动手。

## 两档模式

HTML 预览在语义上有两档，差别只在「脚本与外网是否放行」：

| 档位 | 定位 | 脚本 | 外部网络 | 隔离手段 |
|---|---|---|---|---|
| **安全预览** | 只把 HTML 当**静态文档**看：布局、样式、图片、字体 | 不执行 | 不放行 | 完全去脚本 + 收紧 `connect-src` |
| **交互式 Demo** | 把 HTML 当**可运行的小应用**看：需要 JS 才能渲染的图表、交互控件、离线小工具 | 执行 | 放行 | `iframe sandbox` 去掉 `allow-same-origin`，落在 opaque origin |

两档不是「安全 / 不安全」的道德判断，而是**可信度假设不同**：安全预览假设 HTML 内容可能有害；交互式 Demo 假设内容是用户自己发布的、愿意让它跑起来。

## 当前默认：交互式 Demo

**当前默认是交互式 Demo**，即脚本执行、外网可达。落点在 `backend/peekview/api/files.py` 的 `RENDER_CSP`：

```
default-src 'unsafe-inline' 'unsafe-eval' blob: data: https:;
script-src  'unsafe-inline' 'unsafe-eval' blob: data: https:;
style-src   'unsafe-inline' blob: data: https:;
img-src     blob: data: https:;
...
connect-src blob: data: https:;
worker-src  blob:;
frame-src   'none';
frame-ancestors 'self';
form-action 'none';
```

渲染结果由前端放进 `sandbox="allow-scripts allow-forms"` 的 iframe。**没有 `allow-same-origin`** 是关键一条：iframe 内容的 origin 是 opaque，拿不到主页面的 Cookie / localStorage，也就拿不到登录凭据。所以「脚本能跑」不等于「脚本能读主页面身份」。

剩下的边界由 `frame-ancestors 'self'`、`frame-src 'none'`、`form-action 'none'` 三条兜住：不能被第三方页面内嵌、不能再套 iframe、不能提交表单把数据 POST 出去。

## 仍未关闭的一条外传通道

**`connect-src` 仍允许 `https:`**，因此被预览的 HTML 里的脚本可以把数据 **外传**到任意 https 端点（`fetch`/`XHR`/`sendBeacon` 均可），开发者工具的网络面板里能看到。

这不是疏漏，是一条**明确的取舍**：交互式 Demo 之所以叫 Demo，就是它可能要拉 CDN 资源、调公开 API。关掉 `https:` 会让大量真实 demo 直接白屏。

**收紧它属于独立决策**，不在「加个开关」的量级上：既要区分「拉资源」与「发数据」（CSP 没有这个粒度，得靠代理或审计日志），也要给出配套的用户预期变更（哪些 demo 会失效）。要收紧时，改动点集中在 `RENDER_CSP` 的 `connect-src` 一项，以及这条链路上同源的 `img-src` / `media-src`（它们同样是 https 外传面）。

## 相关行为

- **注入预算**：同源 sibling 资源（CSS/JS/图片/字体）由后端内联进 HTML，不产生额外请求。超限时渲染结果尾部带一个 `<script type="application/json" id="peekview-inject-report">` 块记录 `requested` / `inlined` / `skipped[]`，便于判断「某个资源为什么没生效」。数值上限定义在 `backend/peekview/services/html_render_service.py` 的常量区。
- **安全预览档当前没有实现**：本文只定义它、并记录当前默认不是它。要落地需新增一条渲染路径（去脚本 + 收紧 CSP），不是现有路径的参数切换。
