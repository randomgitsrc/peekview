---
task_id: TPV0104
phase: P6
type: manual-review
agent: verifier
reviewer: verifier-subagent (P6)
reviewed_at: '2026-11-25T23:40:00+08:00'
scope: 输入态 / 交互形态变化类 BDD（判定标准见 agate assets/execution-roles/verifier.md「输入态/交互形态变化类人工复核」）
---

# P6 人工复核记录 — TPV0104

> 触发依据：`verifier.md` 规定「输入态/交互形态变化类用例 = 用户输入（键盘/鼠标/粘贴/手势/拖拽）
> 或动作/特效/时序交互导致界面状态或渲染表现变化，或有时序动效联动的用例」，其 PASS/FAIL 结论
> **必须附人工复核记录（复核人 / 复核时间 / 复核结论）**，不能仅由自动断言通过。
>
> 本文件的复核人即本任务 P6 verifier 子 Agent（执行者与复核者为同一人，属**自复核**；
> 下游 P6.5 judge 会以 fresh context 独立重验，故此处如实标注而非包装成第三方复核）。
>
> 复核手段：**逐条在 headless Chromium 真实浏览器实跑**（Playwright，`127.0.0.1:8888` 的
> debug backend），把 P1 §3 的 Given/When/Then 完整执行一遍，读取运行时 DOM 度量与 URL 状态，
> 并按裁决要求对关键态截图 + 跑 vision 渲染缺陷检测。复核所依据的原始断言输出见
> `P6-evidence/ui-assertions.json` 与 `P6-evidence/logs/ui-run.log`。

## 复核清单（20 条输入态/交互形态类）

