import { PeekViewApiError } from '../types.js';
import type { ToolResult } from '../types.js';

export function translateError(error: unknown, action: string): ToolResult {
  if (error instanceof PeekViewApiError) {
    let message: string;
    if (error.status === 401) {
      message = '认证失败：API Key 无效或已过期，请检查配置';
    } else if (error.status === 403) {
      message = '权限不足';
    } else {
      message = `操作失败：${error.message}`;
    }
    return {
      content: [{ type: 'text', text: `✗ ${message}` }],
      isError: true,
    };
  }
  return {
    content: [{
      type: 'text',
      text: `✗ Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }],
    isError: true,
  };
}