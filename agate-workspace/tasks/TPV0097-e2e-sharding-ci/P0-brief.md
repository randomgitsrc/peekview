---
phase: P0
task_id: TPV0097
task_name: e2e-sharding-ci
trace_id: TPV0097
created: 2026-09-05
status: pending
parent: agate-workspace/tasks/TPV0096-e2e-fixture-selfcontained（依赖其全绿）
---

# P0-brief — TPV0097 E2E 提速与 CI 门禁：分片并行 + CI E2E job + 硬等待治理

## task

E2E 全量长期不可用（812 用例 / 560s+ 超时）的基建根治，三个子目标：

1. **分片并行**：`debug-extra PORT=8889/8890`（TPV0092 多实例基建现成）+ Playwright `--shard=x/y`，每 shard 指向独立实例+独立 DB——消除共享 debug DB 对并行的制约（fixture 互踩根因）
2. **CI 接入 E2E job**：`.github/workflows/ci.yml` 增加 E2E job（起 debug 服务 + shard 并行 + 汇总）
3. **硬等待治理（重灾区优先）**：211 处 `waitForTimeout`（单遍累计 ~238s，retries 最坏 ×3）换条件等待；本 task 先清重灾区（mermaid/debug-server/t090/t049 ~90 处），其余按 touch-to-fix 惯例留 backlog

## 需求来源

2026-09-05 裸 SVG 修复回归排查实证（用户提问"全量超 560s 不正常，可以优化么 并行啥的 ci"）：

- 现状结构：chromium+Mobile 双 project ×2、本地 retries 1-2、workers 默认并行但共享 debug DB 制约、waitForTimeout 211 处、CI 无 E2E（AGENTS.md 明记"完整 suite 可能超时 >5min，优先自定义脚本逐项验证"）
- 衍生症状链：全量不可跑 → 不跑 → 红灯无人见（DEBT0010）→ 硬等待无人觉痛

## 硬依赖

**TPV0096 必须先完成**（3 个红灯 spec 自建 entry 化全绿）——红灯不清，分片后的绿灯判定无意义。

## 关键约束

- **CI 修改是强制许可项**（AGENTS 铁律 5）：`.github/workflows/ci.yml` 改动前需用户明确许可——P2 设计时把 CI 变更清单单独列出，P4 前向用户确认
- 后台服务只走 `make debug-extra` → `scripts/dev-server.sh`（TPV0092 P6 教训：禁止裸启动）
- shard 数初判 2-3（每 shard 一个独立 :PORT + /tmp/peekview-debug-PORT 数据目录，端口+数据双隔离已验证）
- Mobile Chrome project 是否保留于 CI（runner 资源 vs 覆盖）——P2 决策点

## 验收基线（BDD 倾向，P1 细化）

1. Given 干净环境 When `make debug-test-sharded`（新 target）Then 全量分片并行跑完且总耗时 < 单实例串行的一半（附时间对比证据）
2. Given 分片运行 When 任意 shard 完成彼此 Then 各实例 DB/端口零交叉（fixture 无互踩）
3. Given CI 环境 When push Then E2E job 分片跑全量并汇总门禁
4. Given 重灾区 spec（mermaid/debug-server/t090/t049）When 条件等待替换后 Then 全绿且不再依赖固定 sleep

## 已知风险

- CI runner 资源：playwright browsers 安装时长、2-3 shard 并发的 CPU/内存配额
- 分片负载均衡：playwright 内置 shard 按文件均分，spec 大小不均可能倾斜——P2 评估分组策略
- debug-extra 与主 debug 实例的 static 共享（构建产物非数据，TPV0092 已验证合理）

## 裁剪倾向

- P2：完整走（多候选决策点：shard 分组策略 / Mobile 保留与否 / CI 触发时机）
- P3：保留（分片编排 + Makefile target 有可测行为；硬等待替换由 E2E 自身验证）
- P6：不可裁——全量时间对比 + 分片隔离证据 + CI job 实跑日志
- P8：纯测试基建，无产品行为变更——不 bump 版本，CHANGELOG [Unreleased] 记录
