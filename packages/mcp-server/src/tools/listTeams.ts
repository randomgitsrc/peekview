import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { translateError } from './utils.js';

const schema = z.object({});

export const listTeamsTool = (client: PeekViewClient): ToolDefinition => ({
  name: 'list_teams',
  description: `List your PeekView teams (owned and joined). Read-only.

Use this to discover valid team_id values before publishing to a team:
- Returns owned and joined teams with their slug and name.
- Pass the team slug as team_id when creating an entry to make it visible to team members only.
- If you omit team_id when creating an entry, it follows is_public (default: PUBLIC!).`,
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (_args: unknown, ctx: SessionContext): Promise<ToolResult> => {
    try {
      schema.parse(_args);
      const teams = await client.listTeams(ctx.userToken);

      const formatList = (label: string, list: Array<{ slug: string; name: string; member_count?: number }>) => {
        if (list.length === 0) {
          return `${label}: (none)`;
        }
        const lines = list.map((t) => `  - ${t.slug} (${t.name}${t.member_count != null ? `, ${t.member_count} members` : ''})`);
        return `${label}:\n${lines.join('\n')}`;
      };

      const text = [
        formatList('Owned', teams.owned),
        formatList('Joined', teams.joined),
      ].join('\n');

      return {
        content: [{
          type: 'text',
          text: `Teams:\n${text}`,
        }],
      };
    } catch (error) {
      return translateError(error, 'list teams');
    }
  },
});
