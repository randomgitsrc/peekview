# MCP Server Implementation Plan (Phase 2 SSE)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Model Context Protocol (MCP) Server with SSE transport, exposing 4 tools for AI Agents to manage PeekView entries remotely.

**Architecture:** Node.js TypeScript server using `@modelcontextprotocol/sdk` with SSE transport, HTTP client calling PeekView REST API, deployed as npm package and Docker image.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, Express (for SSE endpoint), Zod (validation), Vitest + MSW (testing)

---

## File Structure

```
packages/mcp-server/
├── package.json              # Package config, bin entry
├── tsconfig.json             # TypeScript strict mode
├── Dockerfile                # Container image
├── src/
│   ├── index.ts              # Server entry, SSE transport setup
│   ├── server.ts             # MCP Server initialization
│   ├── client.ts             # PeekView API HTTP client
│   ├── config.ts             # Environment config validation
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── createEntry.ts    # create_entry implementation
│   │   ├── getEntry.ts       # get_entry implementation
│   │   ├── listEntries.ts    # list_entries implementation
│   │   └── deleteEntry.ts    # delete_entry implementation
│   └── types.ts              # TypeScript interfaces
├── tests/
│   ├── client.test.ts        # HTTP client tests
│   ├── tools.test.ts         # Tool integration tests
│   └── server.test.ts        # SSE server tests
└── README.md                 # Usage documentation
```

---

## Task 1: Project Initialization

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/.gitignore`

### Step 1: Create package.json

```json
{
  "name": "@peekview/mcp-server",
  "version": "0.1.0",
  "description": "MCP Server for PeekView - AI Agent integration (SSE transport)",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "peekview-mcp": "./dist/index.js"
  },
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "serve": "node dist/index.js serve",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/**/*.ts",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "peekview",
    "ai",
    "agent",
    "claude",
    "sse"
  ],
  "author": "PeekView Team",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "cors": "^2.8.5",
    "express": "^4.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.0",
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "msw": "^2.0.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^2.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Step 2: Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 3: Create .gitignore

```gitignore
node_modules/
dist/
*.log
.env
.env.local
.DS_Store
coverage/
.vscode/
*.tsbuildinfo
```

### Step 4: Commit

```bash
cd packages/mcp-server
git add .
git commit -m "chore(mcp): initialize project structure for SSE transport"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `packages/mcp-server/src/types.ts`

### Step 1: Define Core Types

```typescript
/**
 * PeekView MCP Server Type Definitions
 */

// File object for entry creation
export interface EntryFile {
  filename: string;
  content: string;
  path?: string;
}

// Entry creation request
export interface CreateEntryRequest {
  slug?: string;
  summary: string;
  files: EntryFile[];
  tags?: string[];
  expires_in?: string;
  visibility?: 'public' | 'private';
}

// Entry file in response
export interface EntryFileResponse {
  id: number;
  filename: string;
  path: string | null;
  language: string;
  size: number;
}

// Entry response from API
export interface EntryResponse {
  id: number;
  slug: string;
  summary: string;
  tags: string[];
  files: EntryFileResponse[];
  created_at: string;
  expires_at: string | null;
  is_public: boolean;
}

// List entries response
export interface ListEntriesResponse {
  items: EntryResponse[];
  total: number;
  page: number;
  per_page: number;
}

// Server configuration
export interface ServerConfig {
  peekviewUrl: string;
  apiKey: string;
  mcpToken: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
}

// Tool handler type
export type ToolHandler = (args: unknown) => Promise<ToolResult>;

// Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: ToolHandler;
}

// Tool result
export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    mimeType?: string;
    data?: string;
  }>;
  isError?: boolean;
}
```

### Step 2: Commit

```bash
git add src/types.ts
git commit -m "feat(mcp): add core type definitions"
```

---

## Task 3: Configuration Module

**Files:**
- Create: `packages/mcp-server/src/config.ts`
- Create: `packages/mcp-server/tests/config.test.ts`

### Step 1: Implement Config Validation

```typescript
/**
 * Configuration module with validation
 */
import { z } from 'zod';
import type { ServerConfig } from './types.js';