| # | BDD | When 子句的输入/动作/时序触发 | Then 断言的界面状态 | 复核人 | 复核时间 | 复核结论 |
|---|---|---|---|---|---|---|
| 1 | BDD-06 | **鼠标点击** TOC 第 2 条，触发 `scrollIntoView({behavior:'smooth'})` 平滑滚动（时序动效） | 2s 内目标标题 `rect.top ∈ [0,200]` | verifier-subagent | 2026-11-25T23:39+08:00 | PASS — 实测滚动高度 3495 > 视口 701（可滚动前提成立），点击后 `targetTop=178.59 ∈ [0,200]`；第 2 轮复拍（`b06b`）同值一致，非偶发 |
| 2 | BDD-14 | **URL 输入** `?file=14` 后加载 | 展示 deployment.yaml 且 `location.search` 仍含 `file=14` | verifier-subagent | 2026-11-25T23:24+08:00 | PASS — 正文含 `Deployment`，`search="?file=14"`，参数在加载后未被清除（区别于点参数写在 URL 上的既有 `firstFileId` 一次性语义） |
| 3 | BDD-15 | **URL 输入** `/{slug}/f?file=15` | zen 态生效 + 展示 service.yaml + `file` 参数仍在 | verifier-subagent | 2026-11-25T23:24+08:00 | PASS — `.entry-detail.zen-mode` 存在，正文含 `Service`，`search="?file=15"` |
| 4 | BDD-16 | **输入无效 id**（`?file=999999`），与有效 id 成对对照 | 回退默认入口、无错误横幅、两侧活跃文件不同 | verifier-subagent | 2026-11-25T23:24+08:00 | PASS — 前置校验（有效 id 命中 `Deployment`）成立，无效 id 命中默认入口「K8s 部署清单」，`error-state=0`、`banner=0`，两侧文本不同 |
| 5 | BDD-17 | **输入跨 entry 的 file id**，与自身非默认 id 成对对照 | 回退 A 默认入口、不泄露 B 内容、无错误横幅 | verifier-subagent | 2026-11-25T23:24+08:00 | PASS — 前置校验（A 自己的 extra.txt id → 命中 `A-EXTRA-MARKER`）成立；跨 entry id → 命中 `A-DEFAULT-MARKER`，B 的独有串**未出现**，`error-state=0` |
| 6 | BDD-18 | **输入非数字参数**（`?file=abc`），与有效数字 id 成对对照 | 回退默认入口、无错误横幅 | verifier-subagent | 2026-11-25T23:24+08:00 | PASS — 前置校验成立；`file=abc` → 默认入口，`error-state=0` |
| 7 | BDD-19 | **鼠标点击**文件树中的 deployment.yaml | URL 同步 `file=14`、正文切换、`history.length` 不增 | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — `search="?file=14"`、正文含 `Deployment`、`history 20→20`（replace 语义，未新增历史） |
| 8 | BDD-20 | **鼠标点击**文件树中的 README.md（切回默认） | `search` 不含 `file=` | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — 切回后 `search=""` |
| 9 | BDD-21 | **执行页面 reload**（重放同一 URL） | 仍展示 deployment.yaml 且 `file` 参数仍在 | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — reload 后正文含 `Deployment`、`search="?file=14"`（持续态语义成立，非一次性种子） |
| 10 | BDD-22 | **URL 同时输入** `share=` 与 `file=` | 分享生效 + 展示指定文件 + 两参数均未被清理 | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — `error=false`、正文含 `SHARE-FILE-MARKER`、`search` 同时含 `share=` 与 `file=110`（逐参数清理生效，未一锅端） |
| 11 | BDD-25 | **鼠标点击**桌面全屏入口（当前为默认文件） | 导航到 `/{slug}/f` 且 `search` 不含 `file=` | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — `pathname="/k8s-deployment/f"`、`search=""` |
| 12 | BDD-26 | **鼠标点击**桌面全屏入口（当前为非默认文件） | 导航到 `/{slug}/f?file=14` 且全屏态展示该文件 | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — `pathname="/k8s-deployment/f"`、`search="?file=14"`、正文含 `Deployment` |
| 13 | BDD-29 | **键盘输入** `f` 与 `Escape`（locked 态按键） | class 仍含 `zen-mode`、pathname 不变 | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — 按键后 `zen-mode` 保留、pathname 未变；另断言退出类可点击元素计数 = 0（决策 A 约束成立） |
| 14 | BDD-30 | **键盘输入** `f`（普通态） | class 含 `zen-mode`，pathname 与 search 均不变 | verifier-subagent | 2026-11-25T23:25+08:00 | PASS — `zen` false→true，`pathname` 与 `search` 逐字符不变（未跳路由） |
| 15 | BDD-54 | **鼠标点击**正文内跨文件链接「English attachment」（全屏态） | 切换文件 + `search` 含 `file=34` + 仍为 zen 态 | verifier-subagent | 2026-11-25T23:26+08:00 | PASS — 链接命中 1 个，点击后正文含 `English attachment placeholder`、`search="?file=34"`、`zen-mode` 仍生效 |
| 16 | BDD-42 | **鼠标选中**一个真实字节 ≥2MiB 而字符 <2MiB 的中文 HTML 文件 | 显示手动渲染按钮、**无** iframe | verifier-subagent | 2026-11-25T23:26+08:00 | PASS — API 核实 `size=2100219`（≥2MiB）且 `content.length=700095`（<2MiB），页面 `iframe` 数 = 0、手动渲染按钮 = 1（证明判定走真实字节而非字符数） |
| 17 | BDD-44 | **鼠标选中**一个字符 <2MiB 而字节 ≥2MiB 的 JSON 文件 | 树视图显示截断提示；同型 <2MiB 文件不显示 | verifier-subagent | 2026-11-25T23:40+08:00 | PASS — 大文件 `size=2100011`、`json.length=700011`，截断提示 = 1；正向对照（`b44b`）同型小 JSON 截断提示 = 0 且树视图正常渲染（`treeList=1`） |
| 18 | BDD-24 | **手势/滚动**（移动端 390×844 滚到底）后测量底栏与正文边界 | 热区落栏内、栏高 ≤64px、正文末元素 bottom ≤ 栏顶 | verifier-subagent | 2026-11-25T23:40+08:00 | PASS — `barHeight=64`、热区 `btnInside=true`、正文末元素 `bottom=779.89 ≤ barTop+1=781`。**注**：首轮 vision 报 1 blocker（判为「代码块文字被裁切」），追查后确认是 `pre.shiki` 的 `overflow-x:auto` 横向滚动（`scrollWidth 493 > clientWidth 307`），属长代码行在窄屏的**既有设计**且本任务未改样式（`git diff 4ec6b1b6~1 4ec6b1b6 -- frontend-v3/src/styles/` 为空）→ 非渲染缺陷；第 4 轮改为裁剪「正文末尾 + 底栏」区域的取证（`b24d`）后 blocker_count=0 |
| 19 | BDD-53 | **URL 输入** `/{slug}/f`（全屏态测量） | 四项 chrome 可视计数 0 + 内容 ≥95% + 侧栏 DOM 0 | verifier-subagent | 2026-11-25T23:26+08:00 | PASS — header/mobileSticky/mobileBar/metaTags 可视计数均为 0，`ratio=1.000`，`.file-sidebar`/`.toc-sidebar` DOM 计数均 0（新增需求：DOM 不存在而非仅 CSS 隐藏） |
| 20 | BDD-52 | **人工体验路径**：按文档 `make debug-seed` 后匿名打开 seed entry | 页面有内容且 TOC 条目 == 4 | verifier-subagent | 2026-11-26T00:00+08:00 | PASS — 正文含「K8s 部署清单」，TOC 条目 = 4（1×h1 + 3×h2，决策 B 生效后 h1 入目录） |

## 复核结论汇总

- 复核 20 条，**全部 PASS**，无一条仅凭自动断言结案——每条都经真实浏览器执行 When 子句的输入/动作后读取 Then 断言的界面状态。
- **自复核声明**：本表由 P6 verifier 自评，属自复核而非第三方独立复核；独立复核由下游 P6.5 judge（fresh context，只读证据与 git log）承担。
- **时序类**（BDD-06 平滑滚动）已按 2s 观测窗取值，并在第 2 轮复拍复核一致性，非单次偶发。
- **滚动前置**（BDD-24）已显式建立「正文可滚动 + 已滚到底」前提，避免对未进入视口的元素误判重叠。
- 所有复核过的现造 entry 均已在同一进程内按 slug 删除并复核 404（见 `P6-evidence/logs/ui-run.log` 的 RESIDUE 行）。
