import type { PeekViewClient } from '../client.js';
import type { ServerConfig, ToolDefinition } from '../types.js';
import { createEntryTool } from './createEntry.js';
import { getEntryTool } from './getEntry.js';
import { listEntriesTool } from './listEntries.js';
import { deleteEntryTool } from './deleteEntry.js';

export function createTools(client: PeekViewClient, config: ServerConfig): ToolDefinition[] {
  return [
    createEntryTool(client, config),  // Needs config.publicUrl
    getEntryTool(client),             // No config needed
    listEntriesTool(client),          // No config needed
    deleteEntryTool(client),          // No config needed
  ];
}

export { createEntryTool, getEntryTool, listEntriesTool, deleteEntryTool };
