import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { translateError } from './utils.js';

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
  handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
    try {
      const { slug } = schema.parse(args);
      const entry = await client.getEntry(slug, ctx.userToken);

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
      return translateError(error, 'get entry');
    }
  },
});