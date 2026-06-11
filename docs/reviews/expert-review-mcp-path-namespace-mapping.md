# Review: MCP Path Namespace 映射方案

> 评审日期：2026-06-11
> 评审人：Claude Code (opencode)
> 目标版本：MCP Server v0.9.0

---

## 评审结论

| 维度 | 评级 | 说明 |
|------|------|------|
| **设计合理性** | ✅ 通过 | 方案设计清晰，决策有据 |
| **技术可行性** | ⚠️ 需验证 | 依赖 agent header 支持，需实测 |
| **安全性** | ✅ 通过 | 安全链未被绕过 |
| **实现复杂度** | 🟡 中等 | 改动面较小，5 个 Step |
| **文档完整性** | ✅ 通过 | 测试、验收标准完备 |

**总体结论**：✅ **可以实施**，但需在实施前验证关键前置依赖。

---

## 一、方案优点

### 1. 设计清晰，决策有据

- 每个关键决策都有明确理由（决策 0-6）
- 翻译流程图直观，便于理解
- 与现有安全模型兼容（翻译后仍走完整安全链）

### 2. 顺带修复现有 bug

决策 0 顺便修复 `allowed_paths` 配 `~/xxx` 静默失效的 bug，一举两得。

### 3. 安全设计谨慎

- 决策 3：unknown namespace 拒绝，不静默 fallback（防止读到不相干文件）
- 决策 6：明确 namespace 不是安全凭证，安全边界由 allowlist 保证
- 错误信息不泄露主机路径（保护容器隔离）

### 4. 向后兼容

决策 2 保证无 namespace header 时走现有逻辑，不影响现有用户。

### 5. 测试覆盖完备

测试用例表（第五节）覆盖了核心路径和边界情况。

---

## 二、潜在问题与风险

### 🔴 高优先级风险

#### 问题 1：Agent header 支持未经实测

**现状**：文档提到 Claude Code issue #14977 曾报告 HTTP header 不传输的 bug。

**风险**：
- Claude Code 可能存在未修复的 bug
- 其他 agent（Codex、Hermes、OpenClaw）未实测

**建议**：
- 实施前用 Claude Code 实际测试 `X-Peekview-Namespace` 能否传到 MCP Server
- 如果 header 不可用，需要明确降级方案（比如回退到"容器内独立 MCP"方案）

#### 问题 2：`~` 展开的边界情况

**现状**：代码示例中 `expandHome` 只处理 `~` 和 `~/`，但没有处理 `~user` 语法。

```typescript
function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}
```

**风险**：
- 用户配置 `~/docker-data1` 会展开
- 但配置 `~root` 或 `~someuser` 不会展开（虽然这种用法罕见）

**建议**：
- 明确文档说明只支持 `~` 和 `~/`，不支持 `~user`
- 或者补全 `~user` 语法支持（用 `os.userInfo().homedir` 但 Node.js 无直接 API，可能需要 `getpwnam`，非跨平台）

---

### 🟡 中等优先级问题

#### 问题 3：配置冗余

**现状**：用户需要同时配置 `allowed_paths` 和 `path_namespaces`：

```yaml
server:
  allowed_paths:
    - ~/docker-data1
    - ~/docker-data2
  path_namespaces:
    docker-a:
      /opt/data: ~/docker-data1
```

**问题**：
- `path_namespaces` 的 host_path 必须也是 `allowed_paths` 的子集
- 两份配置容易不一致，导致用户困惑

**建议**：
- 考虑简化：`path_namespaces` 的 host_path 自动加入 allowlist（不需要用户重复配）
- 或者文档中明确强调："host_path 必须已在 allowed_paths 中"

#### 问题 4：路径末尾斜杠处理

**现状**：代码中使用 `startsWith(containerPath + path.sep)` 判断前缀匹配。

