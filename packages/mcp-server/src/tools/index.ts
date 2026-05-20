import type { PeekViewClient } from '../client.js';
import type { ToolDefinition } from '../types.js';
import { createEntryTool } from './createEntry.js';
import { getEntryTool } from './getEntry.js';
import { listEntriesTool } from './listEntries.js';
import { deleteEntryTool } from './deleteEntry.js';

export function createTools(client: PeekViewClient, publicUrl: string): ToolDefinition[] {
  return [
    createEntryTool(client, publicUrl),
    getEntryTool(client),
    listEntriesTool(client),
    deleteEntryTool(client),
  ];
}

export { createEntryTool, getEntryTool, listEntriesTool, deleteEntryTool };