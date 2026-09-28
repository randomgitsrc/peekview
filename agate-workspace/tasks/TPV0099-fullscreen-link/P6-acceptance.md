---
phase: P6
task_id: TPV0099
type: acceptance
parent: P5-verification.md
trace_id: TPV0099-P6-20260929
status: draft
created: 2026-09-29
agent: verifier
# ── v2.0 机器汇总 ──
pass: 19
fail: 0
ui_affected: true
---

# P6 验收报告 — 全屏模式链接 `/{slug}/f`（TPV0099）

- 验收人：verifier（P6 派发角色，独立于 P4 实现者）
- 验收时刻：2026-09-29 01:15–01:40 (+08:00)
- 验收环境：debug backend `http://127.0.0.1:8888`（v0.24.1，数据目录 `/tmp/peekview-debug/`）、Chrome CDP `:18800`、Playwright 1.61.1
- 判据来源：`P1-requirements.md` 的 19 条 BDD（Given/When/Then 逐字为准，含 rev1/rev2 修订后的排除集与 seed 前提）
- 证据目录：`P6-evidence/`（19 份断言 JSON + 14 张截图 + 14 份 vision 原始输出 + 3 份日志 + 1 份人工复核记录 + 1 份判据拦截力对照）

**Summary**: 19/19 PASS, 0 FAIL

---

## 1. 逐条验收结果

