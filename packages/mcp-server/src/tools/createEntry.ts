import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { ServerConfig, ToolDefinition, ToolResult } from '../types.js';

const schema = z.object({
  summary: z.string().min(1),
  files: z.array(z.object({
    filename: z.string().min(1),
    content: z.string(),
    path: z.string().optional(),
  })).min(1),
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  expires_in: z.string().optional(),
});

export const createEntryTool = (client: PeekViewClient, config: ServerConfig): ToolDefinition => ({
  name: 'create_entry',
  description: `Create a new PeekView entry with files. Returns the entry URL.

Examples:
- Create a code snippet: {"summary": "Fix for bug #123", "files": [{"filename": "fix.py", "content": "..."}]}
- Create private entry: {"summary": "Internal notes", "files": [...], "is_public": false}
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
      is_public: { type: 'boolean', description: 'Whether entry is public (default: true)' },
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
        is_public: params.is_public,
        expires_in: params.expires_in,
      });

      // Use publicUrl for user-facing links (fixes Docker internal URL issue)
      const baseUrl = config.publicUrl;

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
