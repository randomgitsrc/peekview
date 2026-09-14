---
phase: P0
task_id: TPV0098
task_name: e2e-local-sharding
trace_id: TPV0098
created: 2026-09-08
status: pending
parent: agate-workspace/tasks/TPV0097-e2e-sharding-ci（由其 v2 范围修订析出）
---

# P0-brief — TPV0098 本机 E2E 分片并行 + 硬等待治理

> 本任务由 TPV0097 v2 范围修订析出（2026-09-08，用户决策）。原 0097 的「分片并行」目标整体移入本处，
> 0097 侧保留统一入口注册表 + CI job + 用例可信治理。拆分依据：分片的成本模型本地与 CI 相反——
> 本地是自有 CPU（少 shard 更省，多开会互相抢核），CI 是按核计费（分片才能真正缩短墙钟并省钱），
> 两边的"最优 shard 数"与验收口径不同，混在一个 task 里会互相牵制验收基线。

## task

本机（开发机）E2E 全量提速，两个子目标：

1. **分片并行**：`make debug-extra PORT=8889/8890`（TPV0092 多实例基建现成）+ Playwright `--shard=x/y`，每 shard 指向独立实例 + 独立 DB——消除共享 debug DB 对并行的制约（fixture 互踩根因）。shard 数按**本机核数**定，须给出实测时间对比
2. **硬等待治理（剩余部分）**：211 处 `waitForTimeout`（单遍累计 ~238s，retries 最坏 ×3）换条件等待。重灾区（mermaid/debug-server/t090/t049 ~90 处）由 TPV0097 处理，本任务收尾剩余 ~120 处（touch-to-fix 之外的集中清理）

## 需求来源

2026-09-05 用户提问「全量超 560s 不正常，可以优化么 并行啥的 ci」，经 2026-09-08 范围重划后归属本任务：

- 现状：chromium+Mobile 双 project ×2、本地 retries 1-2、workers 默认并行但共享 debug DB 制约、waitForTimeout 211 处
- 本地瓶颈与 CI 不同：本地已有 CPU 可并行，卡点是**共享 DB 互踩**（TPV0092 已备多实例基建）与**硬等待累积**

## 硬依赖

- **TPV0097 的用例可信治理是先决条件**：死 spec（DEBT0011）与 seed 时序缺陷（DEBT0012）不清，分片后的绿灯判定无意义（红灯均摊到各 shard 仍是红灯，且更难看清单个 shard 的真实状态）
- **TPV0096 已 DONE**（DEBT0010 closed，渲染类 spec 自建 entry 全绿）
- **TPV0097 的注册表**：本任务的本地分片入口应复用 0097 交付的统一入口注册表（`local` / `gha` 之外的 shard 模式），而非另起一套跑法——若 0097 未交付，需在 P1 明确两任务的接口边界

## 关键约束

- **后台服务跨调用姿势**：DSH 沙箱下服务存活跟随"起它的那条调用"，跨调用必须挂持续 running 的后台 job 托底（见项目 AGENTS.md「跨调用起服务的正确姿势」）；多实例编排（8889/8890 同时在线）同样受此约束
- **后台服务只走 `make debug-extra` → `scripts/dev-server.sh`**（TPV0092 P6 教训：禁止裸启动 uvicorn/setsid/nohup）
- **端口 + 数据双隔离已验证**：`PORT` → `DATA_DIR=/tmp/peekview-debug-${PORT}` → `DB_PATH` 三级独立（TPV0092 基建）
- shard 数按本机核数定（不照搬 CI）——须实测给出"shard 数 vs 墙钟"曲线或至少 2-3 个点的对比
- static 产物所有实例共享（构建产物非数据，TPV0092 已验证合理）

## 验收基线（BDD 倾向，P1 细化）

1. Given 干净环境 When 本机分片入口（新 target）Then 全量分片并行跑完，总耗时显著低于单实例串行（附 shard 数 + 时间对比实测证据）
2. Given 分片运行 When 各 shard 完成彼此 Then 各实例 DB/端口零交叉（fixture 无互踩），且每个 shard 的失败集合可独立读出
3. Given shard 数调整 When 改变 N Then 给出墙钟变化数据，并据此固定本机默认 shard 数（有依据而非拍定）
4. Given 剩余 ~120 处 `waitForTimeout` When 条件等待替换后 Then 全绿且不再依赖固定 sleep（替换数量与位置可核）

## 已知风险

- 分片负载均衡：playwright 内置 shard 按文件均分，spec 大小不均可能倾斜——P2 评估分组策略
- 本机资源争抢：多实例 + 多 worker 同时跑，CPU/内存饱和可能反而变慢——P2 需给出 shard 数上限依据
- 两任务接口耦合：0097 的注册表若未交付，本任务可能被迫自建跑法，导致入口分裂——P1 必须锁定接口
- 硬等待替换的回归风险：条件等待写错会引入 flaky（比固定 sleep 更难诊断）

## 裁剪倾向

- P2：完整走（多候选决策点：shard 分组策略 / 本机 shard 数 / 与 0097 注册表的接口形态）
- P3：保留（分片编排 + Makefile target 有可测行为；硬等待替换由 E2E 自身验证）
- P6：不可裁——分片时间对比 + 隔离证据 + 失败集合独立可读的实跑证据
- P8：纯测试基建，无产品行为变更——不 bump 版本，CHANGELOG [Unreleased] 记录
