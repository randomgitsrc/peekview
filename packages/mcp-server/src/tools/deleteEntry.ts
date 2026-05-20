import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { translateError } from './utils.js';

const schema = z.object({
  slug: z.string().min(1),
  confirm: z.boolean().optional(),
});

export const deleteEntryTool = (client: PeekViewClient): ToolDefinition => ({
  name: 'delete_entry',
  description: 'Delete a PeekView entry by slug. This action cannot be undone. Requires confirmation.',
  inputSchema: {
    type: 'object',
    properties: {
      slug: { type: 'string', description: 'Entry slug to delete' },
      confirm: { type: 'boolean', description: 'Set to true to confirm deletion' },
    },
    required: ['slug'],
  },
  handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
    try {
      const { slug, confirm } = schema.parse(args);

      if (!confirm) {
        return {
          content: [{
            type: 'text',
            text: `⚠️ About to delete entry "${slug}". This action cannot be undone.\n\nTo confirm, call delete_entry with {"slug": "${slug}", "confirm": true}`,
          }],
        };
      }

      await client.deleteEntry(slug, ctx.userToken);
      return {
        content: [{
          type: 'text',
          text: `✓ Entry "${slug}" deleted successfully.`,
        }],
      };
    } catch (error) {
      return translateError(error, 'delete entry');
    }
  },
});