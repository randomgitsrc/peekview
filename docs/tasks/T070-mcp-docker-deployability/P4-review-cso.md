---
phase: P4
task_id: T070
type: review
parent: P4-implementation.md
trace_id: T070-P4-review-cso-20260725
status: approved
created: 2026-07-25
agent: cso
---

# P4 安全审查 — CSO

## 审查范围

| 文件 | 关注点 |
|------|--------|
| `packages/mcp-server/src/tools/publishFiles.ts:342-357` | CWD guard 修复逻辑 |
| `packages/mcp-server/src/config/merge.ts:78-87` | allowed_paths 字符串→数组容错 |
| `packages/mcp-server/src/server.ts:231-272` | /health 端点新增字段 |
| `packages/mcp-server/tests/t070-*.test.ts` | BDD 测试覆盖 |

## STRIDE 矩阵

| # | 威胁类型 | 场景 | 严重性 | 分析 |
|---|----------|------|--------|------|
| 1 | Spoofing | — | — | 无新增身份伪造面 |
| 2 | Tampering | CWD guard 逻辑被绕过 | HIGH → LOW | 见审查项 1 |
| 3 | Repudiation | — | — | 无审计日志变更 |
| 4 | Information Disclosure | /health 暴露 cwd/allowed_paths | MEDIUM → LOW | 见审查项 3 |
| 5 | Denial of Service | — | — | 无新增 DoS 面 |
| 6 | Elevation of Privilege | allowed_paths 字符串→数组注入 | LOW | 见审查项 4 |

## 审查项 1：CWD guard 修复后"未配 allowed_paths + cwd=/"仍被拒绝（BDD-2）

**代码位置**：`publishFiles.ts:342-357`

```typescript
const isCwdRoot = path.resolve(cwd) === path.parse(cwd).root;
if (isCwdRoot && !config.trustAllPaths && config.allowedPaths.length === 0) {
  return { content: [{ type: 'text', text: 'ERROR: ...' }] };
}
```

**分析**：

- 三条件 AND 语义正确：`isCwdRoot && !trustAllPaths && allowedPaths.length === 0`
- 修复前：仅检查 `isCwdRoot`，不检查 `trustAllPaths` 和 `allowedPaths`，导致已配 allowed_paths 时仍被拒绝（BDD-1 场景）
- 修复后：只有三个条件同时满足才拒绝，与 P1 安全语义要求一致
- BDD-2 测试（`t070-publishFiles-cwd-guard.test.ts:86-100`）验证：`makeConfig('local', [], false)` + cwd=/ → 拒绝
- BDD-1 测试（`t070-publishFiles-cwd-guard.test.ts:64-84`）验证：`makeConfig('local', [tmpDir])` + cwd=/ → 放行

**结论**：安全语义不变，修复正确。**严重性：LOW**（修复增强了精确性，未削弱保护）。

## 审查项 2：trust_all_paths=true + cwd=/ 时放行是否合理（BDD-5）

**代码位置**：`publishFiles.ts:342-344`

**分析**：

- `trust_all_paths=true` 是用户显式声明"我接受风险，跳过路径白名单"
- 当 `trustAllPaths=true` 时，CWD guard 条件 `!config.trustAllPaths` 为 false，整个 guard 被跳过
- 后续路径检查（`publishFiles.ts:363-365`）进入 trust 模式：`allowedBases = []`，`isWithinAllowed` 总返回 true
- 但 denylist（`SENSITIVE_PATTERNS`，L54-97）仍然生效，包括 `/proc`、`/sys`、`/dev`、`/root`、`/etc`、`/var/log` 等系统目录
- BDD-5 测试（`t070-publishFiles-cwd-guard.test.ts:138-158`）验证：trust + cwd=/ → 放行
- 已有测试（`publishFiles.test.ts:356-364`）验证：trust + .env → 仍被 denylist 拒绝

**结论**：放行合理。`trust_all_paths` 是明确的 opt-in 逃逸阀，denylist 仍提供 best-effort 保护。**严重性：LOW**（设计意图如此，文档已标注风险）。

## 审查项 3：/health 端点新增 cwd/allowed_paths 字段是否构成信息泄露

**代码位置**：`server.ts:231-272`

**分析**：

1. **/health 无认证**：`app.get('/health', ...)` 无 auth 中间件，任何网络可达者可访问
2. **已有字段**：修复前 /health 已暴露 `config.source`、`config.path`（配置文件路径）、`peekview_url`、`public_url`、`api_key_configured`（布尔值）
3. **新增字段**：
   - `cwd`：进程工作目录（如 `/app` 或 `/home/user`）
   - `mode`：`local` 或 `remote`
   - `allowed_paths`：local 模式下的白名单路径数组；remote 模式下为 `[]`