- PASS BDD-1: 全屏视图形态：`/dsh-architecture/f` 直入纯内容视图，正文文本 4113 字符且含特征串「总体架构」，`.entry-detail.zen-mode` 存在，chrome 8 项可见性全 false，URL 保留 `/f` 后缀（seed 钉定非归档 `dsh-architecture`；桌面 1280×800） (screenshots/bdd-1-fullscreen-form-1280x800.png) (vision: vision-reports/bdd-1.yaml) (assert-bdd-1.json, vision-raw/bdd1-form.txt)
- PASS BDD-2: 内容区占满视口可用区：`content-area` 的 top=0（与视口顶边差 0 ≤ 1px）、height=800 == `innerHeight` 800（≥ 视口高 − 1px） (assert-bdd-2.json, test-output.log)
- PASS BDD-3: 桌面全屏视图无任何满宽顶部横条：按 A 组「自身+全部祖先」/ B 组「自身+全部后代」不对称排除集实测，正确实现命中 0（候选集非空，未退化）；且内容区左右边界与视口边界差为 0/0 ≤ 1px。判据拦截力经三态负向对照闭环：①正确实现命中 0、②强制 `.detail-header` 可见命中 3（1280×107 / 1232×44 / 1232×26）、③注入未纳入隐藏集的满宽横条命中 1（1280×40） (screenshots/bdd-3-state2-header-forced-visible-1280x800.png) (screenshots/bdd-3-state3-injected-bar-1280x800.png) (vision: vision-reports/bdd-3-state2.yaml) (vision: vision-reports/bdd-3-state3.yaml) (assert-bdd-3.json, vision-raw/bdd3-state2.txt, vision-raw/bdd3-state3.txt)
- PASS BDD-4: 全屏视图内按 f / F / Ctrl+f 不改变视图：按键前后 zen 类、chrome 可见性、内容区矩形、`location.pathname`、query、公告文本逐项一致（全 true）。判据非恒真的对照臂见 `assert-negative-controls.json`：同一按键序列在**非锁死**页 `/dsh-architecture` 上实测 rect 107/693 → 0/800 → 107/693、公告文本变化，即同一判据对失败态给出「已改变」结论 (manual-review: P6-evidence/manual-review-input-state.md) (assert-bdd-4.json, assert-negative-controls.json)
- PASS BDD-5: 全屏视图内按 Escape 不改变视图：zen 仍为 true，chrome 可见性、内容区矩形、URL 与按键前逐项一致。判据非恒真的对照臂：非锁死页按 Escape 实测 zen 由 true→false（`assert-negative-controls.json`），而锁死页保持 true (manual-review: P6-evidence/manual-review-input-state.md) (assert-bdd-5.json, assert-negative-controls.json)
- PASS BDD-6: 全屏视图不宣告任何退出方式：公告区文本为 `Fullscreen view. Content only.`——不含词组「Press f or Escape to exit」「按 f 退出」，不含子串 `Escape`、不含 `exit`；全屏视图自身 chrome 范围内（`.entry-detail` 内排除内容区及其后代）可聚焦元素计数 0（`.entry-detail` 内合计 28 个，全部位于内容区内不计入），退出词表命中 0。判据非恒真：非锁死 zen 下同作用域公告文本含 `Escape` 且命中退出词组（见 assert-bdd-12.json） (assert-bdd-6.json, assert-bdd-12.json)
- PASS BDD-7: 锁死不吞内容区内嵌组件的 Escape：分页浮层由「打开（高度 134，含 3 个 option）」→ 按 Escape 后 `.per-page-listbox` 计数 0，且全屏视图保持（chrome 可见性逐项一致、URL 仍 `/tsv-server-metrics/f`、zen 类仍在） (screenshots/bdd-7-per-page-listbox-open-1280x800.png) (screenshots/bdd-7-per-page-listbox-closed-1280x800.png) (vision: vision-reports/bdd-7-open.yaml) (vision: vision-reports/bdd-7-closed.yaml) (assert-bdd-7.json, vision-raw/bdd7-open.txt, vision-raw/bdd7-closed.txt)
- PASS BDD-8: 多文件 entry 内切换文件保持全屏：正文内文件间链接 2 条（`中文附件下载`→id 37 / `English attachment`→id 34，均可见可点，切换动作可达），点击后正文由 347 字符/8 标题切换为 49 字符/0 标题（占位内容），pathname 前后一致仍为 `/unicode-filenames/f`，zen 类仍在，chrome 8 项全不可见 (screenshots/bdd-8-before-file-switch-1280x800.png) (screenshots/bdd-8-after-file-switch-1280x800.png) (vision: vision-reports/bdd-8-before.yaml) (vision: vision-reports/bdd-8-after.yaml) (assert-bdd-8.json, vision-raw/bdd8-before.txt, vision-raw/bdd8-after.txt)
- PASS BDD-9: 无目录侧栏且锚点滚动正常：登录前提成立（`markdown-test` 匿名对照 404、alice 可读），`?firstFileId` 动态解析为 43（未硬编码），正文内 `a[href^="#"]` 10 条；点击末条锚点链接后容器 `.content-area.scrollTop` 由 0 增至 13731（差值 > 0）、`.toc-sidebar` `display:none` 且高度 0、pathname 仍 `/markdown-test/f`、`window.scrollY` 恒为 0（判据绑容器不绑 window） (screenshots/bdd-9-anchor-scrolled-1280x800.png) (vision: vision-reports/bdd-9.yaml) (assert-bdd-9.json, vision-raw/bdd9-scroll.txt, assert-negative-controls.json) (manual-review: P6-evidence/manual-review-input-state.md)
- PASS BDD-10: 私有 entry + share token 组合可用：alice 建私有 entry → 建 share → 匿名带 token 访问全屏链接可见特征串 `TPV0099-SHARE-MARKER`、无鉴权失败提示、zen 类成立且 chrome 8 项全不可见。三态区分力成立且互不相同：页面 `[无token, 伪token, 真token] = [false,false,true]`，API 基线 404/404/200。清理用**服务端返回的 slug**（本次请求 slug 与服务端 slug 相同、未触发 `-2` 改写），删除后 alice 复查 `raw` = 404（判据落在结果上）；全量残留扫描命中 0 条 (screenshots/bdd-10-share-token-fullscreen-1280x800.png) (vision: vision-reports/bdd-10.yaml) (assert-bdd-10.json, residual-check.log, vision-raw/bdd10-share.txt) (manual-review: P6-evidence/manual-review-input-state.md)
- PASS BDD-11: 回归 `/{slug}`（无 f）现有行为不变：`.detail-header` 可见、内容区可见、zen 类计数 0、内容区 top=107（> 0，与全屏态的 0 可区分）；辅助证据 Link 响应头含 `</api/v1/entries/dsh-architecture/raw>; rel="alternate"` (assert-bdd-11.json, test-output.log)
- PASS BDD-12: 回归既有 f 键 zen 外观与语义不变：按 f 后 zen 类成立、chrome 8 项全不可见、内容区 top=0 且高 800（与 `/f` 全屏视图几何一致）、公告文本为 `Zen mode on. Press f or Escape to exit.`（仍宣告退出方式）；再按 Escape 后 zen 退出、标题栏恢复可见、URL 全程为 `/dsh-architecture` 未变 (assert-bdd-12.json, test-output.log)
- PASS BDD-13: 回归 `/{slug}/f` 不再静默渲染路由级 NotFoundView：`.not-found` 计数 0、页面文本不含 `Page not found`、zen 类成立并呈现正文首行「SCNet DSH 完整架构部署图」（BDD-1 形态） (assert-bdd-13.json, assert-bdd-1.json)
- PASS BDD-14: 移动端（390×844）全屏视图无移动端 chrome 且内容区占满视口：非全屏态对照确认三类 chrome 均可见（顶部条 56px / 底部条 64px / 元信息条 89px），全屏态三类均不可见、内容区 top=0 且 height=844 == `innerHeight`，`scrollHeight` 5175 > `clientHeight` 844 且滚动到末尾 `scrollTop`=4331、末段正文非空、`window.scrollY` 恒 0 (screenshots/bdd-14-mobile-fullscreen-390x844.png) (vision: vision-reports/bdd-14.yaml) (assert-bdd-14.json, vision-raw/bdd14-mobile.txt)
- PASS BDD-15: 图表类 entry（mermaid）全屏下渲染与内置查看能力正常：登录前提成立（`mermaid-charts` 匿名 404、alice 可读），内联 SVG 已渲染 850×400；点击 `.fullscreen-btn`（计数 1）后 `.diagram-modal` 可见 1280×800，点其 `.close-btn`（计数 1）后弹层计数归 0 且内联 SVG 恢复可见，URL 仍保留 `/f`、zen 类仍在 (screenshots/bdd-15-mermaid-inline-fullscreen-1280x800.png) (screenshots/bdd-15-mermaid-modal-open-1280x800.png) (vision: vision-reports/bdd-15-inline.yaml) (vision: vision-reports/bdd-15-modal.yaml) (assert-bdd-15.json, vision-raw/bdd15-inline.txt, vision-raw/bdd15-modal.txt)
- PASS BDD-16: 人工体验路径——按项目文档 seed 后全屏链接页面即有内容：无任何额外构造数据，`/dsh-architecture/f` 正文文本 4113 字符且含「总体架构」，zen 类成立、chrome 全不可见；截图留证（滚动至正文中段以体现正文实质内容）；同一环境由 P5→P6 复用的 E2E spec 独立重跑两项均 exit 0（32 passed / 6 passed） (screenshots/bdd-16-seeded-fullscreen-scrolled-1280x800.png) (vision: vision-reports/bdd-16.yaml) (assert-bdd-16.json, vision-raw/bdd16-scrolled.txt, e2e-reuse.log)
- PASS BDD-17: 图表类 entry（独立 SVG 文件）全屏下图片正常渲染：seed 取 Given 允许的 `svg-standalone`（匿名 raw 200），`[data-testid="image-content"]` 计数 1、`[data-testid="image-error"]` 计数 0，图片 bounding box 800×600 且 `naturalWidth/Height`=800/600，`.fullscreen-btn` 计数 0（本条不要求该能力），zen 类成立且 URL 保留 `/svg-standalone/f` (screenshots/bdd-17-svg-image-fullscreen-1280x800.png) (vision: vision-reports/bdd-17.yaml) (assert-bdd-17.json, vision-raw/bdd17-svg.txt)
- PASS BDD-18: 边界——不存在 slug + `/f` 不落路由级 NotFoundView：`.not-found` 计数 0、文本不含 `Page not found`，`.entry-detail` 与内容区 `content-area` 计数均为 1（呈现详情视图错误态：`Request failed with status code 404`）；单段对照基线 `/nonexistent-slug-xyz` 返回 200，两条路径解析语义一致 (assert-bdd-18.json, test-output.log)
- PASS BDD-19: 边界——中段路径不误匹配并渲染 entry 内容：`/dsh-architecture/f/xyz` 页面文本不含该 entry 正文特征串「总体架构」、`.entry-detail` 计数 0，呈现 `.not-found`（计数 1）——与 BDD-13 在同一 seed 的 `/f` 上「.entry-detail 存在 + 含特征串」互为互斥对照，证明段数匹配严格 (assert-bdd-19.json, assert-bdd-13.json)

