---
phase: P0
task_id: TPV0097
task_name: e2e-sharding-ci
trace_id: TPV0097
created: 2026-09-05
updated: 2026-09-14
status: pending
parent: agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained（依赖其全绿）
---

# P0-brief — TPV0097 E2E 入口统一 + CI 门禁 + 用例可信治理

> **v2 范围修订（2026-09-14，用户决策）**：原「分片并行」目标拆出为独立任务 TPV0098；本任务收拢
> ①统一入口注册表 ②CI E2E job ③硬等待重灾区治理 ④**用例可信治理（DEBT0007/0011/0012 并入）**。
> 拆分理由：分片的成本模型在本地与 CI 相反（本地自有 CPU 宜少 shard，CI 按核计费宜多 shard），
> 且分片出的绿灯只有在用例本身可信时才有判定意义——顺序上必须先清不可信用例。

## task

E2E 长期不可用（全量 560s+ 超时、红灯常态化）的基建根治，四个子目标：

1. **统一入口注册表**：把"怎么起服务、端口/数据隔离、怎么跑、跑完怎么收"抽成一处定义，`local` 与 GHA 两个 target 共用同一份逻辑；**必须输出用例数 + 耗时**（当前全量耗时靠人肉估计，成本模型无数据支撑）
2. **CI 接入 E2E job**：`.github/workflows/ci.yml` 增加 E2E job（起 debug 服务 → 跑全量 → 汇总门禁），串行即可（GitHub Actions job 超时上限 360 min，全量约 10 min 在预算内），分片提速由 TPV0098 承接
3. **硬等待重灾区治理**：211 处 `waitForTimeout`（单遍累计 ~238s，retries 最坏 ×3）换条件等待；本 task 先清重灾区（mermaid/debug-server/t090/t049 ~90 处），其余按 touch-to-fix 惯例留 backlog
4. **用例可信治理**（本轮实测新增，DEBT0007/0011/0012 并入）：不可信用例是分片绿灯判定的前提，必须先清

## 需求来源

2026-09-05 裸 SVG 修复回归排查实证（用户提问"全量超 560s 不正常，可以优化么 并行啥的 ci"）：

- 现状结构：chromium+Mobile 双 project ×2、本地 retries 1-2、workers 默认并行但共享 debug DB 制约、waitForTimeout 211 处、CI 无 E2E（AGENTS.md 明记"完整 suite 可能超时 >5min，优先自定义脚本逐项验证"）
- 衍生症状链：全量不可跑 → 不跑 → 红灯无人见（DEBT0010）→ 硬等待无人觉痛

2026-09-14 本轮实测定量（本任务 v2 的直接依据）：

| 债务 | 实测证据 | 登记时描述 |
|------|---------|-----------|
| DEBT0007 | `debug-server.spec.ts` **18 failed / 34 passed**（9 用例 × chromium+Mobile Chrome，CDP 模式） | 仅登记 3 例 |
| DEBT0011 | `router.ts` 无 `/entries` 路由（仅 `/:slug`），`t022-diagram-refactor.spec.ts` 的 `goto('/entries/test-mermaid-*')` 必 404；`.mermaid-action-btn`/`.toolbar-btn` 已迁 `.diagram-action-btn` | 同左 |
| DEBT0012 | seed-data 24 条 vs DB 实存 20 条；`team_members` 仅 1 行（应 ≥3）；日志 3× HTTP 422 | 登记"偶发 3 条未入库" |

## 硬依赖

- **TPV0096 已 DONE**（3 个渲染类 spec 自建 entry 化全绿，DEBT0010 closed）——红灯不清，CI 绿灯无意义
- **用例可信治理（子目标 4）是 CI job（子目标 2）的前置**：DEBT0011 死 spec 与 DEBT0012 seed 时序在任何环境都红/不稳，不修则 CI job 建起来即被堵死（DEBT0010 同款失败模式）

## 关键约束

- **CI 修改是强制许可项**（AGENTS 铁律 5）：`.github/workflows/ci.yml` 改动前需用户明确许可——P2 设计时把 CI 变更清单单独列出，P4 前向用户确认
- **后台服务跨调用姿势**：DSH 沙箱下 DSH 服务存活跟随"起它的那条调用"，跨调用必须挂持续 running 的后台 job 托底（见项目 AGENTS.md「跨调用起服务的正确姿势」）。P6 实跑 CI job 之外的本地验证同样受此约束
- **DEBT0007 的 CDP 条件待澄清**：18 例失败实测于 CDP 模式（`run-e2e-tests.sh` 检测到 :18800 时走 CDP）；CI runner 无 CDP、走本地 Chromium——P1/P2 必须判定这 18 例是"CDP 专属"还是"环境无关"，据此决定修复方向与 CI 是否受影响
- 注册表须 **GHA 可用**：本机可用 CDP/Windows GPU 路径不得成为 CI 的隐式依赖（当前 `run-e2e-tests.sh` 的 CDP 检测即为这类耦合）

## 验收基线（BDD 倾向，P1 细化）

1. Given 干净环境 When 本地统一入口（新 target）Then 全量跑完且**输出用例数 + 总耗时**（附实测数字）
2. Given 同一入口 When 以 `gha` 模式调用 Then 不依赖 CDP/Windows GPU 等本机专属资源，可在 Linux runner 跑通
3. Given CI 环境 When push Then E2E job 起服务并跑全量，结果作为门禁汇总
4. Given 重灾区 spec（mermaid/debug-server/t090/t049）When 条件等待替换后 Then 全绿且不再依赖固定 sleep
5. Given DEBT0011 两 spec When 自建 entry + `goto /:slug` + 选择器迁移后 Then 干净环境全绿（或正式 skip + 原因）
6. Given DEBT0012 When 团队创建/成员添加时序加等待或重试后 Then 连续 10 次 seed 零 422 且 DB 全表稳定
7. Given DEBT0007 18 例 When 按 CDP 归属判定修复后 Then 在判定适用环境下全绿（或登记为环境专属并 skip + 原因）

## 已知风险

- **DEBT0007 性质未定**：若为 CDP 专属，CI 侧不受影响但本地验证信号长期失真（掩盖登录态回归）；若环境无关，CI job 必先修它才能上线
- CI runner 成本：playwright browsers 安装时长；串行全量约 10 min（在 job 上限内但占用额度）
- `gha` 模式抽象可能过度：注册表若为兼容两环境引入大量分支，反而比现状更难维护——P2 需给出"最小共形"设计而非通用框架
- DEBT0012 的 422 可能在 CI 侧表现为随机数据缺失（比本地更隐蔽，因无人工观察）

## 裁剪倾向

- P2：完整走（多候选决策点：注册表抽象边界 / `gha` 模式形态 / DEBT0007 归属判定 / 硬等待替换策略）
- P3：保留（注册表 + Makefile target 有可测行为；用例治理由 E2E 自身验证）
- P6：不可裁——全量实跑 + 用例数/耗时数字 + CI job 实跑日志 + 各债务 closure criteria 逐条证据
- P8：纯测试基建，无产品行为变更——不 bump 版本，CHANGELOG [Unreleased] 记录