const configSchema = z.object({
  PEEKVIEW_URL: z.string().url().min(1),
  PEEKVIEW_API_KEY: z.string().min(1),
  MCP_TOKEN: z.string().min(1),
  MCP_PORT: z.string().regex(/^\d+$/).default('3000'),
  MCP_HOST: z.string().default('0.0.0.0'),
  MCP_CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export function loadConfig(): ServerConfig {
  const result = configSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path}: ${e.message}`).join('\n');
    throw new Error(`Configuration error:\n${errors}\n\nRequired environment variables:\n- PEEKVIEW_URL: PeekView API base URL\n- PEEKVIEW_API_KEY: PeekView API key (server-side only)\n- MCP_TOKEN: Client connection token`);
  }

  const env = result.data;
  
  return {
    peekviewUrl: env.PEEKVIEW_URL.replace(/\/$/, ''),
    apiKey: env.PEEKVIEW_API_KEY,
    mcpToken: env.MCP_TOKEN,
    port: parseInt(env.MCP_PORT, 10),
    host: env.MCP_HOST,
    corsOrigins: env.MCP_CORS_ORIGINS.split(','),
    logLevel: env.LOG_LEVEL,
  };
}

export function validateConfig(): void {
  loadConfig(); // Throws if invalid
}
```

### Step 2: Write Config Tests

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should load valid config', () => {
    process.env.PEEKVIEW_URL = 'http://localhost:8080';
    process.env.PEEKVIEW_API_KEY = 'pv_test_key';
    
    const config = loadConfig();
    
    expect(config.peekviewUrl).toBe('http://localhost:8080');
    expect(config.apiKey).toBe('pv_test_key');
    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
  });

  it('should remove trailing slash from URL', () => {
    process.env.PEEKVIEW_URL = 'http://localhost:8080/';
    process.env.PEEKVIEW_API_KEY = 'pv_test_key';
    
    const config = loadConfig();
    expect(config.peekviewUrl).toBe('http://localhost:8080');
  });

  it('should throw on missing PEEKVIEW_URL', () => {
    delete process.env.PEEKVIEW_URL;
    process.env.PEEKVIEW_API_KEY = 'pv_test_key';
    
    expect(() => loadConfig()).toThrow('PEEKVIEW_URL');
  });

  it('should throw on missing PEEKVIEW_API_KEY', () => {
    process.env.PEEKVIEW_URL = 'http://localhost:8080';
    delete process.env.PEEKVIEW_API_KEY;
    
    expect(() => loadConfig()).toThrow('PEEKVIEW_API_KEY');
  });

  it('should use custom port', () => {
    process.env.PEEKVIEW_URL = 'http://localhost:8080';
    process.env.PEEKVIEW_API_KEY = 'pv_test_key';
    process.env.MCP_PORT = '4000';
    
    const config = loadConfig();
    expect(config.port).toBe(4000);
  });
});
```

### Step 3: Run Tests

```bash
npm install
npm run test
# Expected: 5 tests pass
```

### Step 4: Commit

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat(mcp): add configuration module with validation"
```

---

## Task 4: HTTP Client

**Files:**
- Create: `packages/mcp-server/src/client.ts`
- Create: `packages/mcp-server/tests/client.test.ts`

### Step 1: Implement PeekViewClient

```typescript
/**
 * PeekView API HTTP Client
 */
import type {
  CreateEntryRequest,
  EntryResponse,
  ListEntriesResponse,
  ServerConfig,
} from './types.js';

export class PeekViewClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Pick<ServerConfig, 'peekviewUrl' | 'apiKey'>) {
    this.baseUrl = config.peekviewUrl;
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `PeekView API error ${response.status}: ${errorText || response.statusText}`
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async createEntry(request: CreateEntryRequest): Promise<EntryResponse> {
    return this.request<EntryResponse>('/api/v1/entries', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getEntry(slug: string): Promise<EntryResponse> {
    return this.request<EntryResponse>(`/api/v1/entries/${slug}`);
  }

  async listEntries(
    page = 1,
    perPage = 20,
    query?: string,
    tags?: string[]
  ): Promise<ListEntriesResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('per_page', perPage.toString());
    if (query) params.append('q', query);
    if (tags?.length) {
      tags.forEach((tag) => params.append('tag', tag));
    }
    return this.request<ListEntriesResponse>(`/api/v1/entries?${params}`);
  }

  async deleteEntry(slug: string): Promise<void> {
    await this.request<void>(`/api/v1/entries/${slug}`, {
      method: 'DELETE',
    });
  }
}
```

### Step 2: Write Client Tests

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PeekViewClient } from '../src/client.js';

const mockServer = setupServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

