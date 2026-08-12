---
task_id: T087-code-linenumber-offbyone
generated_by: main
---
# 已知失败登记

> **语义边界**：本文件只登记**预存失败**（P5 之前就存在的、与当前任务无关的失败）。

## 预存失败（非本任务引入）

| # | 测试文件 | 失败数 | 根因 | 与本任务相关 | 处理计划 |
|---|---------|--------|------|-------------|---------|
| 1 | frontend-v3/e2e/viewer.spec.ts | 全部（多 TC） | 路由不匹配（spec 用 `/#/entry/{slug}` hash 路由 + `/entry/` 前缀，实际是 `createWebHistory()` + `/:slug` history 模式）+ 硬编码 slug `lu4prg`/`ngajri` 在 seed 数据中不存在（seed-debug.py 用目录名作 slug） | 否 | 推迟到独立 task（viewer.spec.ts 路由 + slug 更新） |

## 详细说明

### viewer.spec.ts 预存失败

**判定依据**：
- `git log -- frontend-v3/e2e/viewer.spec.ts` 显示该文件上次改动在 commit `743e2ea2`（tag v0.1.22），远早于 T087
- T087 改动文件仅 `frontend-v3/src/composables/useShiki.ts`，未触碰 `viewer.spec.ts` 或 `router.ts`
- 路由从 hash 改 history 的时间早于 T087（router.ts 用 `createWebHistory`，最近改动是 T080/T069/T068）

**影响**：
- P5_e2e 的 gate_commands.P5_e2e（`E2E_SPEC=e2e/viewer.spec.ts make debug-test`）全部失败
- verifier 编写临时验证 spec（`e2e/t087-verify.spec.ts`，已用后删除）用正确路由 `/{slug}` + 动态创建 entry 验证 T087，6 测试全绿

**处理**：登记为预存失败，推迟到独立 task 修复 viewer.spec.ts 路由 + 硬编码 slug。不影响 T087 推进。

## P5 验证替代方案

由于 viewer.spec.ts 预存失败无法验证 T087，P5 E2E 用临时 spec 验证 BDD-1/2/5/6/7/9（6 测试全绿 + 6 截图）。P6 验收将复用这些证据。
