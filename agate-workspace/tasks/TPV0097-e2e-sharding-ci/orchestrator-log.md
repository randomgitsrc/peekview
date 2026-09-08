# TPV0097 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- NEXT: blocked-dependency（TPV0096 全绿后启动 P1）。期间无动作
- DECISION: 与 TPV0096 拆分立项而非合并——0096 是测试代码改动（小 task），0097 是基建编排（完整流程 + CI 许可项），合并会造出不可验收的大锅
- DECISION: TPV0096 已由并行会话完整闭环（P0-P8 + judge 13/13），依赖解除；本会话仅做状态同步，开工待用户指令。另：0096 实施中新增 DEBT0011（t022/verify-mermaid 同型缺陷）与 DEBT0012（seed 422 预存），P1 设计前应纳入输入