const client = new PeekViewClient({
  peekviewUrl: 'http://localhost:8080',
  apiKey: 'pv_test_key',
});

describe('PeekViewClient', () => {
  it('should create entry', async () => {
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', async () => {
        return HttpResponse.json({
          id: 1,
          slug: 'test-entry',
          summary: 'Test',
          tags: [],
          files: [],
          created_at: new Date().toISOString(),
          expires_at: null,
          is_public: true,
        });
      })
    );

    const result = await client.createEntry({
      summary: 'Test',
      files: [{ filename: 'test.txt', content: 'Hello' }],
    });

    expect(result.slug).toBe('test-entry');
  });

  it('should get entry', async () => {
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries/test', () => {
        return HttpResponse.json({
          id: 1,
          slug: 'test',
          summary: 'Test Entry',
          tags: ['tag1'],
          files: [{ id: 1, filename: 'file.txt', path: null, language: 'text', size: 100 }],
          created_at: new Date().toISOString(),
          expires_at: null,
          is_public: true,
        });
      })
    );

    const result = await client.getEntry('test');
    expect(result.summary).toBe('Test Entry');
    expect(result.files).toHaveLength(1);
  });

  it('should list entries', async () => {
    mockServer.use(
      http.get('http://localhost:8080/api/v1/entries', () => {
        return HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          per_page: 20,
        });
      })
    );

    const result = await client.listEntries();
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should delete entry', async () => {
    mockServer.use(
      http.delete('http://localhost:8080/api/v1/entries/test', () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(client.deleteEntry('test')).resolves.toBeUndefined();
  });

  it('should throw on API error', async () => {
    mockServer.use(
      http.post('http://localhost:8080/api/v1/entries', () => {
        return new HttpResponse('Invalid request', { status: 400 });
      })
    );

    await expect(
      client.createEntry({ summary: 'Test', files: [] })
    ).rejects.toThrow('PeekView API error 400');
  });
});
```

### Step 3: Run Tests

```bash
npm run test
# Expected: 10 tests pass
```

### Step 4: Commit

```bash
git add src/client.ts tests/client.test.ts
git commit -m "feat(mcp): implement HTTP client with tests"
```

---

## Task 5: Tool Implementations

**Files:**
- Create: `packages/mcp-server/src/tools/createEntry.ts`
- Create: `packages/mcp-server/src/tools/getEntry.ts`
- Create: `packages/mcp-server/src/tools/listEntries.ts`
- Create: `packages/mcp-server/src/tools/deleteEntry.ts`
- Create: `packages/mcp-server/src/tools/index.ts`

### Step 1: Create createEntry Tool

```typescript
import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { ToolDefinition, ToolResult } from '../types.js';

const schema = z.object({
  summary: z.string().min(1),
  files: z.array(z.object({
    filename: z.string().min(1),
    content: z.string(),
    path: z.string().optional(),
  })).min(1),
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  expires_in: z.string().optional(),
});

export const createEntryTool = (client: PeekViewClient): ToolDefinition => ({
  name: 'create_entry',
  description: `Create a new PeekView entry with files. Returns the entry URL.

Examples:
- Create a code snippet: {"summary": "Fix for bug #123", "files": [{"filename": "fix.py", "content": "..."}]}
- Create private entry: {"summary": "Internal notes", "files": [...], "visibility": "private"}
- With expiration: {"summary": "Temp report", "files": [...], "expires_in": "7d"}`,
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Entry summary/description' },
      files: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            content: { type: 'string' },
            path: { type: 'string', description: 'Optional path for hierarchical structure' },
          },
          required: ['filename', 'content'],
        },
      },
      slug: { type: 'string', description: 'Custom URL slug (auto-generated if not provided)' },
      tags: { type: 'array', items: { type: 'string' } },
      visibility: { type: 'string', enum: ['public', 'private'] },
      expires_in: { type: 'string', description: 'Expiration duration (e.g., "7d", "1h")' },
    },
    required: ['summary', 'files'],
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const params = schema.parse(args);
      const entry = await client.createEntry({
        summary: params.summary,
        files: params.files,
        slug: params.slug,
        tags: params.tags,
        visibility: params.visibility,
        expires_in: params.expires_in,
      });

      const baseUrl = process.env.PEEKVIEW_URL?.replace(/\/$/, '') || 'http://localhost:8080';
      
      return {
        content: [{
          type: 'text',
          text: `✓ Entry created successfully

Title: ${entry.summary}
URL: ${baseUrl}/${entry.slug}
Slug: ${entry.slug}
Files: ${entry.files.length}
Visibility: ${entry.is_public ? 'public' : 'private'}
Created: ${entry.created_at}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `✗ Failed to create entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  },
});
```

### Step 2: Create getEntry Tool

```typescript
import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { ToolDefinition, ToolResult } from '../types.js';

