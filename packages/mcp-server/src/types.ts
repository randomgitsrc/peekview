/**
 * PeekView MCP Server Type Definitions
 */

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { MergedConfig } from './config/merge.js';

export type { MergedConfig as ServerConfig } from './config/merge.js';

export interface EntryFile {
  filename: string;
  content?: string;
  content_base64?: string;
  path?: string;
}

export interface CreateEntryRequest {
  slug?: string;
  summary: string;
  files: EntryFile[];
  tags?: string[];
  expires_in?: string;
  is_public?: boolean;
  idempotency_key?: string;
}

export interface EntryFileResponse {
  id: number;
  filename: string;
  path: string | null;
  language: string;
  size: number;
}

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

export interface ListEntriesResponse {
  items: EntryResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface SessionContext {
  userToken: string;
  userId: number;
  username: string;
  namespace?: string;
  pathNamespaces?: Record<string, Record<string, string>>;
}


export type ToolHandler = (args: unknown, context: SessionContext) => Promise<ToolResult>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler: ToolHandler;
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    mimeType?: string;
    data?: string;
  }>;
  isError?: boolean;
}

export function toSDKResult(result: ToolResult): CallToolResult {
  return result as CallToolResult;
}

export class PeekViewApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(`PeekView API error ${status}: ${message}`);
    this.status = status;
  }
}
