import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import type { PeekViewClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type { EntryFile, SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { translateError } from './utils.js';

// ── 限制（对齐后端，考虑 base64 膨胀，详见 mcp-dual-mode-final-v0.7.md §七）──
const MAX_SINGLE_FILE_BYTES = 7 * 1024 * 1024;   // 7MB（后端 10MB，扣 base64 33% 余量）
const MAX_TOTAL_FILES = 50;                        // 对齐后端 max_entry_files
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;          // 50MB（后端 100MB 的一半）

// ── 目录扫描跳过清单 ──
const SKIP_DIRS = new Set([
  '.git', 'node_modules', '__pycache__', '.venv', 'dist', 'build',
  '.next', '.nuxt', 'coverage', '.DS_Store',
]);

// ── 敏感路径黑名单（优先级最高，始终拒绝）──
const SENSITIVE_PATTERNS: RegExp[] = [
  /\/\.ssh\//,
  /\/\.gnupg\//,
  /\/\.aws\//,
  /\/\.config\/gcloud\//,
  /\.pem$/,
  /\.key$/,
  /\.p12$/,
  /\.pfx$/,
];

interface SkippedFile {
  path: string;
  reason: 'binary' | 'too_large' | 'not_allowed' | 'not_found';
}

interface CollectedFile {
  absPath: string;     // 真实绝对路径（已 realpath）
  relPath: string;     // 相对 base 的路径（用作后端 path，含文件名）
  filename: string;    // 文件名
  size: number;
}

/** 安全类失败：拒绝整个请求时抛出 */
class SecurityRejection extends Error {}

const schema = z.object({
  summary: z.string().min(1).max(500),
  paths: z.array(z.string().min(1)).min(1).max(50),
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_public: z.boolean().optional(),
  expires_in: z.string().optional(),
  include_patterns: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
});

/** glob → 正则，只支持文件名通配（* 和 *.ext），不支持路径 glob */
function matchPattern(filename: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'
  );
  return regex.test(filename);
}

function matchesAny(filename: string, patterns: string[]): boolean {
  return patterns.some((p) => matchPattern(filename, p));
}

/** 黑名单检查 */
function isSensitive(absPath: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(absPath));
}

/** allowlist / cwd 边界检查 */
function isWithinAllowed(absPath: string, allowedBases: string[]): boolean {
  return allowedBases.some((base) => {
    const resolvedBase = path.resolve(base);
    return absPath === resolvedBase || absPath.startsWith(resolvedBase + path.sep);
  });
}

/** 简易二进制检测：含 NUL 字节即视为二进制 */
function looksBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/**
 * 递归扫描目录，收集文本文件。
 * 防环：用已访问 realpath 集合避免符号链接循环。
 */