const schema = z.object({
  slug: z.string().min(1),
});

export const getEntryTool = (client: PeekViewClient): ToolDefinition => ({
  name: 'get_entry',
  description: 'Get details of a PeekView entry by slug.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Entry slug from URL' },
    },
    required: ['slug'],
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const { slug } = schema.parse(args);
      const entry = await client.getEntry(slug);

      const fileList = entry.files
        .map(f => `  - ${f.path ? f.path + '/' : ''}${f.filename} (${f.language}, ${f.size} bytes)`)
        .join('\n');

      return {
        content: [{
          type: 'text',
          text: `Entry: ${entry.summary}

Slug: ${entry.slug}
Visibility: ${entry.is_public ? 'public' : 'private'}
Tags: ${entry.tags.join(', ') || 'none'}
Created: ${entry.created_at}
Expires: ${entry.expires_at || 'never'}

Files (${entry.files.length}):
${fileList || '  (no files)'}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `✗ Failed to get entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  },
});
```

### Step 3: Create listEntries Tool

```typescript
import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { ToolDefinition, ToolResult } from '../types.js';

const schema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).optional(),
});

export const listEntriesTool = (client: PeekViewClient): ToolDefinition => ({
  name: 'list_entries',
  description: 'List PeekView entries with optional search and filter.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (full-text search)' },
      tags: { type: 'array', items: { type: 'string' } },
      page: { type: 'number', default: 1 },
      per_page: { type: 'number', default: 20 },
    },
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const params = schema.parse(args);
      const result = await client.listEntries(
        params.page,
        params.per_page,
        params.query,
        params.tags
      );

      if (result.items.length === 0) {
        return {
          content: [{ type: 'text', text: 'No entries found.' }],
        };
      }

      const entries = result.items
        .map((e, i) => `${i + 1}. ${e.summary} (${e.slug})\n   Files: ${e.files.length} | Tags: ${e.tags.join(', ') || 'none'} | ${e.is_public ? 'public' : 'private'}`)
        .join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${result.total} entries (page ${result.page}/${Math.ceil(result.total / result.per_page)}):

${entries}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `✗ Failed to list entries: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  },
});
```

### Step 4: Create deleteEntry Tool

```typescript
import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { ToolDefinition, ToolResult } from '../types.js';

const schema = z.object({
  slug: z.string().min(1),
});

export const deleteEntryTool = (client: PeekViewClient): ToolDefinition => ({
  name: 'delete_entry',
  description: 'Delete a PeekView entry by slug. This action cannot be undone.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Entry slug to delete' },
    },
    required: ['slug'],
  },
  handler: async (args: unknown): Promise<ToolResult> => {
    try {
      const { slug } = schema.parse(args);
      await client.deleteEntry(slug);
      return {
        content: [{
          type: 'text',
          text: `✓ Entry "${slug}" deleted successfully.`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `✗ Failed to delete entry: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  },
});
```

### Step 5: Create Tool Registry

```typescript
import type { PeekViewClient } from '../client.js';
import type { ToolDefinition } from '../types.js';
import { createEntryTool } from './createEntry.js';
import { getEntryTool } from './getEntry.js';
import { listEntriesTool } from './listEntries.js';
import { deleteEntryTool } from './deleteEntry.js';

export function createTools(client: PeekViewClient): ToolDefinition[] {
  return [
    createEntryTool(client),
    getEntryTool(client),
    listEntriesTool(client),
    deleteEntryTool(client),
  ];
}

export { createEntryTool, getEntryTool, listEntriesTool, deleteEntryTool };
```

### Step 6: Commit

```bash
git add src/tools/
git commit -m "feat(mcp): implement all four MCP tools"
```

---

## Task 6: SSE Server Implementation

**Files:**
- Create: `packages/mcp-server/src/server.ts`
- Create: `packages/mcp-server/src/index.ts`
- Modify: `packages/mcp-server/package.json` (add bin shebang)

### Step 1: Implement MCP Server with SSE and Authentication

```typescript
/**
 * MCP Server with SSE transport and connection authentication
 */
