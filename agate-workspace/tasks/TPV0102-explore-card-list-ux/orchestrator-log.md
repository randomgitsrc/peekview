# TPV0102 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION: 四项合为一个任务而非拆四个——同属 Explore 卡片/列表展示层，且第 3 项要抽 `VisibilityMenu` 三处复用，与第 1、2 项改的是同一批组件（`EntryCard`/`EntryListRow`/`EntryDetailHeader`），拆开会造成四次同样的组件改动
- DECISION: 明确排除 roadmap #57（主文件语义）与 #58（`/f` 多文件指定）——前者动 schema + MCP 契约，后者动已发布的公开 URL 契约（`/{slug}/f` 自 v0.25.0 上线），均需独立评估兼容性；用户已决定留后处理
- DECISION: 时间显示采用「靠浏览器时区 + 强制带时区名」而非引入服务端配置——用户选定。带时区名是消除"这是哪里的时间"歧义的最小手段，无需任何配置
- RISK: 后端存 naive UTC，若 API 返回的时间字符串不带 `Z`/`+00:00`，前端 `new Date()` 会按本地时间解析 → 改显示格式会引入整体时区偏移。P1 必须实查，P2 需给出兜底方案
- NEXT: 等用户「开工」指令后进 P1（写 `P1-dispatch-context-analyst.md` + 注入 AGATE_CARD）