---

## 2. 四条硬约束逐条落实

| # | 硬约束 | 落实情况 | 证据 |
|---|---|---|---|
| 1 | BDD-1/2/3 必须钉定**非归档、非过期** seed `dsh-architecture` | 三条均硬编码 `SLUG_ARCH = 'dsh-architecture'`，未使用 `legacy-deploy` 或任何 `status: archived`/过期 entry | assert-bdd-1.json 的 `given.seed_status='active（非 archived / 非 expired）'`、assert-bdd-3.json 的 `given` |
| 2 | BDD-3 的 A/B 排除集**不可简化**，且须做三态负向对照 | A 组 `html/body/#app/.entry-detail` 取**自身+全部祖先、不含后代**；B 组内容流容器链取**自身+全部后代**；两组未统一、未互换。三态实测 **①=0 / ②=3 / ③=1**，闭合 | assert-bdd-3.json 的 `exclusion_rules`（含 `not_unifiable: true`）与 `three_state` |
| 3 | BDD-10 认证配对 + 清理必须用**服务端返回的 slug** | 五步配对完整（alice 登录→建私有→建 share→匿名带 token 读→alice 删除）；清理队列登记 `created.slug`（非请求 slug），并做「登记值活体校验」（该 slug `raw`=200）与「删除后 404」双判据；三态区分力 `[false,false,true]` 成立 | assert-bdd-10.json 的 `server_slug`/`request_slug`/`alive_check_status=200`/`cleanup.alice_raw_status_after_delete=404` |
| 4 | 双视口须**显式钉定** | 桌面 `test.use({viewport:{width:1280,height:800}})`、移动 `test.use({viewport:{width:390,height:844}})`，均未依赖 project 默认视口（1280×720 / 393×727） | assert-bdd-2.json `innerWidth/innerHeight = 1280/800`；assert-bdd-14.json `innerWidth/innerHeight = 390/844` |

