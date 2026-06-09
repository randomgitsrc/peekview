/**
 * PeekView MCP Server Type Definitions
 */

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface EntryFile {
  filename: string;
  content: string;
  path?: string;
}

export interface CreateEntryRequest {
  slug?: string;
  summary: string;
  files: EntryFile[];
  tags?: string[];
  expires_in?: string;
  is_public?: boolean;
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

export interface ServerConfig {
  peekviewUrl: string;
  publicUrl: string;
  apiKey?: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
  configSource?: 'file' | 'env' | 'default';
  configPath?: string | null;
}

export interface SessionContext {
  userToken: string;
  userId: number;
  username: string;
}

export interface SessionInfo {
  transport: StreamableHTTPServerTransport;
  server: Server;
  userToken: string;
  userId: number;
  username: string;
  lastActivity: number;
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
