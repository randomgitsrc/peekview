import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { translateError } from './utils.js';

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
        ctx.userToken,
        params.page ?? 1,
        params.per_page ?? 20,
        params.query,
        params.tags,
      );

      if (result.items.length === 0) {
        return {
          content: [{ type: 'text', text: 'No entries found.' }],
        };
      }

      const entries = result.items
        .map((e, i) => {
          const fileCount = e.files?.length ?? 0;
          return `${i + 1}. ${e.summary} (${e.slug})\n   Files: ${fileCount} | Tags: ${e.tags?.join(', ') || 'none'} | ${e.is_public ? 'public' : 'private'}`;
        })
        .join('\n\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${result.total} entries (page ${result.page}/${Math.ceil(result.total / result.per_page)}):

${entries}`,
        }],
      };
    } catch (error) {
      return translateError(error, 'list entries');
    }
  },
});