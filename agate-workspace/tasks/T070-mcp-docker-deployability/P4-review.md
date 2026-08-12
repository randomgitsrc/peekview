---
phase: P4
task_id: T070
type: review
parent: P4-implementation.md
trace_id: T070-P4-review-20260725
status: approved
created: 2026-07-25
agent: review-lead
---

# P4 Review — 汇总

## 评审专家

| 专家 | 文件 | 结论 |
|------|------|------|
| MCP 接口契约 | P4-review-mcp.md | approved — 无 CRITICAL/BLOCKER |
| CSO 安全审查 | P4-review-cso.md | approved — 无 CRITICAL/HIGH/BLOCKER，5 项 LOW |

## 审查范围

| 文件 | 改动类型 |
|------|----------|
| `packages/mcp-server/src/tools/publishFiles.ts` | CWD guard 修复 + description 增强 |
| `packages/mcp-server/src/config/merge.ts` | allowed_paths 字符串容错 |
| `packages/mcp-server/src/server.ts` | /health 增加 cwd/mode/allowed_paths |
| `packages/mcp-server/src/cli/config.ts` | config list runtime 节 + config verify 可读性检查 |

## 严重性汇总

| 级别 | 数量 | 来源 |
|------|------|------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 5 | CSO 审查项 1~5 |
| INFORMATIONAL | 1 | MCP 审查：/health allowed_paths 暴露 |

## 关键结论

### 1. CWD guard 修复 — 安全语义保持 ✅

三条件 AND（`isCwdRoot && !trustAllPaths && allowedPaths.length === 0`）语义正确：
- 未配 allowed_paths + cwd=/ → 仍拒绝（BDD-2）
- 已配 allowed_paths + cwd=/ → 放行（修复前误拒，BDD-1）
- trust_all_paths + cwd=/ → 放行（denylist 仍生效，BDD-5）

### 2. allowed_paths 容错 — 无注入风险 ✅

空字符串过滤 + denylist 兜底 + 后续 path.resolve 规范化构成多层防御。

### 3. /health 新增字段 — 信息泄露风险 LOW ✅

cwd/mode/allowed_paths 与已有暴露字段敏感度相当；remote 模式下 allowed_paths 强制为空数组。

### 4. 向后兼容 ✅

- publish_files inputSchema 无变更，输出结构不变
- /health 只追加字段，不修改/删除现有字段
- config list/verify 追加节，现有输出格式不变
- 错误信息格式一致（均以 `ERROR:` 开头）

## BDD 覆盖

BDD-1~17 全部有对应测试且通过（14 test files, 220 tests passed）。

## 非阻塞建议

1. /health 可考虑拆分公开/认证两个层级（未来优化）
2. mergeConfig 可在配置加载阶段对 allowed_paths 做 path.resolve + denylist 预检（防御纵深）
3. trust_all_paths 的 warning 日志可追加 cwd 值，帮助运维识别 cwd=/ 场景

## 最终判定

**status: approved** — 全票无 BLOCKER，无 CRITICAL，无 HIGH。最高严重级别 LOW，不阻塞发布。
