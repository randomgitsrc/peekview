# TPV0099 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION: 需求来源为用户分享场景（2026-09-16）——接收者拿到非 raw 链接 `/{slug}` 看到的是完整页，希望存在 `/{slug}/f` 直入"只剩主体内容"的视图
- DECISION: URL 格式定 `/{slug}/f`（path 后缀），否决 `?f` query——三点依据：`/{slug}/raw` mode 后缀先例；query 被聊天客户端剪参数的风险（分享场景重灾区）；内部导航保态（path 形态切文件不丢 mode，query 形态丢一次即意外退出全屏）。第三个是决定性差异
- DECISION: 行为定完全锁死（f/Escape 均无效、无页内出口）——用户裁决，接受键盘用户需手动改 URL 的代价；P1 不再重开此决策
- DECISION: 外观定"只剩纯内容"（元信息条一并隐藏）——注意这会统一改变现有 f 键 zen 模式外观（meta 条 可见→隐藏），推荐一套外观而非两套；P1 与用户确认此项
- NEXT: 等用户「开工」指令后进 P1（P1-dispatch-context-analyst.md + AGATE_CARD 注入）。P1 输入须含：三个已锁定决策、zen 外观统一的确认项、后端 `*/f` JSON 边缘的处理取舍
