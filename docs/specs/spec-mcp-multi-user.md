# MCP Server 多用户认证设计

## 背景

当前 MCP Server 使用单一 `MCP_TOKEN` 认证，所有客户端共享同一个身份（通过 `PEEKVIEW_API_KEY` 绑定）。无法区分不同用户，创建的条目都属于同一个人。

## 设计目标

- 不同 Claude Code 客户端以各自用户身份连接 MCP Server
- 条目归属创建者，私有条目只有创建者可见
- MCP Server 不做认证判断，PeekView 是唯一认证中心
- 配置简单，长期有效

## 认证架构

```
用户甲 (Claude Code)              用户乙 (Claude Code)
    │                                 │
    │ Bearer: pv_甲的apikey           │ Bearer: pv_乙的apikey
    ▼                                 ▼
┌──────────────────────────────────────────┐
│          MCP Server (远程)               │
│                                          │
│  1. 从 Authorization header 提取 token   │
│  2. 原样透传给 PeekView API             │
│  3. 不做认证、不做用户判断               │
│                                          │
│  连接级验证：token 非空即可建立 SSE      │
│  业务级验证：交给 PeekView               │
└──────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│          PeekView (认证中心)              │
│                                          │
│  pv_xxx → HMAC-SHA256 验证 → 用户甲     │
│  无效    → 401 拒绝                      │
│  过期    → 401 拒绝                      │
│  用户禁用 → 401 拒绝                     │
└──────────────────────────────────────────┘
```

## 变更内容

### 移除的配置

| 变量 | 原用途 | 移除原因 |
|------|--------|---------|
| `MCP_TOKEN` | 连接级共享密码 | 不再需要，用户自带 API Key |
| `PEEKVIEW_API_KEY` | 服务级 API Key | 不再需要，每个用户自带 Key |

### 新增的配置

无新增。配置更简化：

```bash
PEEKVIEW_URL=http://peekview:8080          # PeekView 内部地址
PEEKVIEW_PUBLIC_URL=https://peek.example.com # 用户可见地址
MCP_PORT=33333
MCP_HOST=0.0.0.0
```

### 认证流程变更

**SSE 连接（GET /sse）：**
1. 客户端发送 `Authorization: Bearer pv_xxx`
2. MCP Server 提取 token，存入 session
3. 允许连接（token 非空即可，具体验证由 PeekView 在业务调用时完成）

**业务调用（POST /messages → tool handler）：**
1. 从 session 中取出 token
2. 调用 PeekView API 时带上 `Authorization: Bearer pv_xxx`
3. PeekView 验证 token，返回用户身份和权限
4. 如果 token 无效，返回错误信息给客户端

**Health check（GET /health）：**
- 不带用户 token，使用 PeekView 的 `/api/v1/health` 或简单的 HTTP 连通性检查

### Session 存储

```typescript
// session 存储结构变更
interface SessionInfo {
  transport: SSEServerTransport;
  userToken: string;  // 客户端传来的 pv_ API Key
}

const sessions = new Map<string, SessionInfo>();
```

### PeekView Client 变更

```typescript
// 调用 PeekView API 时使用用户的 token
class PeekViewClient {
  async request(path: string, options: RequestInit, userToken?: string) {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${userToken}`,
    };
    return fetch(`${this.peekviewUrl}${path}`, { ...options, headers });
  }
}
```

### 工具行为

| 工具 | 行为 | 说明 |
|------|------|------|
| create_entry | 条目归属 token 对应用户 | owner_id 由 PeekView 从 API Key 推断 |
| get_entry | 公开条目 + 自己的私有条目 | PeekView 已有 visibility 过滤 |
| list_entries | 同 get_entry | 同上 |
| delete_entry | 只能删自己的条目 | PeekView 已有 owner 权限检查 |

### 错误处理

| 场景 | PeekView 返回 | MCP Server 返回给客户端 |
|------|---------------|------------------------|
| API Key 无效 | 401 | tool result isError: true, "认证失败：API Key 无效" |
| API Key 过期 | 401 | tool result isError: true, "认证失败：API Key 已过期" |
| 用户被禁用 | 401 | tool result isError: true, "认证失败：用户已被禁用" |
| 权限不足 | 403 | tool result isError: true, "权限不足" |

## 用户使用流程

### 1. 在 PeekView 创建 API Key

```bash
# 在服务器上
peekview apikey create "Claude Code - 甲"
# → pv_abc123...

peekview apikey create "Claude Code - 乙"
# → pv_def456...
```

### 2. 配置 Claude Code

```bash
# 用户甲
claude mcp add peekview --transport sse https://peek.example.com/mcp \
  --header "Authorization: Bearer pv_abc123..."

# 用户乙（另一台机器）
claude mcp add peekview --transport sse https://peek.example.com/mcp \
  --header "Authorization: Bearer pv_def456..."
```

### 3. 使用

```
用户甲通过 Claude Code 创建条目 → 条目 owner = 甲
用户乙通过 Claude Code 创建条目 → 条目 owner = 乙
用户甲 list_entries → 看到公开 + 甲的私有条目
用户乙 list_entries → 看到公开 + 乙的私有条目
```

## 不支持的场景

- JWT token（`eyJ` 前缀）：不支持，7 天过期不适合 MCP 配置
- 无 token 连接：SSE 建立阶段拒绝，返回 401
- 服务级全局 API Key（`PEEKVIEW_SERVER__API_KEY`）：不通过 MCP 使用

## 兼容性说明

现有 `MCP_TOKEN` + `PEEKVIEW_API_KEY` 配置方式将移除。升级后：
- 删除 `MCP_TOKEN` 和 `PEEKVIEW_API_KEY` 环境变量
- 每个用户用各自的 `pv_` API Key 配置 Claude Code
- Docker Compose `.env` 文件需要更新

## Docker Compose 变更

```yaml
mcp-server:
  environment:
    - PEEKVIEW_URL=http://peekview:8080
    - PEEKVIEW_PUBLIC_URL=${PEEKVIEW_PUBLIC_URL}
    # 移除: PEEKVIEW_API_KEY
    # 移除: MCP_TOKEN
    - MCP_PORT=33333
    - MCP_HOST=0.0.0.0
```

用户各自在 Claude Code 配置自己的 API Key。