import cors from 'cors';
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { PeekViewClient } from './client.js';
import type { ServerConfig, ToolDefinition } from './types.js';

export function createMCPServer(tools: ToolDefinition[]): Server {
  const server = new Server(
    {
      name: 'peekview-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    try {
      return await tool.handler(request.params.arguments);
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      };
    }
  });

  return server;
}

// Session store for SSE connections
const sessions = new Map<string, SSEServerTransport>();

export function createExpressApp(
  server: Server,
  config: ServerConfig
): express.Application {
  const app = express();

  // CORS — allow AI client origins
  const corsOrigins = process.env.MCP_CORS_ORIGINS?.split(',') || ['*'];
  app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'] }));

  app.use(express.json());

  // SSE connection authentication middleware
  function authenticateSSE(req: express.Request, res: express.Response, next: express.NextFunction) {
    // Token from Authorization header or query parameter
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;

    if (!token || token !== config.mcpToken) {
      res.status(401).json({ error: 'Invalid or missing MCP_TOKEN' });
      return;
    }

    next();
  }

  // Health check (no auth required)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // SSE endpoint — authenticated
  app.get('/sse', authenticateSSE, async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;

    sessions.set(sessionId, transport);

    // Cleanup on close
    res.on('close', () => {
      sessions.delete(sessionId);
    });

    await server.connect(transport);
  });

  // Message endpoint — routes to correct session
  app.post('/messages', authenticateSSE, async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = sessions.get(sessionId);

    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  return app;
}
```

### Step 2: Create Entry Point

```typescript
#!/usr/bin/env node
/**
 * PeekView MCP Server - Entry Point
 */
import { createMCPServer, createExpressApp } from './server.js';
import { PeekViewClient } from './client.js';
import { loadConfig } from './config.js';
import { createTools } from './tools/index.js';

