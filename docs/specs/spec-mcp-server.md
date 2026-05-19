# MCP Server Specification

> **Scope:** Model Context Protocol (MCP) Server for PeekView  
> **Version:** Phase 2 (SSE Transport)  
> **Date:** 2026-05-19

---

## 1. Overview

### 1.1 Purpose

Enable AI Agents (Claude Code, Cursor, etc.) to directly create and manage PeekView entries via the Model Context Protocol, eliminating the need for manual CLI operations or API integration.

### 1.2 Target Users

- AI Agent developers integrating with PeekView
- End users configuring AI assistants to use PeekView
- DevOps teams deploying self-hosted PeekView with MCP support

### 1.3 Key Value Proposition

**Before MCP:**
```
User: "Analyze this code and save to PeekView"
Agent: [generates content]
User: [manually runs peekview create]
```

**After MCP:**
```
User: "Analyze this code and save to PeekView"
Agent: [calls create_entry tool] → Returns URL instantly
```

---

## 2. Architecture

### 2.1 Deployment Model

**Phase 2: Remote MCP Server (SSE Transport)**

```
┌─────────────────────────────────────────────────────────────┐
│                      User Environment                        │
│  ┌──────────────┐                                          │
│  │  Claude Code │──SSE (HTTP)──► Remote MCP Server         │
│  │  / Cursor    │              (Node.js, Port 3000)        │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP (localhost or internal)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server Environment                        │
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │  PeekView Backend   │◄───│  MCP Server              │   │
│  │  (Python/FastAPI)   │    │  - SSE endpoint          │   │
│  │  Port: 8080         │    │  - Tool handlers         │   │
│  └─────────────────────┘    │  - HTTP Client           │   │
│                             └──────────────────────────┘   │
│  Can be:                                                    │
│  - Same machine (recommended for single-server deploy)      │
│  - Different machines (for scaling)                         │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Transport Layer

| Transport | Phase | Use Case | Status |
|-----------|-------|----------|--------|
| stdio | 1 | Local development, single user | ❌ Not implemented |
| **SSE** | **2** | **Remote deployment, multi-user** | **✅ Required** |

**Rationale for SSE:**
- Supports remote deployment without local installation
- Multiple AI clients can share one MCP Server
- Standard HTTP infrastructure (load balancers, TLS termination)

### 2.3 Communication Flow

```
1. AI Client (Claude Code) connects to MCP Server SSE endpoint
   GET /sse

2. MCP Server exposes available Tools via MCP protocol
   
3. AI Client calls Tool (e.g., create_entry)
   POST /messages (MCP protocol)

4. MCP Server validates request, calls PeekView API
   POST http://peekview:8080/api/v1/entries

5. MCP Server returns formatted result to AI Client
   (via SSE stream)
```

---

## 3. Tools Specification

### 3.1 Tool: create_entry

Create a new PeekView entry with files.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "summary": {
      "type": "string",
      "description": "Entry summary/description"
    },
    "files": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "filename": { "type": "string" },
          "content": { "type": "string" },
          "path": { "type": "string", "description": "Optional path for hierarchical structure" }
        },
        "required": ["filename", "content"]
      },
      "description": "Files to include in the entry"
    },
    "slug": {
      "type": "string",
      "description": "Custom URL slug (auto-generated if not provided)"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Tags for categorization"
    },
    "visibility": {
      "type": "string",
      "enum": ["public", "private"],
      "default": "public"
    },
    "expires_in": {
      "type": "string",
      "description": "Expiration duration (e.g., '7d', '1h', '30m')"
    }
  },
  "required": ["summary", "files"]
}
```

**Output:**
```json
{
  "content": [{
    "type": "text",
    "text": "✓ Entry created successfully\n\nTitle: {summary}\nURL: {base_url}/{slug}\nSlug: {slug}\nFiles: {count}\nVisibility: {visibility}"
  }]
}
```

**Error Output:**
```json
{
  "content": [{ "type": "text", "text": "✗ Failed to create entry: {error}" }],
  "isError": true
}
```

### 3.2 Tool: get_entry

