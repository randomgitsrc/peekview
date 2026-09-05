# TPV0097 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- NEXT: blocked-dependency（TPV0096 全绿后启动 P1）。期间无动作
- DECISION: 与 TPV0096 拆分立项而非合并——0096 是测试代码改动（小 task），0097 是基建编排（完整流程 + CI 许可项），合并会造出不可验收的大锅