---

## 3. 真实视觉分析（P1 vision 能力 status = available）

P1 `capability_requirements` 声明视觉能力 `status: available`，故按 P6 卡「真实视觉分析（BDD-10）」执行：对 14 张 UI 证据截图逐张做**真实模型视觉分析**（vision-engine skill，role=quick），产出 `vision-reports/bdd-*.yaml`（`vision_analysis.summary.blocker_count = 0`，14 份全部为 0），原始输出留档 `P6-evidence/vision-raw/*.txt`。

判定锚点说明：本报告的视觉结论**不**以 `naturalWidth>0` / `complete=true` / `HTTP 200` / 像素方差为据，而是基于视觉模型对截图像素的描述性判定（chrome 是否存在、弹层是否可见、图形是否渲染正确、正文是否为真实内容）。像素方差仅作为「非空白/非占位图」的辅助量化指标记录（14 张方差 53–11557，均远高于 50 阈值）。

### 3.1 vision 提出质疑的逐条澄清（无未闭合 blocker）

vision 在 3 处提出与断言不同的观察，均按「先追查根因、再判定」处理，不以后者直接反驳：

| BDD | vision 的观察 | 追查方法与输出 | 根因结论 | 对判定的影响 |
|---|---|---|---|---|
| BDD-14 | 「元信息条**部分可见**：标题下方灰色摘要『单主架构 · 三层保活…』属标签类元信息」 | DOM 溯源该文本节点：`<p>` 位于 `BLOCKQUOTE` → `.markdown-body` → `.markdown-viewer` → `MAIN.content-area` → `.detail-content` → `.entry-detail.zen-mode`；`node.closest('.meta-tags-bar') === false`；同时 `.meta-tags-bar` 实测 `display:none`、宽高 0 | vision 看到的是**正文内的引用摘要**，不是元信息条 | 无（BDD-14 判据以 `.meta-tags-bar` 元素可见性为准，结论不变） |
| BDD-16 | 「顶部有蓝色文字提示与流程概括文本」→ 倾向判「有状态栏」 | DOM 溯源滚动 1600px 后视口顶部带文字元素的归属：`H1`/`P`/`CODE`/`H2`/SVG `text` 全部 `closest('.markdown-viewer') === true` 且 `in_content_area === true`；顶部唯一非正文元素为 `.sr-only` 无障碍公告（`top=-1`，视觉不可见）；`.detail-header`/`.mobile-sticky-header`/`archived-banner`/`expired-warning-banner` 可见高度均为 0 | 那是**正文内容随滚动经过视口顶部**，不是 chrome 状态栏 | 无（BDD-16 判据为正文非空 + 全屏形态成立） |
| BDD-15 | 「工具栏**没有** Fullscreen 全屏按钮」 | DOM 实测按钮存在：`BUTTON.diagram-action-btn.fullscreen-btn`，`title="Fullscreen"`，尺寸 28×28，可见字形为符号「⧉」（**按钮内无 `Fullscreen` 文字**）；且点击后 vision 侧独立确认弹层与放大图表出现 | vision 按**可见文字**查找未命中，属可解释偏差，非「按钮不存在」 | 无（DOM 计数 1 + 弹层开合闭环互证） |