4. **风险评估**：
   - `cwd`：Docker 环境下通常是 `/app` 或 `/`，非敏感信息。攻击者已知容器内路径结构（Dockerfile 公开）
   - `allowed_paths`：白名单路径（如 `/data`、`/tmp`），非敏感数据。攻击者知道白名单路径不等于能绕过白名单——路径仍需在白名单内才能访问
   - `mode`：`local`/`remote`，非敏感
   - 与已有字段对比：`peekview_url` 和 `public_url` 暴露内部服务地址，比 cwd/allowed_paths 更敏感
   - remote 模式下 `allowed_paths` 强制为 `[]`（`server.ts:261`），不泄露 remote 侧配置

5. **缓解因素**：
   - /health 端点设计用于 Docker HEALTHCHECK 和运维监控，需无认证访问
   - MCP Server 通常部署在内网（Docker network / localhost），不直接暴露公网
   - 新增字段是追加式（不修改/删除现有字段），不影响现有消费者

**结论**：信息泄露风险 LOW。新增字段与已有暴露字段敏感度相当，且 remote 模式下 allowed_paths 被遮蔽。**严重性：LOW**。

**建议（非阻塞）**：未来可考虑 /health 拆分为 `/health`（公开，仅 status/version）和 `/health/detail`（需认证，含配置详情）。当前不阻塞。

## 审查项 4：allowed_paths 字符串→数组转换是否可能被利用（路径注入）

**代码位置**：`merge.ts:81-87`

```typescript
const raw = fileConfig.server.allowed_paths;
const paths = typeof raw === 'string'
  ? raw.split(':').filter((p: string) => p.length > 0)
  : Array.isArray(raw) ? raw : [];
allowedPaths = paths.map(expandHome);
```

**分析**：

1. **空字符串过滤**：`.filter((p: string) => p.length > 0)` 防止空字符串进入白名单
2. **路径注入向量**：
   - `allowed_paths: "/data:/tmp:.."` → split 得 `["/data", "/tmp", ".."]` → `expandHome("..")` 返回 `".."` → `path.resolve("..")` 在后续 `publishFiles.ts:367` 被解析为 cwd 的父目录
   - 但 `..` 作为 allowed_path 本身不是漏洞——它只是允许了 cwd 父目录，用户仍需显式传入该目录下的文件路径
   - 更危险的向量：`allowed_paths: "/data/../etc"` → split 得 `["/data/../etc"]` → `expandHome` 不 resolve → 后续 `path.resolve("/data/../etc")` = `/etc` → 但 `/etc` 被 denylist 拒绝
3. **expandHome 不做 resolve**：`expandHome` 只处理 `~` 前缀，不做 `path.resolve`。路径规范化延迟到 `publishFiles.ts:367`（`allowedBases = config.allowedPaths.map(p => path.resolve(p))`）
4. **denylist 兜底**：即使 allowed_paths 包含 `/etc`、`/root` 等敏感路径，denylist 仍会拦截这些路径下的敏感文件

**结论**：路径注入风险 LOW。空字符串过滤 + denylist 兜底 + 后续 path.resolve 规范化构成多层防御。**严重性：LOW**。

**建议（非阻塞）**：mergeConfig 阶段可对每个 allowed_path 做 `path.resolve` + denylist 检查，在配置加载时即警告/拒绝敏感路径。当前不阻塞。

## 审查项 5：空 allowed_paths 数组是否等同于未配置（BDD-9）

**代码位置**：`merge.ts:81-87` + `publishFiles.ts:344`

**分析**：

1. **mergeConfig 行为**：`allowed_paths: []` → `Array.isArray(raw)` 为 true → `paths = []` → `allowedPaths = []`
2. **CWD guard 行为**：`config.allowedPaths.length === 0` 为 true → 与未配置时行为一致
3. **BDD-9 测试**（`t070-config-allowed-paths.test.ts:57-82`）：验证 `allowed_paths: []` → `result.allowedPaths` 为 `[]`
4. **语义一致性**：空数组 = 未配置 = `allowedPaths.length === 0`，CWD guard 正确拒绝

**结论**：语义正确，空数组等同于未配置。**严重性：LOW**（无安全问题）。

## 严重性汇总

| 级别 | 数量 | 说明 |
|------|------|------|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| LOW | 5 | 全部审查项均为 LOW |

## 阻塞判定

**无 BLOCKER，无 CRITICAL，无 HIGH。**

最高严重级别：**LOW**

是否阻塞发布：**否**

## 非阻塞建议

1. /health 可考虑拆分公开/认证两个层级（未来优化）
2. mergeConfig 可在配置加载阶段对 allowed_paths 做 path.resolve + denylist 预检（防御纵深）
3. trust_all_paths 的 warning 日志可追加 cwd 值，帮助运维识别 cwd=/ 场景