async function scanDirectory(
  dirAbs: string,
  baseForRel: string,
  allowedBases: string[],
  visited: Set<string>,
  skipped: SkippedFile[],
  include?: string[],
  exclude?: string[],
): Promise<CollectedFile[]> {
  const out: CollectedFile[] = [];
  let entries: import('fs').Dirent[];
  try {
    entries = await fs.readdir(dirAbs, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;

    const childPath = path.join(dirAbs, entry.name);
    let realChild: string;
    try {
      realChild = await fs.realpath(childPath);
    } catch {
      skipped.push({ path: childPath, reason: 'not_found' });
      continue;
    }

    // 黑名单 / 边界检查（安全类失败 → 拒绝整个请求）
    if (isSensitive(realChild)) throw new SecurityRejection(realChild);
    if (!isWithinAllowed(realChild, allowedBases)) throw new SecurityRejection(realChild);

    const stat = await fs.stat(realChild);

    if (stat.isDirectory()) {
      if (visited.has(realChild)) continue;  // 防环
      visited.add(realChild);
      const sub = await scanDirectory(realChild, baseForRel, allowedBases, visited, skipped, include, exclude);
      out.push(...sub);
    } else if (stat.isFile()) {
      const filename = entry.name;
      if (include && include.length > 0 && !matchesAny(filename, include)) continue;
      if (exclude && exclude.length > 0 && matchesAny(filename, exclude)) continue;

      if (stat.size > MAX_SINGLE_FILE_BYTES) {
        skipped.push({ path: childPath, reason: 'too_large' });
        continue;
      }
      const relPath = path.relative(baseForRel, realChild);
      out.push({ absPath: realChild, relPath, filename, size: stat.size });
    }
  }
  return out;
}

export const publishFilesTool = (client: PeekViewClient, config: ServerConfig): ToolDefinition => ({
  name: 'publish_files',
  description: `Publish local files or directories to PeekView. MCP Server reads files directly.

WARNING: Do NOT call read_file before this tool — pass paths directly.
Filenames and extensions are inferred from paths automatically.
Paths must be absolute. Directories are scanned recursively.

Examples:
- File:      { "summary": "Fix", "paths": ["/project/fix.py"] }
- Directory: { "summary": "Src", "paths": ["/project/src/"] }
- Mixed:     { "summary": "v1", "paths": ["/project/src/", "/project/README.md"] }
- Filtered:  { "summary": "Py", "paths": ["/project/"], "include_patterns": ["*.py"] }

For Agent-generated content: write it to a file first (write_file), then publish the path.
Skipped automatically: .git, node_modules, __pycache__, .venv, dist, build`,
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Entry summary/description' },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Absolute paths to files or directories (directories scanned recursively)',
      },
      slug: { type: 'string', description: 'Custom URL slug (auto-generated if not provided)' },
      tags: { type: 'array', items: { type: 'string' } },
      is_public: { type: 'boolean', description: 'Whether entry is public (default: true)' },
      expires_in: { type: 'string', description: 'Expiration duration (e.g., "7d", "1h")' },
      include_patterns: {
        type: 'array', items: { type: 'string' },
        description: 'Filename globs to include (e.g., ["*.py", "*.md"])',
      },
      exclude_patterns: {
        type: 'array', items: { type: 'string' },
        description: 'Filename globs to exclude',
      },
    },
    required: ['summary', 'paths'],
  },
  handler: async (args: unknown, ctx: SessionContext): Promise<ToolResult> => {
    try {
      const params = schema.parse(args);

      // 边界基准：配置了 allowedPaths 用之，否则 fallback 到 cwd。
      // 安全约束：cwd 为 / 时不能 fallback，否则等价于允许全盘读取。
      if (config.allowedPaths.length === 0 && path.resolve(process.cwd()) === path.parse(process.cwd()).root) {
        return {
          content: [{
            type: 'text',
            text: 'ERROR: local 模式未配置 allowed_paths，且当前工作目录为文件系统根目录。请显式配置 server.allowed_paths 后再使用 publish_files。',
          }],
        };
      }
      const allowedBases = config.allowedPaths.length > 0
        ? config.allowedPaths.map((p) => path.resolve(p))
        : [process.cwd()];

      const skipped: SkippedFile[] = [];
      const collected: CollectedFile[] = [];
      const visited = new Set<string>();

      try {
        for (const inputPath of params.paths) {
          // 1. 必须绝对路径
          if (!path.isAbsolute(inputPath)) {
            skipped.push({ path: inputPath, reason: 'not_allowed' });
            continue;
          }

          // 2. stat 检查存在性（先于 realpath，避免 ENOENT）
          let stat: import('fs').Stats;
          try {
            stat = await fs.stat(inputPath);
          } catch {
            skipped.push({ path: inputPath, reason: 'not_found' });
            continue;
          }

          // 3. realpath 解析符号链接
          const realPath = await fs.realpath(inputPath);

          // 4. 黑名单（安全类 → 拒绝整个请求）
          if (isSensitive(realPath)) throw new SecurityRejection(realPath);

          // 5. 边界检查（安全类 → 拒绝整个请求）
          if (!isWithinAllowed(realPath, allowedBases)) throw new SecurityRejection(realPath);

          if (stat.isDirectory()) {
            // base 使用目录自身，后端 path 才是 src/main.py 而不是 root-dir/src/main.py
            visited.add(realPath);
            const baseForRel = realPath;
            const files = await scanDirectory(
              realPath, baseForRel, allowedBases, visited, skipped,
              params.include_patterns, params.exclude_patterns,
            );
            collected.push(...files);
          } else if (stat.isFile()) {
            const filename = path.basename(realPath);
            if (params.include_patterns?.length && !matchesAny(filename, params.include_patterns)) continue;
            if (params.exclude_patterns?.length && matchesAny(filename, params.exclude_patterns)) continue;
            if (stat.size > MAX_SINGLE_FILE_BYTES) {
              skipped.push({ path: inputPath, reason: 'too_large' });
              continue;
            }
            collected.push({ absPath: realPath, relPath: filename, filename, size: stat.size });
          }
        }
      } catch (e) {
        if (e instanceof SecurityRejection) {
          return {
            content: [{
              type: 'text',
              text: `ERROR: 发布被拒绝：路径 ${e.message} 命中敏感文件黑名单或超出允许范围。\n出于安全考虑，整个请求已取消。`,
            }],
          };
        }
        throw e;
      }

      // 文件数限制
      if (collected.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `ERROR: 没有可发布的文件。\n${skipped.length > 0 ? formatSkipped(skipped) : '请检查路径是否正确。'}`,
          }],
        };
      }
      if (collected.length > MAX_TOTAL_FILES) {
        return {
          content: [{ type: 'text', text: `ERROR: 文件数 ${collected.length} 超过上限 ${MAX_TOTAL_FILES}。` }],
        };
      }

      // 读取内容 + 二进制/总大小检查
      const files: EntryFile[] = [];
      let totalBytes = 0;
      for (const cf of collected) {
        const buf = await fs.readFile(cf.absPath);
        if (looksBinary(buf)) {
          skipped.push({ path: cf.absPath, reason: 'binary' });
          continue;
        }
        totalBytes += buf.length;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return {
            content: [{ type: 'text', text: `ERROR: 总大小超过 ${MAX_TOTAL_BYTES / 1024 / 1024}MB 限制。` }],
          };
        }
        // 不传 language，后端 detect_language 自动推断（消除后缀填错问题）
        files.push({
          filename: cf.filename,
          content: buf.toString('utf-8'),
          path: cf.relPath,
        });
      }

      if (files.length === 0) {
        return {
          content: [{ type: 'text', text: `ERROR: 所有文件都被跳过。\n${formatSkipped(skipped)}` }],
        };
      }

      // 发布（复用 create_entry 后端接口）
      const entry = await client.createEntry({
        summary: params.summary,
        files,
        slug: params.slug,
        tags: params.tags,
        is_public: params.is_public,
        expires_in: params.expires_in,
      }, ctx.userToken);

      // 构造结果
      let text = `OK: 已发布 ${files.length} 个文件\n`;
      for (const f of files) {
        text += `  ${f.path} (${formatSize(Buffer.byteLength(f.content, 'utf-8'))})\n`;
      }
      if (skipped.length > 0) {
        text += formatSkipped(skipped);
      }
      text += `Link: ${config.publicUrl}/${entry.slug}`;

      return { content: [{ type: 'text', text }] };
    } catch (error) {
      return translateError(error, 'publish files');
    }
  },
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSkipped(skipped: SkippedFile[]): string {
  const reasonText: Record<SkippedFile['reason'], string> = {
    binary: '二进制文件',
    too_large: `超过 ${MAX_SINGLE_FILE_BYTES / 1024 / 1024}MB`,
    not_allowed: '路径无效或不允许',
    not_found: '文件不存在',
  };
  let s = `Skipped ${skipped.length} 个：\n`;
  for (const sk of skipped) {
    s += `  ${path.basename(sk.path)} — ${reasonText[sk.reason]}\n`;
  }
  return s;
}