Get entry details by slug.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "slug": { "type": "string", "description": "Entry slug from URL" }
  },
  "required": ["slug"]
}
```

**Output:** Entry details including file list, tags, visibility.

### 3.3 Tool: list_entries

List entries with optional search and filter.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string", "description": "Full-text search query" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "page": { "type": "number", "default": 1 },
    "per_page": { "type": "number", "default": 20 }
  }
}
```

**Output:** Paginated list of entries.

### 3.4 Tool: delete_entry

Delete an entry by slug.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "slug": { "type": "string", "description": "Entry slug to delete" }
  },
  "required": ["slug"]
}
```

**Output:** Success or error message.

---

## 4. Configuration

### 4.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PEEKVIEW_URL` | Yes | - | PeekView API base URL |
| `PEEKVIEW_API_KEY` | Yes | - | API Key for authentication |
| `MCP_PORT` | No | 3000 | MCP Server listening port |
| `MCP_HOST` | No | 0.0.0.0 | MCP Server bind address |
| `LOG_LEVEL` | No | info | Logging level (debug, info, warn, error) |

### 4.2 Claude Code Configuration

```json
{
  "mcpServers": {
    "peekview": {
      "url": "http://localhost:3000/sse",
      "env": {
        "PEEKVIEW_API_KEY": "pv_your_api_key"
      }
    }
  }
}
```

---

## 5. Security Considerations

### 5.1 Authentication

- API Key passed via environment variable (not in code)
- MCP Server validates key on startup
- No key = Server refuses to start with clear error message

### 5.2 Transport Security

**Production:**
- MCP Server behind reverse proxy (nginx/traefik)
- TLS termination at proxy
- Internal communication to PeekView can be HTTP (localhost)

**Development:**
- HTTP acceptable for localhost
- Warning logged if no TLS detected

### 5.3 Error Handling

- Never expose API Key in error messages
- Never expose internal paths or stack traces to AI Client
- Log detailed errors server-side for debugging

---

## 6. Deployment Options

### 6.1 Single Server (Recommended)

MCP Server and PeekView on same machine:

```yaml
# docker-compose.yml
version: '3.8'
services:
  peekview:
    image: peekview:latest
    ports:
      - "8080:8080"
    volumes:
      - peekview-data:/data

  mcp:
    image: peekview/mcp-server:latest
    ports:
      - "3000:3000"
    environment:
      - PEEKVIEW_URL=http://peekview:8080
      - PEEKVIEW_API_KEY=${PEEKVIEW_API_KEY}
```

### 6.2 Separate Servers

MCP Server and PeekView on different machines:

```
Machine A (PeekView):  peekview serve --host 0.0.0.0
Machine B (MCP):       peekview-mcp serve
                       PEEKVIEW_URL=https://peek.example.com
```

---

## 7. Acceptance Criteria

### 7.1 Functional

- [ ] MCP Server starts with `peekview-mcp serve` command
- [ ] SSE endpoint `/sse` accepts connections
- [ ] All 4 tools (create_entry, get_entry, list_entries, delete_entry) work
- [ ] Tool results formatted for human readability
- [ ] Errors return `isError: true` with clear messages

### 7.2 Integration

- [ ] Claude Code can discover and call tools
- [ ] Cursor can discover and call tools
- [ ] Works with remote PeekView instance
- [ ] Works with local PeekView instance

### 7.3 Deployment

- [ ] Docker image builds successfully
- [ ] npm package installs globally
- [ ] docker-compose up starts both services
- [ ] Configuration via environment variables only

---

## 8. Out of Scope

The following are intentionally excluded from Phase 2:

- **Resources:** Exposing entry content as MCP Resources (future)
- **Prompts:** Pre-defined prompt templates (future)
- **Multi-user authentication:** Per-user API keys (use PeekView's user system)
- **WebSocket transport:** Only SSE for now
- **stdio transport:** Phase 1 skipped, going directly to Phase 2

---

## 9. References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [PeekView API Documentation](../backend/README.md)

---

*Spec created: 2026-05-19*  
*Status: Ready for implementation*