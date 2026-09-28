# TPV0099 P6 — 输入态/交互形态变化类 BDD 人工复核记录

复核人：verifier（TPV0099 P6 派发角色，独立于 P4 实现者）
复核时间：2026-09-29 01:15–01:35 (+08:00)
复核对象：P6-evidence/screenshots/ + P6-evidence/assert-bdd-{4,5,6,7,8,9,10}.json + P6-evidence/assert-negative-controls.json + P6-evidence/vision-raw/
复核方式：逐张查看该 BDD 的运行时截图/断言文件，并逐条比对 vision-engine 的独立视觉描述（vision-reports/bdd-*.yaml 的 finding 字段），对不一致处做 DOM 溯源判定。

## 为何本条适用

以下 BDD 的 When 子句含输入动作（按键 / 点击），Then 断言的界面状态与该输入相关，按 verifier.md「输入态/交互形态变化类人工复核」判定标准属输入态类，结论不能仅由自动断言给出：

| BDD | When（输入动作） | Then（界面状态变化） | 自动断言证据 | vision 证据 | 复核结论 |
|---|---|---|---|---|---|
| BDD-4 | 按 f / F / Ctrl+f | chrome 可见性 + 内容区几何 + URL 均不变 | assert-bdd-4.json（field-wise 全 true） | —（行为差异类，视觉相同故不截图） | **确认**：按键后快照逐项一致；对照臂（非锁死页按 f）实测**变化**，证明该「不变」不是恒真 |
| BDD-5 | 按 Escape | 同上均不变 | assert-bdd-5.json | —（同上） | **确认**：对照臂（非锁死页按 Escape）实测 zen true→false，而锁死页保持 true |
| BDD-6 | 读取公告区 + 枚举可聚焦元素 | 不宣告退出方式 | assert-bdd-6.json（phrase_hits 空、Escape/exit 子串 false、word_hits 空、作用域内可聚焦 0） | —（查询类） | **确认**：非锁死 zen 下同一作用域公告文本含 Escape 且命中退出词组，判据非恒真 |
| BDD-7 | 点击分页触发控件 → 按 Escape | 浮层关闭 + 全屏保持 | assert-bdd-7.json | bdd-7-open.yaml / bdd-7-closed.yaml（前态「浮层已展开」/ 后态「无展开浮层」） | **确认**：vision 独立确认前态有展开浮层、后态无浮层，且两态均无 chrome |
| BDD-8 | 点击正文内文件间链接 | 正文切换 + /f 保留 | assert-bdd-8.json | bdd-8-before.yaml（长文档 6 个 H2）/ bdd-8-after.yaml（单行占位文本） | **确认**：vision 独立确认切换前后正文内容与篇幅量级显著不同、两侧均无 chrome |
| BDD-9 | 点击正文内标题锚点链接 | 目录侧栏不可见 + 容器 scrollTop 增加 | assert-bdd-9.json（scroll_delta=13731） | bdd-9.yaml（视口顶部已是「10. FAQ」章节、左侧无目录） | **确认**：vision 独立确认页面已滚动到中后段且无目录侧栏 |
| BDD-10 | 匿名访问携带 share token | 全屏成立 + 私有正文可见 | assert-bdd-10.json（三态 [false,false,true]、API 基线 404/404/200） | bdd-10.yaml（正文可见 MARKER、无 401/403 提示、无登录表单） | **确认**：vision 独立确认正文可见且无鉴权失败提示；三态结果互不相同 |

## 雷同截图复核

复核人：verifier　复核时间：2026-09-29 01:33

check-p6-evidence 的 average-hash 检测会把下列两张截图归为「视觉高度相似」（resize 8×8 灰度均值化后 hash 相同）：

- `screenshots/bdd-7-per-page-listbox-open-1280x800.png`（112,458 B，方差 688）
- `screenshots/bdd-7-per-page-listbox-closed-1280x800.png`（111,146 B，方差 692）

**复核结论：确为不同操作状态下截取的两张不同截图，相似属预期而非充数。**

依据（三项互证）：

1. **逐字节不同**：md5 分别为 `8ca1549e29aa34...` / `257ece18c3beb596...`，非同一物理文件。
2. **像素级确有差异**：逐像素差分 bbox = (353, 720, 691, 800)、差异像素 5,336 个（占全图 0.52%）——差异区域正是分页浮层出现/消失的位置（内容区底部）。
3. **vision 独立判定相反**：`bdd-7-open.yaml` 判「有展开的下拉浮层（列出 50 / 100）」；`bdd-7-closed.yaml` 判「没有展开的浮层，仅剩带箭头的 100/page 触发按钮」——同一视觉分析路径对两张图给出相反结论，证明两张图承载的是**不同操作态**。

之所以 avg-hash 相近：全屏表格页面 8×8 缩略后，浮层（约 130×134 px）在缩略图中占比极小，故整体灰度分布未见区分。这属「确为不同操作但视觉相近」情形，按 P6 卡「雷同截图降级待复核」规则附本记录放行。
