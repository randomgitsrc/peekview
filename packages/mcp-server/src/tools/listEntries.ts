import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { PeekViewApiError } from '../types.js';

const schema = z.object({
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).default(20),
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
  handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
    try {
      const params = schema.parse(args);
      const result = await client.listEntries(
        params.page ?? 1,
        params.per_page ?? 20,
        params.query,
        params.tags,
        ctx.userToken
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
      if (error instanceof PeekViewApiError) {
        if (error.status === 401) {
          return { content: [{ type: 'text', text: '✗ 认证失败：API Key 无效或已过期，请检查配置' }], isError: true };
        }
      }
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