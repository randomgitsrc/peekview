/**
 * PeekView MCP Server Type Definitions
 */

// File object for entry creation
export interface EntryFile {
  filename: string;
  content: string;
  path?: string;
}

// Entry creation request - matches backend CreateEntryRequest
export interface CreateEntryRequest {
  slug?: string;
  summary: string;
  files: EntryFile[];
  tags?: string[];
  expires_in?: string;
  is_public?: boolean;
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

// Server configuration (no apiKey/mcpToken - users bring their own pv_ keys)
export interface ServerConfig {
  peekviewUrl: string;
  publicUrl: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
}

// Session context for tool handlers (from AsyncLocalStorage)
export interface SessionContext {
  userToken: string;   // pv_xxx API Key
  userId: number;      // PeekView user ID
  username: string;    // PeekView username
}

// Session info stored in memory
export interface SessionInfo {
  transport: SSEServerTransport;
  userToken: string;
  userId: number;
  username: string;
}

// Tool handler type - receives args + session context
export type ToolHandler = (args: unknown, context: SessionContext) => Promise<ToolResult>;

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

// PeekView API error
export class PeekViewApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(`PeekView API error ${status}: ${message}`);
    this.status = status;
  }
}

// SSEServerTransport type reference (imported from SDK)
import type { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';