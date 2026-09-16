# TPV0098 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- DECISION: 立项来源为 TPV0097 v2 范围修订（用户决策，2026-09-14）——原 0097 的「分片并行」整体析出为本任务，0097 只留统一入口注册表 + CI E2E job + 用例可信治理
- DECISION: 分片不直接并入 0097 的理由是成本模型相反——本地自有 CPU（多开会互相抢核，宜少 shard），CI 按核计费（分片真能缩短墙钟并省钱），最优 shard 数与验收口径不同，混在一个 task 里会互相牵制
- NEXT: 等用户「开工」指令后进 P1。P1 须先锁定与 TPV0097 的接口边界：分片入口复用 0097 的统一注册表，还是本任务自建（若 0097 未交付则不得悬空）