追查命令与原始输出：本表三行的 DOM 溯源由 `.agate-tmp/p6/probe.cjs` / `probe2.cjs` 实跑产出，原始 JSON 输出逐字留档于 `P6-evidence/vision-raw/bdd14-mobile.txt`（vision 侧）与 `P6-evidence/test-output.log`（命令与结论摘要）。

### 3.2 视觉质量 checklist 核对（P1 `ui_render_shape: layout` / 维度：布局结构、交互行为、视觉呈现）

| 维度 | 判据量化锚点 | 核对结果 | 依据 |
|---|---|---|---|
| 布局结构 | DOM 几何度量：内容区 `getBoundingClientRect()` 的 top 差 ≤ 1px、height ≥ 视口高 − 1px、左右边界差 ≤ 1px | checked | assert-bdd-2.json（0/800/0/0）、assert-bdd-3.json（caLeft=0, caRight=1280=vw）、assert-bdd-14.json（0/844） |
| 视觉呈现 | 满宽横条计数（≥90% 视口宽 ∧ 高 ≥ 8px ∧ top < 100px）+ 三态负向对照 | checked | assert-bdd-3.json（0 / 3 / 1） |
| 视觉呈现 | chrome 元素可见性（bounding box 宽高、display/visibility/opacity 四条件） | checked | 各 assert-bdd-*.json 的 `chrome_all_hidden`；vision 独立描述一致 |
| 交互行为 | 按键前后状态快照逐字段比对（chrome/rect/pathname/search/aria）+ 对照臂 | checked | assert-bdd-4.json、assert-bdd-5.json、assert-negative-controls.json |
| 交互行为 | 浮层开合状态转移（DOM 计数 1→0）+ 组件内 Escape 消费不被吞 | checked | assert-bdd-7.json（含 vision 前/后态独立确认） |
| 交互行为 | 滚动量化：容器 `scrollTop` 增量 | checked | assert-bdd-9.json（0→13731）、assert-bdd-14.json（0→4331） |
| 渲染正确性 | 图表渲染输出（SVG 尺寸 > 0）与弹层开合闭环 | checked | assert-bdd-15.json（850×400、modal 1280×800）；vision bdd-15-modal.yaml 独立确认弹层与放大图表 |
| 渲染正确性 | 图片渲染正确性（非破图） | checked | assert-bdd-17.json（img 计数 1、error 计数 0、24×24）；vision bdd-17-svg.yaml 独立判「正常渲染的矢量图形，非破图占位符/裂图图标」 |

禁止的主观词（可读/美观/流畅/平滑/自然/响应灵敏）未用于任何判定。

### 3.3 输入态/交互形态变化类 BDD 人工复核

