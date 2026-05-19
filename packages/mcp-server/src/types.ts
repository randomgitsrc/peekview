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
  is_public?: boolean;  // Backend uses is_public, not visibility
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
  publicUrl: string;
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
