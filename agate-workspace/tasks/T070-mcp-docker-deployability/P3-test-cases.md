---
phase: P3
task_id: T070
type: test-cases
parent: P2-design.md
trace_id: T070-P3-20260725
status: draft
created: 2026-07-25
agent: test-designer
test_code_dir: packages/mcp-server/tests/
---

# P3 Test Cases — T070 MCP Docker Deployability

## Test Code Files

| File | BDD Coverage |
|------|-------------|
| `t070-publishFiles-cwd-guard.test.ts` | BDD-1~6 |
| `t070-config-allowed-paths.test.ts` | BDD-7~9 |
| `t070-cli-config-list.test.ts` | BDD-10~12 |
| `t070-cli-config-verify.test.ts` | BDD-13~14 |
| `t070-server-health.test.ts` | BDD-15~17 |

## Test Cases

### BDD-1: 已配 allowed_paths 且 cwd=/ 时 publish_files 正常工作

- **Test**: `BDD-1: cwd=/ + allowed_paths=["/data"] → publish_files 成功`
- **Method**: Mock `process.cwd()` to return `/`, create temp file in allowed dir, call `publishFilesTool.handler`
- **Assert**: Result contains "已发布", no "ERROR"
- **Status**: RED (current code unconditionally rejects when cwd=/)

### BDD-2: 未配 allowed_paths 且 cwd=/ 时 publish_files 被拒绝

- **Test**: `BDD-2: cwd=/ + no allowed_paths + trust_all_paths=false → 拒绝`
- **Method**: Mock `process.cwd()` to return `/`, call handler with no allowed_paths
- **Assert**: Result contains "ERROR", no "已发布"
- **Status**: GREEN (current code already rejects — regression guard)

### BDD-3: 已配 allowed_paths 且 cwd 非根目录时行为不变

- **Test**: `BDD-3: cwd=/home/user + allowed_paths=["/data"] → publish_files 成功`
- **Method**: Normal cwd, create temp file in allowed dir
- **Assert**: Result contains "已发布"
- **Status**: GREEN (behavior unchanged — regression guard)

### BDD-4: 未配 allowed_paths 且 cwd 非根目录时行为不变

- **Test**: `BDD-4: cwd=/home/user + no allowed_paths → publish_files 成功（默认 cwd+tmpdir）`
- **Method**: Normal cwd, create temp file in tmpdir
- **Assert**: Result contains "已发布"
- **Status**: GREEN (behavior unchanged — regression guard)

### BDD-5: trust_all_paths=true 且 cwd=/ 时 publish_files 正常工作

- **Test**: `BDD-5: cwd=/ + trust_all_paths=true + no allowed_paths → publish_files 成功`
- **Method**: Mock `process.cwd()` to return `/`, trustAllPaths=true
- **Assert**: Result contains "已发布", no "ERROR"
- **Status**: RED (current code unconditionally rejects when cwd=/, ignores trustAllPaths)

### BDD-6: cwd=/ 且未配 allowed_paths 时错误信息包含两个原因

- **Test**: `BDD-6: 错误信息同时包含"cwd 为根目录"和"未配置 allowed_paths"`
- **Method**: Mock `process.cwd()` to return `/`, no allowed_paths, check error message
- **Assert**: Error text contains "根目录", "allowed_paths", "trust_all_paths"
- **Status**: RED (current error message lacks trust_all_paths mention)

### BDD-7: YAML 文件中 allowed_paths 写为冒号分隔字符串时自动解析为数组

- **Test**: `BDD-7: allowed_paths 为字符串 "/data:/tmp" → 解析为 ["/data", "/tmp"]`
- **Method**: Pass ConfigFileData with `allowed_paths: "/data:/tmp"` (string) to `mergeConfig`
- **Assert**: `result.allowedPaths` equals `["/data", "/tmp"]`
- **Status**: RED (`.map is not a function` — current code assumes array)

### BDD-8: YAML 文件中 allowed_paths 写为数组时正常工作

- **Test**: `BDD-8: allowed_paths 为数组 ["/data", "/tmp"] → 正常解析`
- **Method**: Pass ConfigFileData with `allowed_paths: ["/data", "/tmp"]` to `mergeConfig`
- **Assert**: `result.allowedPaths` equals `["/data", "/tmp"]`
- **Status**: GREEN (current code handles arrays correctly — regression guard)

### BDD-9: 空 allowed_paths 数组等同于未配置

- **Test**: `BDD-9: allowed_paths=[] → 视为未配置，allowedPaths 为空数组`
- **Method**: Pass ConfigFileData with `allowed_paths: []` to `mergeConfig`
- **Assert**: `result.allowedPaths` equals `[]`
- **Status**: GREEN (current code handles empty arrays correctly — regression guard)

### BDD-10: config list 显示运行时 cwd

- **Test**: `BDD-10: config list 输出包含 cwd 信息`
- **Method**: Create config file, call `configListAction()`, capture console output
- **Assert**: Output matches `/runtime:|cwd:\s*\//`
- **Status**: RED (current configListAction only reads file, no runtime section)

