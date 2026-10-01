---
phase: P0
task_id: TPV0100
task_name: web-publish
trace_id: TPV0100-P0-20261001
status: pending
created: 2026-10-01
---

# P0-brief — TPV0100 网页发布入口

## task

为登录用户提供网页发布入口，复用 POST /api/v1/entries，让前端成为该端点的第 4 个调用方（与 CLI-remote、MCP-remote、MCP-local 同契约）。

## known_risks

- 涉及数据 schema 变更：否（仅复用端点，模型未动）
- 跨越 3 个改动端：否，仅 frontend 改动（API 不变，后端零改动），端点调用方从 3 增至 4
- 修改权限/认证逻辑：否（复用现有 cookie/JWT/API key，无新鉴权）
- 同类/影响面预判：经全仓 grep `publish_files` / `create_entry`，仅三处（CLI、MCP、HTTP API），本任务为第 4 个端点调用方，未发现其他改动点。

## executor_env

platform: opencode
has_task_tool: true
has_local_runtime: true
network: full
model_tier: standard

## env_constraints

debug_env: "make debug-start（启动 :8888）并保持服务存活（如后台 job 托底）"

## phase_hint

[P1, P2, P3, P4, P5, P6, P8]

---