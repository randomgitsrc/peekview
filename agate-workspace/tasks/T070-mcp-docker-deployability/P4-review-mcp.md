---
phase: P4
task_id: T070
type: review
parent: P4-implementation.md
trace_id: T070-P4-review-mcp-20260725
status: approved
created: 2026-07-25
agent: review
---

# P4 Review — MCP 接口契约

## 审查范围

| 文件 | 改动类型 |
|------|----------|
| `packages/mcp-server/src/tools/publishFiles.ts` | CWD guard 修复 + description 增强 |
| `packages/mcp-server/src/config/merge.ts` | allowed_paths 字符串容错 |
| `packages/mcp-server/src/server.ts` | /health 增加 cwd/mode/allowed_paths |
| `packages/mcp-server/src/cli/config.ts` | config list runtime 节 + config verify 可读性检查 |

## Pass 1 — CRITICAL（数据安全与正确性）

### CWD guard 修复 — 安全语义保持 ✅

**旧逻辑**（`publishFiles.ts` L338-346）：
```typescript
if (path.resolve(cwd) === path.parse(cwd).root) { → 拒绝 }
```
无条件拒绝 cwd=/，即使已配 allowed_paths 或 trust_all_paths。

**新逻辑**（`publishFiles.ts` L343-344）：
```typescript
const isCwdRoot = path.resolve(cwd) === path.parse(cwd).root;
if (isCwdRoot && !config.trustAllPaths && config.allowedPaths.length === 0) { → 拒绝 }
```

三条件 AND：`isCwdRoot && !trustAllPaths && allowedPaths.length === 0`。

| 场景 | 旧行为 | 新行为 | 安全语义 |
|------|--------|--------|----------|
| cwd=/, 无 allowed_paths, trust=false | 拒绝 | 拒绝 | ✅ 不变 |
| cwd=/, 有 allowed_paths, trust=false | **拒绝（bug）** | 放行 | ✅ 修复，白名单已约束范围 |
| cwd=/, 无 allowed_paths, trust=true | **拒绝（bug）** | 放行 | ✅ 修复，trust 跳过白名单 |
| cwd≠/, 无 allowed_paths, trust=false | 放行 | 放行 | ✅ 不变 |

BDD-1~5 覆盖全部 4 种场景。**无 CRITICAL**。

### allowed_paths 容错 — 无注入风险 ✅

`merge.ts` L81-87：`typeof raw === 'string' ? raw.split(':').filter(p => p.length > 0) : Array.isArray(raw) ? raw : []`

- 空字符串 split 后 filter 过滤 → 不会产生空路径进入白名单
- 非字符串非数组 → 降级为空数组 → 等同未配置
- BDD-7/8/9 覆盖字符串/数组/空数组三种输入

**无 CRITICAL**。

### /health allowed_paths 暴露路径信息 — INFORMATIONAL

`server.ts` L261：`allowed_paths: config.mode === 'local' ? config.allowedPaths : []`

/health 端点暴露 allowed_paths 路径列表。P2-design 已评估：/health 需网络访问，allowed_paths 是白名单非敏感数据。remote 模式下返回空数组。**可接受**。

## Pass 2 — INFORMATIONAL（代码健康）

### publish_files 输入/输出向后兼容 ✅

| 契约项 | 变更 | 兼容性 |
|--------|------|--------|
| inputSchema | 无变更（diff 确认） | ✅ 完全兼容 |
| 成功输出格式 | 无变更 | ✅ 完全兼容 |
| CWD guard 错误输出 | 文本内容变更，结构不变（`{ type: 'text', text: '...' }`） | ✅ 结构兼容 |
| 其他错误输出 | 无变更 | ✅ 完全兼容 |

CWD guard 错误信息从单行变为多行（含原因+解决方案+诊断命令），但 MCP 工具返回结构（`content: [{ type: 'text', text }]`）不变。Agent 解析 `content[0].text` 的逻辑不受影响。**向后兼容**。

### /health 响应向后兼容 ✅

| 字段 | 旧 | 新 | 兼容性 |
|------|----|----|--------|
| status | ✅ | ✅ | 不变 |
| version | ✅ | ✅ | 不变 |
| peekview | ✅ | ✅ | 不变 |
| config.source | ✅ | ✅ | 不变 |
| config.path | ✅ | ✅ | 不变 |
| config.peekview_url | ✅ | ✅ | 不变 |
| config.public_url | ✅ | ✅ | 不变 |
| config.api_key_configured | ✅ | ✅ | 不变 |
| config.cwd | ❌ | ✅ | **追加**，不影响现有消费者 |
| config.mode | ❌ | ✅ | **追加** |
| config.allowed_paths | ❌ | ✅ | **追加** |
| peekview_error | ✅ | ✅ | 不变 |