**潜在问题**：
- 如果用户配置 `/opt/data`（无末尾斜杠），传入 `/opt/datafile` 会误匹配
- 代码中用了 `path.sep`（Unix 是 `/`，Windows 是 `\`），逻辑上是对的

**验证**：
- `/opt/data` + `/` + `x.md` = `/opt/data/x.md` ✓
- `/opt/data` 不以 `/opt/data/` 开头，所以 `/opt/datafile` 不会被匹配 ✓

**结论**：代码逻辑正确，但需要测试覆盖。

#### 问题 5：session 超时后 namespace 丢失

**现状**：session 有 30 分钟 idle 超时（`SESSION_IDLE_TIMEOUT`）。

**风险**：
- session 超时后重新 initialize，是否需要重新传 namespace header？
- 如果 MCP SDK 会复用 session（stateful），可能不需要

**建议**：
- 明确测试：session 超时后重建，namespace 是否正确
- 或文档说明：namespace 在 session 存活期间有效，超时后需重新配置

---

### 🟢 低优先级问题

#### 问题 6：多 namespace 映射到同一 host_path

**现状**：配置允许两个 namespace 映射到同一个主机目录：

```yaml
path_namespaces:
  docker-a:
    /opt/data: ~/shared-dir
  docker-b:
    /opt/cache: ~/shared-dir
```

**问题**：目前没有禁止，但这可能是合理用法（比如多个容器共享一个数据卷）。

**建议**：文档中明确说明这种用法是允许的，但用户需自行确保权限隔离。

#### 问题 7：CORS 配置

**现状**：`server.ts` 中 CORS 配置没有透传 `X-Peekview-Namespace`：

```typescript
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'mcp-session-id'],
  exposedHeaders: ['mcp-session-id'],
}));
```

**风险**：`X-Peekview-Namespace` 可能被 CORS 拦截（如果浏览器端发请求）。

**评估**：MCP 通常是服务端到服务端通信，不走浏览器 CORS。但如果是浏览器内的 MCP 客户端，需要注意。

**建议**：将 `X-Peekview-Namespace` 加入 `allowedHeaders`。

---

## 三、实施建议

### 1. 实施前必须验证

| 验证项 | 方法 |
|--------|------|
| Claude Code header 传输 | 实际配置一个 MCP 连接，打印 req.headers 验证 |
| 其他目标 agent | 按需验证 |

### 2. 改动顺序建议

建议按文档 Step 1-5 顺序实施，但可以把 **Step 0（expandHome）提前**，因为它是 Step 4 的依赖。

### 3. 补充测试用例

除文档第五节外，建议补充：

| 额外用例 | 理由 |
|----------|------|
| `~` 展开的各种写法 | `~`, `~/`, `~/foo`, `~otheruser` |
| 路径末尾斜杠 | `/opt/data/` vs `/opt/data` |
| session 超时重建 | 验证 namespace 持久性 |
| CORS header 透传 | 验证 X-Peekview-Namespace 不被拦截 |

### 4. 文档补充

建议在 README 中增加：
- Docker 场景配置示例（完整 yaml + agent 配置）
- 故障排查：常见错误信息及解决
- 与"容器内独立 MCP"方案的选型指南

---

## 四、总结

该方案**设计良好，可以实施**，但需注意：

1. **前置依赖是关键的 key**：agent header 支持必须实测，不能只依赖文档
2. **配置复杂度**需要文档充分说明，避免用户配置错误
3. **安全设计谨慎**，但错误信息不泄露主机路径这一点值得再确认

**推荐动作**：
1. ✅ 用 Claude Code 实际测试 header 传输
2. ✅ 将 `X-Peekview-Namespace` 加入 CORS allowedHeaders
3. ✅ 明确文档：`~` 只支持 `~` 和 `~/` 两种形式
4. ✅ 考虑简化配置（path_namespaces 的 host_path 自动加入 allowlist）

---

*评审完成，等待方案作者回应后决定是否进入实施阶段。*