async function main() {
  // Load and validate configuration
  const config = loadConfig();
  
  console.log(`Starting PeekView MCP Server...`);
  console.log(`PeekView URL: ${config.peekviewUrl}`);
  console.log(`Listening on: ${config.host}:${config.port}`);
  
  // Initialize client and tools
  const client = new PeekViewClient(config);
  const tools = createTools(client);
  
  // Create and start server
  const mcpServer = createMCPServer(tools);
  const app = createExpressApp(mcpServer);
  
  app.listen(config.port, config.host, () => {
    console.log(`✓ MCP Server ready at http://${config.host}:${config.port}`);
    console.log(`  SSE endpoint: http://${config.host}:${config.port}/sse`);
    console.log(`  Health check: http://${config.host}:${config.port}/health`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
```

### Step 3: Update package.json bin

Add shebang handling:

```json
{
  "bin": {
    "peekview-mcp": "./dist/index.js"
  }
}
```

The `#!/usr/bin/env node` in index.ts will be preserved after build.

### Step 4: Commit

```bash
git add src/server.ts src/index.ts
git commit -m "feat(mcp): implement SSE server with express"
```

---

## Task 7: Dockerfile and Deployment

**Files:**
- Create: `packages/mcp-server/Dockerfile`
- Create: `packages/mcp-server/docker-compose.yml`

### Step 1: Create Dockerfile

```dockerfile
# Multi-stage build: build in stage 1, run in stage 2
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist/ ./dist/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
```

### Step 2: Create docker-compose.yml

```yaml
version: '3.8'

services:
  peekview:
    image: peekview:latest
    # Build from backend directory (run from project root)
    # docker-compose -f packages/mcp-server/docker-compose.yml build
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    volumes:
      - peekview-data:/data
    environment:
      - PEEKVIEW_STORAGE__DATA_DIR=/data
      - PEEKVIEW_STORAGE__DB_PATH=/data/peekview.db
      - PEEKVIEW_SERVER__HOST=0.0.0.0
      - PEEKVIEW_SERVER__PORT=8080

  mcp-server:
    image: peekview/mcp-server:latest
    build:
      context: ./packages/mcp-server
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PEEKVIEW_URL=http://peekview:8080
      - PEEKVIEW_API_KEY=${PEEKVIEW_API_KEY}
      - MCP_TOKEN=${MCP_TOKEN}
      - MCP_PORT=3000
      - MCP_HOST=0.0.0.0
      - MCP_CORS_ORIGINS=*
      - LOG_LEVEL=info
    depends_on:
      - peekview
    restart: unless-stopped

volumes:
  peekview-data:
```

**注意：** docker-compose.yml 应放在项目根目录，而不是 `packages/mcp-server/`，
因为需要引用 `./backend` 和 `./packages/mcp-server` 两个路径。

### Step 3: Add .dockerignore

```gitignore
node_modules/
src/
tests/
tsconfig.json
.env
.env.local
*.log
coverage/
.vscode/
```

### Step 4: Commit

```bash
git add Dockerfile docker-compose.yml .dockerignore
git commit -m "feat(mcp): add docker deployment configuration"
```

---

## Task 8: Documentation

**Files:**
- Create: `packages/mcp-server/README.md`

### Step 1: Write README

```markdown
# PeekView MCP Server

Model Context Protocol (MCP) server for [PeekView](https://github.com/randomgitsrc/peekview) with SSE transport.

## Quick Start

### Docker Compose (Recommended)

```bash
# 1. Generate tokens on your PeekView server
# On the server running PeekView:
peekview apikey create "MCP Server"     # → gives PEEKVIEW_API_KEY
# Generate MCP_TOKEN (any secure string):
export MCP_TOKEN=$(openssl rand -hex 16)

# 2. Configure in .env file
echo "PEEKVIEW_API_KEY=pv_your_key" > .env
echo "MCP_TOKEN=$MCP_TOKEN" >> .env

# 3. Start services (from project root)
docker-compose up -d

# 4. Configure Claude Code (on your local machine)
# Add to ~/.claude/settings.json:
{
  "mcpServers": {
    "peekview": {
      "url": "http://your-server:3000/sse",
      "env": {
        "MCP_TOKEN": "the_mcp_token_you_generated"
      }
    }
  }
}
```

### NPM (standalone)

```bash
# Install
npm install -g @peekview/mcp-server

# Configure (all three required)
export PEEKVIEW_URL=http://localhost:8080      # PeekView server URL
export PEEKVIEW_API_KEY=pv_your_api_key        # Get from: peekview apikey create "MCP"
export MCP_TOKEN=mct_your_connection_token     # Any secure string you choose

# Run
peekview-mcp
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PEEKVIEW_URL` | Yes | - | PeekView API URL (server-side only) |
| `PEEKVIEW_API_KEY` | Yes | - | PeekView API Key (server-side only, never exposed to clients) |
| `MCP_TOKEN` | Yes | - | Connection token for AI clients to authenticate |
| `MCP_PORT` | No | 3000 | Server port |
| `MCP_HOST` | No | 0.0.0.0 | Bind address |
| `MCP_CORS_ORIGINS` | No | `*` | CORS origins (comma-separated) |

## Security

- **Two-layer authentication**: MCP_TOKEN for connections, PEEKVIEW_API_KEY for API operations
- **PEEKVIEW_API_KEY never leaves the server**: clients only use MCP_TOKEN
- **CORS configurable**: restrict origins in production

## Tools

- `create_entry` - Create new entry with files
- `get_entry` - Get entry details
- `list_entries` - List/search entries
- `delete_entry` - Delete entry

## License

MIT
```

### Step 2: Commit

```bash
git add README.md
git commit -m "docs(mcp): add usage documentation"
```

---

## Task 9: Final Verification

### Step 1: Build and Test

```bash
npm run build
npm test
```

Expected: All tests pass, no TypeScript errors.

### Step 2: Test Locally

```bash
# Terminal 1: Start PeekView
peekview serve

# Terminal 2: Start MCP Server
export PEEKVIEW_URL=http://localhost:8080
export PEEKVIEW_API_KEY=$(peekview apikey create "MCP" -j | jq -r '.key')
npm start

# Terminal 3: Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/sse
```

### Step 3: Final Commit

```bash
git add -A
git commit -m "feat(mcp): complete MCP server with SSE transport (Phase 2)"
```

---

## Acceptance Checklist

- [ ] All 4 tools implemented and tested
- [ ] SSE endpoint working at `/sse`
- [ ] Health check at `/health`
- [ ] Docker image builds
- [ ] Docker Compose starts both services
- [ ] Configuration via environment variables
- [ ] Error handling with isError flag
- [ ] README with setup instructions

---

*Plan created: 2026-05-19*  
*Status: Ready for implementation*