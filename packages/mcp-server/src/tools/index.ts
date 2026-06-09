import type { PeekViewClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type { ToolDefinition } from '../types.js';
import { createEntryTool } from './createEntry.js';
import { publishFilesTool } from './publishFiles.js';
import { getEntryTool } from './getEntry.js';
import { listEntriesTool } from './listEntries.js';
import { deleteEntryTool } from './deleteEntry.js';

/**
 * 根据部署模式返回工具集（详见 docs/plans/mcp-dual-mode-final-v0.7.md）
 * - local 模式：publish_files + 通用工具（不暴露 create_entry）
 * - remote 模式（默认）：create_entry + 通用工具（不暴露 publish_files）
 */
export function createTools(client: PeekViewClient, config: ServerConfig): ToolDefinition[] {
  const common = [
    getEntryTool(client),
    listEntriesTool(client),
    deleteEntryTool(client),
  ];

  if (config.mode === 'local') {
    return [publishFilesTool(client, config), ...common];
  }
  return [createEntryTool(client, config.publicUrl), ...common];
}

export { createEntryTool, publishFilesTool, getEntryTool, listEntriesTool, deleteEntryTool };