只追加字段，不修改/删除现有字段。BDD-15/16/17 验证新字段存在且现有字段不变。**向后兼容**。

### config list 输出向后兼容 ✅

新增 `runtime:` 节追加在现有输出之后（`path_namespaces` 之后、`Available config keys` 之前）。现有字段（peekview/server/logging/path_namespaces）格式完全不变。BDD-12 验证现有字段格式不变。

mergeConfig 失败时优雅降级：显示 `cwd` + `(merge failed — missing required config)`，不阻断 config list 命令。**向后兼容**。

### config verify 输出向后兼容 ✅

新增 `allowed_paths 可读性检查:` 节追加在现有验证步骤之后。现有输出（配置文件/URL 连通性/API key 认证/public_url）不变。不可读路径设置 `allOk = false` 导致 exit(1)，与现有错误处理一致。BDD-13/14 覆盖。**向后兼容**。

### 错误信息格式一致性 ✅

| 错误来源 | 格式 | 一致性 |
|----------|------|--------|
| CWD guard | `ERROR: ...` + 多行原因/方案 | 与 formatSecurityError 风格一致 |
| SecurityRejection | `ERROR: 发布被拒绝：...` + 多行详情 | 不变 |
| 文件数/大小超限 | `ERROR: ...` 单行 | 不变 |
| 无可发布文件 | `ERROR: ...` + skipped 详情 | 不变 |

CWD guard 错误信息从单行变为多行，但以 `ERROR:` 开头，与所有其他错误信息格式一致。**格式一致**。

### publish_files description 增强 ✅

追加 3 行（Docker/troubleshooting/namespace），总 description 仍精炼。BDD-23/24 覆盖。不影响 inputSchema 或 handler 逻辑。

## BDD 覆盖矩阵

| BDD | 测试文件 | 状态 |
|-----|----------|------|
| BDD-1 | t070-publishFiles-cwd-guard.test.ts:65 | ✅ |
| BDD-2 | t070-publishFiles-cwd-guard.test.ts:87 | ✅ |
| BDD-3 | t070-publishFiles-cwd-guard.test.ts:102 | ✅ |
| BDD-4 | t070-publishFiles-cwd-guard.test.ts:120 | ✅ |
| BDD-5 | t070-publishFiles-cwd-guard.test.ts:138 | ✅ |
| BDD-6 | t070-publishFiles-cwd-guard.test.ts:160 | ✅ |
| BDD-7 | t070-config-allowed-paths.test.ts:16 | ✅ |
| BDD-8 | t070-config-allowed-paths.test.ts:31 | ✅ |
| BDD-9 | t070-config-allowed-paths.test.ts:57 | ✅ |
| BDD-10 | t070-cli-config-list.test.ts:28 | ✅ |
| BDD-11 | t070-cli-config-list.test.ts:75 | ✅ |
| BDD-12 | t070-cli-config-list.test.ts:119 | ✅ |
| BDD-13 | t070-cli-config-verify.test.ts:31 | ✅ |
| BDD-14 | t070-cli-config-verify.test.ts:83 | ✅ |
| BDD-15 | t070-server-health.test.ts:44 | ✅ |
| BDD-16 | t070-server-health.test.ts:58 | ✅ |
| BDD-17 | t070-server-health.test.ts:71 | ✅ |

BDD-18~24 为文档/描述相关，不在本 review 范围（docs 域评审覆盖）。

## 测试执行

```
Test Files  14 passed (14)
     Tests  220 passed (220)
  Duration  8.12s
```

全量通过，含 T070 新增 5 个测试文件 + 现有测试无回归。

## 结论

**PASS** — 无 CRITICAL，无 BLOCKER。

所有 MCP 接口契约变更向后兼容：
1. publish_files inputSchema 无变更，输出结构不变（仅 CWD guard 错误文本内容变更）
2. /health 只追加字段（cwd/mode/allowed_paths），不修改/删除现有字段
3. config list 追加 runtime 节，现有输出格式不变
4. config verify 追加可读性检查，现有输出格式不变
5. 错误信息格式一致（均以 `ERROR:` 开头）
6. BDD-1~17 全部有对应测试且通过
