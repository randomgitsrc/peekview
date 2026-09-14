# TPV0097 orchestrator-log

> 主 Agent 防无响应锚点。派发前写 NEXT，gate 失败写 GATE FAIL + DIAGNOSIS，subagent 失败写 SUBAGENT FAIL，流程决策写 DECISION。

- NEXT: blocked-dependency（TPV0096 全绿后启动 P1）。期间无动作
- DECISION: 与 TPV0096 拆分立项而非合并——0096 是测试代码改动（小 task），0097 是基建编排（完整流程 + CI 许可项），合并会造出不可验收的大锅
- DECISION: TPV0096 已由并行会话完整闭环（P0-P8 + judge 13/13），依赖解除；本会话仅做状态同步，开工待用户指令。另：0096 实施中新增 DEBT0011（t022/verify-mermaid 同型缺陷）与 DEBT0012（seed 422 预存），P1 设计前应纳入输入
- DECISION: 范围修订 v2（用户决策）——原「分片并行」拆出为 TPV0098，本任务改为「统一入口注册表 + CI E2E job + 用例可信治理」。理由：①分片策略的成本模型本地与 CI 相反（本地自有 CPU 宜少 shard，CI 按核计费宜多 shard），无法共用一套 ②分片绿灯只有在用例可信时才有判定意义，顺序上必须先清不可信用例 ③用户要求不拆成三 task，仅析出分片一项
- DECISION: 目录名保留 `TPV0097-e2e-sharding-ci`（与实际范围不再完全对应）——task_id 与路径是 gate-events.jsonl/history 的引用锚点，改名会让已记录的 P0 gate 事件与路径错位；范围以 P0-brief.md v2 为准，此处留痕
- EVIDENCE: 2026-09-08 本轮实测定量（未改任何代码，全部为预存失败）：`E2E_SPEC=e2e/debug-server.spec.ts make debug-test` → 18 failed / 34 passed（9 用例 × chromium+Mobile Chrome，CDP 模式，耗时 4.0m）；`frontend-v3/src/router.ts` 无 `/entries` 路径（仅 `/:slug`）→ DEBT0011 的 `goto('/entries/...')` 必 404；`make debug-seed` 后 DB 真值 entries=20（seed-data 24 条）、teams=2、team_members=1（应 ≥3）、日志 3× HTTP 422
- NEXT: 等用户「开工」指令后进 P1（写 `P1-dispatch-context-analyst.md` + 注入 AGATE_CARD）。P1 输入须含 DEBT0007/0011/0012 三项实测证据与「DEBT0007 是否为 CDP 专属」的判定要求
