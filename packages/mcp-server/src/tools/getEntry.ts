import { z } from 'zod';
import type { PeekViewClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import { EntryRefError, parseEntryRef } from '../lib/entryRef.js';
import { purifyContent } from '../lib/purify.js';
import type {
  EntryRawResponse,
  RawFileItem,
  SessionContext,
  ToolDefinition,
  ToolResult,
} from '../types.js';
import { PeekViewApiError } from '../types.js';
import { translateError } from './utils.js';

const schema = z.object({
  ref: z.string().min(1),
  file: z.string().optional(),
});

const MAX_SINGLE_FULL = 200 * 1024;
const MAX_TOTAL_FULL = 32 * 1024;
const SNIPPET_LEN = 2000;

interface OutputFile {
  filename: string;
  path: string | null;
  is_binary: boolean;
  size: number;
  content: string | null;
}

interface GetEntryOutput {
  slug: string;
  summary: string;
  tags: string[];
  files: OutputFile[];
  warning: string | null;
}

function toOutputFile(f: RawFileItem, snippet: boolean): OutputFile {
  let content: string | null = null;
  if (!f.is_binary && f.content) {
    content = purifyContent(snippet ? f.content.slice(0, SNIPPET_LEN) : f.content);
  }
  return {
    filename: f.filename,
    path: f.path,
    is_binary: f.is_binary,
    size: f.size,
    content,
  };
}

function buildOutput(raw: EntryRawResponse, file?: string): GetEntryOutput {
  const base = {
    slug: raw.slug,
    summary: raw.summary,
    tags: raw.tags,
    warning: null as string | null,
  };

  if (file) {
    const matches = raw.files.filter(
      f => `${f.path ? f.path + '/' : ''}${f.filename}` === file || f.filename === file,
    );
    if (matches.length === 0) {
      const names = raw.files.map(f => `${f.path ? f.path + '/' : ''}${f.filename}`);
      throw new Error(`未找到文件 ${file}。可用文件：${names.join(', ')}`);
    }
    if (matches.length > 1) {
      const names = matches.map(f => `${f.path ? f.path + '/' : ''}${f.filename}`);
      throw new Error(`文件 ${file} 匹配多个文件（${names.join(', ')}），请提供更精确的 path/filename`);
    }
    return {
      ...base,
      files: [toOutputFile(matches[0], false)],
    };
  }

  if (raw.files.length === 0) {
    return { ...base, files: [], warning: 'entry 没有文件' };
  }

  if (raw.files.length === 1) {
    const f = raw.files[0];
    const output = toOutputFile(f, false);
    if (!f.is_binary && f.content && f.content.length > MAX_SINGLE_FULL) {
      return { ...base, files: [output], warning: '文件较大（>200KB），内容已完整返回' };
    }
    return { ...base, files: [output] };
  }

  const totalSize = raw.files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize <= MAX_TOTAL_FULL) {
    return { ...base, files: raw.files.map(f => toOutputFile(f, false)) };
  }

  return {
    ...base,
    files: raw.files.map(f => toOutputFile(f, true)),
    warning: '多文件总量超过 32KB，已截断为片段。可用 file= 取单个文件全量内容。',
  };
}

export const getEntryTool = (client: PeekViewClient, config?: ServerConfig): ToolDefinition => {
  const effectiveConfig = config ?? { peekviewUrl: client.getBaseUrl() };
  return {
    name: 'get_entry',
    description: 'Get details of a PeekView entry from a page/raw/share URL or bare slug.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'PeekView page URL, raw URL, share URL, or bare slug',
        },
        file: {
          type: 'string',
          description: 'Fetch a single file by filename or path/filename',
        },
      },
      required: ['ref'],
    },
    handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
      try {
        const { ref, file } = schema.parse(args);
        const parsed = parseEntryRef(ref, effectiveConfig);

        let raw: EntryRawResponse;
        if (parsed.kind === 'slug') {
          raw = await client.fetchEntryRawAuthenticated(parsed.slug, ctx.userToken);
        } else {
          raw = await client.fetchEntryRaw(parsed.host, parsed.slug, {
            shareToken: parsed.shareToken,
          });
        }

        const output = buildOutput(raw, file);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(output, null, 2),
          }],
        };
      } catch (error) {
        if (error instanceof PeekViewApiError && error.status === 404) {
          return {
            content: [{
              type: 'text',
              text: '无法读取：该 entry 为私有（需要分享链接）或 slug 不存在',
            }],
            isError: true,
          };
        }
        if (error instanceof EntryRefError) {
          return {
            content: [{ type: 'text', text: error.message }],
            isError: true,
          };
        }
        return translateError(error, 'get entry');
      }
    },
  };
};