### BDD-11: config list 显示 env 覆盖后的最终生效值

- **Test**: `BDD-11: env MCP_ALLOWED_PATHS 覆盖文件配置，config list 显示最终值`
- **Method**: Set `MCP_ALLOWED_PATHS=/data:/tmp` env, create config file without allowed_paths, call `configListAction()`
- **Assert**: Output contains `/data` and `/tmp` (env-merged value)
- **Status**: RED (current configListAction only reads file, ignores env)

### BDD-12: config list 新增字段不改变现有输出格式

- **Test**: `BDD-12: 现有字段（server/port/url 等）格式不变，新增字段追加`
- **Method**: Create config file with known values, call `configListAction()`
- **Assert**: Output contains "44444", "127.0.0.1", "debug", "port", "host"
- **Status**: GREEN (existing fields unchanged — regression guard)

### BDD-13: config verify 测试 allowed_paths 文件可读性

- **Test**: `BDD-13: allowed_paths 路径可读 → 输出包含可读性验证结果`
- **Method**: Create config with readable dir in allowed_paths, mock fetch for health check, call `verifyAction()`
- **Assert**: Output matches `/allowed_paths.*可读|可读性/`
- **Status**: RED (current verifyAction has no allowed_paths readability check)

### BDD-14: config verify 报告不可读的 allowed_paths

- **Test**: `BDD-14: allowed_paths 含 /nonexistent → 输出报告不可读`
- **Method**: Create config with `/nonexistent/path/that/does/not/exist` in allowed_paths, mock fetch, call `verifyAction()`
- **Assert**: Output matches `/nonexistent.*不可读|不可读.*nonexistent/`
- **Status**: RED (current verifyAction has no allowed_paths readability check)

### BDD-15: /health 返回 cwd 和 mode 信息（local 模式）

- **Test**: `BDD-15: local 模式 /health 包含 cwd 和 mode 字段`
- **Method**: Create Express app with local mode config, `GET /health` via supertest
- **Assert**: Response `config` has `cwd` and `mode` properties, `mode` is "local"
- **Status**: RED (current /health config lacks `cwd` and `mode` fields)

### BDD-16: /health 返回 allowed_paths 信息（local 模式）

- **Test**: `BDD-16: local 模式 /health 包含 allowed_paths 字段`
- **Method**: Create Express app with local mode + allowed_paths=["/data"], `GET /health`
- **Assert**: Response `config.allowed_paths` contains "/data"
- **Status**: RED (current /health config lacks `allowed_paths` field)

### BDD-17: /health 在 remote 模式下 cwd/allowed_paths 语义正确

- **Test**: `BDD-17: remote 模式 /health 的 allowed_paths 为空或不适用`
- **Method**: Create Express app with remote mode, `GET /health`
- **Assert**: Response `config.mode` is "remote", `config.allowed_paths` is `[]`
- **Status**: RED (current /health config lacks `cwd`, `mode`, `allowed_paths` fields)

### BDD-18~24: Manual Verification

| BDD | Description | Verification Method |
|-----|-------------|-------------------|
| BDD-18 | mcp-server/README.md namespace 语义描述正确 | Manual: grep README for "自动翻译"/"映射到主机" (should not exist), check for "volume mount 必须同路径" |
| BDD-19 | mcp-server/README.md allowed_paths 格式区分 | Manual: check README has both YAML array and env colon-separated examples |
| BDD-20 | mcp-server/README.md Docker 示例不使用不存在的镜像名 | Manual: grep README for `peekview:latest` / `peekview/mcp-server:latest` (should not exist) |
| BDD-21 | 三份 README 均有 Docker 场景指引 | Manual: check all 3 READMEs contain "Docker" and "allowed_paths" |
| BDD-22 | 根 README.md 包含 OpenCode/Cursor 接入示例 | Manual: check root README contains "OpenCode" and "Cursor" keywords |
| BDD-23 | publish_files 工具描述包含 Docker 场景提示 | Manual: check tool description contains Docker/container cwd=/ hint |
| BDD-24 | publish_files 工具描述包含诊断命令提示 | Manual: check tool description contains "config verify" hint |

## Red Light Summary

| Category | RED | GREEN (regression) | Total |
|----------|-----|--------------------|----|
| CWD guard (BDD-1~6) | 3 | 3 | 6 |
| allowed_paths tolerance (BDD-7~9) | 1 | 2 | 3 |
| config list (BDD-10~12) | 2 | 1 | 3 |
| config verify (BDD-13~14) | 2 | 0 | 2 |
| /health (BDD-15~17) | 3 | 0 | 3 |
| **Total** | **11** | **6** | **17** |

GREEN tests are regression guards for "behavior unchanged" BDDs — they verify existing correct behavior is preserved after implementation.

## Test Run Command

```bash
cd packages/mcp-server && npx vitest run tests/t070-*.test.ts
```