BDD-4/5/7/8/9/10 的 When 含输入动作（按键/点击），按 verifier.md 判定标准属输入态类，结论已附**人工复核记录**（复核人 / 复核时间 / 复核结论）见 `manual-review-input-state.md`。BDD-1/2/3/11/12/13/14/16/17/18/19 属静态渲染/查询类，不触发人工复核。

### 3.4 雷同截图复核

check-p6-evidence 的 average-hash 检测将 `bdd-7-per-page-listbox-open/closed` 判为视觉高度相似。已附**雷同截图复核**记录（复核人 / 时间 / 结论 + 三项互证：md5 不同、差异像素 5336 个、vision 对两图给出**相反**判定），见 `manual-review-input-state.md` 的「雷同截图复核」节。

---

## 4. post-test 环境残留检查（P6 卡强制步骤）

| 项 | 结果 |
|---|---|
| 检查时刻 | 2026-09-29 01:26（全部验收实跑完成后） |
| 口径 | alice token 调 `GET /api/v1/entries?per_page=100&page=N` **分页扫全量**（该 API 的 `limit` 参数不生效、默认 `per_page=20`，故不使用 `limit`） |
| 扫描结果 | alice 可见 `total=22`，分页 1 页取尽、到手 22 条（无静默截断） |
| **残留命中（`e2e-` 前缀 / 含 `tpv0099`）** | **0 条** |
| BDD-10 自建 entry 清理 | 删除后以 alice 复查 `raw` = **404**（清理判据落在结果上）；登记的 slug 为服务端返回 slug |
| 完整 slug 清单与原始输出 | `residual-check.log` |

生产隔离：`:8080` 全程不可达（`curl` → 000），`~/.peekview/peekview.db` mtime = `2026-09-28 22:22:33`（早于 P6 开工 01:15），验证期间零写入。状态标记 **`[PROD_NOT_TOUCHED]`**。

---

## 5. 环境与纪律

| 项 | 结果 |
|---|---|
| 陷阱 1（Check 6）：跑 E2E 前 build | `make build-frontend-fast` exit 0（`✓ built in 12.76s` / `✓ 388 static files`），复查 `find frontend-v3/src -type f -newer backend/peekview/static/index.html` = 0 行 |
| 陷阱 2：`make debug-test` 必须 `E2E_SPEC` 定向 | 两次调用均带 `E2E_SPEC=`，runner 逐条列出目标用例名（32 passed / 6 passed），未误跑缺省 `debug-server.spec.ts` |
| 陷阱 3：Playwright 清空 `test-results/` | 本任务截图**不落** `frontend-v3/test-results/`，由独立探针直接写入 `P6-evidence/screenshots/`，全程未丢图 |
| 临时/探针文件位置 | 全部落 `/home/kity/oclab/peekview/.agate-tmp/p6/`；`git status --porcelain frontend-v3/` 为空（未抬高 vitest 基线） |
| 命令超时上限 | 所有 bash 命令外层 `timeout`（探针类 180–300s、E2E 类 900s） |
| 禁用手法 | 未 `uvicorn` 直接启动、未 `make debug`、未 `npm run dev`、未触碰生产 `:8080` 与 `~/.peekview/`、未子派发 |

---

## 6. 与 P5 的关系

P5 已 6/6 命令 exit 0（含匿名 E2E 32 passed、auth E2E 6 passed）。本次 P6 **独立重跑**两项 E2E spec 仍为 exit 0（32 / 6 passed，见 `e2e-reuse.log`），并额外为 **19 条 BDD 逐条**产出可独立复核的证据（断言 JSON + 截图 + vision 报告 + 人工复核记录），未复用 P5 结论代替本次验收。

**验收时点的事实**：本次 19 条 BDD 全部 PASS，无 FAIL。验收过程中发现的 3 处非实现问题已记入：① P6 探针脚本自身的变量作用域/断言路径缺陷（修正后重跑通过，与实现无关）；② BDD-16 首版截图与 BDD-1 md5 相同（改为滚动后截图重跑）；③ `P6-dispatch-context-verifier.md` 含 1 处会被 `check-p6-provenance.py` 审计 2 判为「验收结论预判」的示例行（属主 Agent 的派发产物，非 verifier 可改范围，已上报）。
