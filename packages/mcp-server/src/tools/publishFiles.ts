import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { PeekViewClient } from '../client.js';
import type { ServerConfig } from '../config.js';
import type { EntryFile, SessionContext, ToolDefinition, ToolResult } from '../types.js';
import { translateError } from './utils.js';

// ── 限制（对齐后端，考虑 base64 膨胀）──
const MAX_SINGLE_FILE_BYTES = 7 * 1024 * 1024;   // 7MB
const MAX_TOTAL_FILES = 50;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;        // 50MB

// ── 目录扫描跳过清单 ──
const SKIP_DIRS = new Set([
  '.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build',
  '.next', '.nuxt', 'coverage', '.DS_Store', '.tox',
]);

// ── 敏感路径 denylist（始终生效，best-effort）──
const SENSITIVE_PATTERNS: RegExp[] = [
  // Secret directories
  /\/\.ssh(?:\/|$)/,
  /\/\.gnupg(?:\/|$)/,
  /\/\.aws(?:\/|$)/,
  /\/\.kube(?:\/|$)/,
  /\/\.docker(?:\/|$)/,
  /\/\.config\/gcloud(?:\/|$)/,
  /\/\.config\/gh(?:\/|$)/,

  // Secret files and environment dumps
  /(?:^|\/)\.env(?:\.[^/]*)?$/,
  /\.env$/,
  /\/\.npmrc$/,
  /\/\.pypirc$/,
  /\/\.netrc$/,
  /\/\.git-credentials$/,
  /\/\.gitconfig$/,
  /\/(?:\.bash_history|\.zsh_history|\.fish_history)$/,

  // Cloud / IaC / editor credential stores (best-effort)
  /\/\.azure\/accessTokens\.json$/,
  /\/\.config\/sops\/age\/keys\.txt$/,
  /\/\.terraform\.d\/credentials\.tfrc\.json$/,
  /\/\.local\/share\/keyrings(?:\/|$)/,
  /\/\.config\/Code\/User\/settings\.json$/,

  // Key/cert extensions
  /\.(?:pem|key|p12|pfx)$/i,

  // System pseudo / protected trees (mainly protects trust_all_paths)
  /^\/proc(?:\/|$)/,
  /^\/sys(?:\/|$)/,
  /^\/dev(?:\/|$)/,
  /^\/run(?:\/|$)/,
  /^\/root(?:\/|$)/,
  /^\/etc(?:\/|$)/,
  /^\/var\/log(?:\/|$)/,

  // Browser profiles/cookies (common secrets)
  /\/\.mozilla(?:\/|$)/,
  /\/\.config\/google-chrome(?:\/|$)/,
  /\/\.config\/chromium(?:\/|$)/,
];

interface SkippedFile {
  path: string;
  reason: 'binary' | 'too_large' | 'not_allowed' | 'not_found';
}

interface CollectedFile {
  absPath: string;
  relPath: string;
  filename: string;
  size: number;
}

type RejectReason = 'sensitive' | 'out_of_scope' | 'tmp_owner';

/** 安全类失败：拒绝整个请求时抛出 */
class SecurityRejection extends Error {
  constructor(
    public readonly rejectPath: string,
    public readonly reason: RejectReason,
    public readonly detail: string,
  ) {
    super(rejectPath);
  }
}

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

/** glob → 正则，只支持文件名通配（* 和 *.ext） */
function matchPattern(filename: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'
  );
  return regex.test(filename);
}

function matchesAny(filename: string, patterns: string[]): boolean {
  return patterns.some((p) => matchPattern(filename, p));
}

/** denylist 检查（对 realpath 后的路径） */
function isSensitive(absPath: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(absPath));
}

/** allowlist 边界检查 */
function isWithinAllowed(absPath: string, allowedBases: string[]): boolean {
  if (allowedBases.length === 0) {
    return true; // trust_all_paths 模式
  }
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

    // denylist（安全类 → 拒绝整个请求）
    if (isSensitive(realChild)) {
      throw new SecurityRejection(realChild, 'sensitive', '');
    }
    // allowlist（安全类 → 拒绝整个请求）
    if (!isWithinAllowed(realChild, allowedBases)) {
      throw new SecurityRejection(realChild, 'out_of_scope', '');
    }

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

function formatSecurityError(rejection: SecurityRejection, allowedBases: string[], mode: string): string {
  if (rejection.reason === 'sensitive') {
    return (
      `ERROR: 发布被拒绝：路径 ${rejection.rejectPath} 命中敏感文件保护规则。\n` +
      `该文件可能包含 token、密码、密钥、历史命令、浏览器 cookie 或系统凭证。\n` +
      `出于安全考虑，整个请求已取消。`
    );
  }

  if (rejection.reason === 'tmp_owner') {
    return (
      `ERROR: 发布被拒绝：路径 ${rejection.rejectPath} 不属于当前用户。\n` +
      `出于安全考虑，整个请求已取消。`
    );
  }

  // out_of_scope
  let detail = '';
  if (allowedBases.length > 0) {
    detail = allowedBases.map((b) => `  - ${b}`).join('\n');
  } else {
    detail = '  - (trust_all_paths: any path allowed)';
  }

  let modeLine = '';
  if (mode === 'trust_all_paths') {
    modeLine = '当前路径模式：trust_all_paths（跳过目录边界）\n';
  } else if (mode === 'allowed_paths') {
    modeLine = '当前路径模式：显式白名单模式（server.allowed_paths 已配置）\n';
  } else {
    modeLine = '当前路径模式：默认安全模式（未配置 server.allowed_paths）\n';
  }

  return (
    `ERROR: 发布被拒绝：路径 ${rejection.rejectPath} 超出允许范围。\n\n` +
    modeLine +
    `当前允许的基准目录：\n${detail}\n\n` +
    `如需访问其他目录，请选择一种方式：\n` +
    `  1) 推荐：配置 server.allowed_paths，例如：\n` +
    `     peekview-mcp config set server.allowed_paths '/home/kity/cclab:/b-dir:/tmp'\n` +
    `     peekview-mcp service restart\n` +
    `  2) 临时：把文件复制到上述任一目录后再发布\n` +
    `  3) 本机自用且完全信任时：设置 server.trust_all_paths=true（危险选项）\n\n` +
    `出于安全考虑，整个请求已取消。`
  );
}

export const publishFilesTool = (client: PeekViewClient, config: ServerConfig): ToolDefinition => ({
  name: 'publish_files',
  description: `Publish local files or directories to PeekView. MCP Server reads files directly.

IMPORTANT USAGE:
- To publish ONE file, pass that file's absolute path.
- Passing a DIRECTORY publishes files under it recursively. Do this only when you intentionally want to publish a directory tree.
- For Agent-generated content: first write it to a file (prefer cwd or system temp dir), then publish that file path only.
- Do NOT pass the project root unless you intend to publish multiple project files.

PATH RULES:
- Paths must be absolute.
- Default allowed bases: process.cwd() and os.tmpdir() only.
- $HOME is NOT allowed by default; configure server.allowed_paths for extra directories.
- server.trust_all_paths=true disables the allowlist, but sensitive paths are still blocked (best-effort; NOT a complete security boundary).
- Sensitive files such as .env, *.env, .npmrc, .pypirc, .git-credentials, ~/.ssh, ~/.aws, ~/.kube, *.pem/*.key are always blocked.

VISIBILITY:
- publish_files defaults to private (is_public=false). Set is_public=true to publish a public link.

Examples:
- Single file:   { "summary": "Fix", "paths": ["/project/fix.py"] }
- Generated doc: write_file("/tmp/intro.md") then { "summary": "Intro", "paths": ["/tmp/intro.md"] }
- Directory:     { "summary": "Docs", "paths": ["/project/docs/"], "include_patterns": ["*.md"] }

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
      is_public: { type: 'boolean', description: 'Whether entry is public (default: false)' },
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

      const cwd = process.cwd();
      if (path.resolve(cwd) === path.parse(cwd).root) {
        return {
          content: [{
            type: 'text',
            text: 'ERROR: local 模式未配置 allowed_paths，且当前工作目录为文件系统根目录。请显式配置 server.allowed_paths 后再使用 publish_files。',
          }],
        };
      }

      // 解析路径策略
      const tmpDir = os.tmpdir();
      let allowedBases: string[];
      let pathMode: string;
      if (config.trustAllPaths) {
        allowedBases = []; // trust 模式下 isWithinAllowed 总返回 true
        pathMode = 'trust_all_paths';
      } else if (config.allowedPaths.length > 0) {
        allowedBases = config.allowedPaths.map((p) => path.resolve(p));
        pathMode = 'allowed_paths';
      } else {
        allowedBases = Array.from(new Set([cwd, tmpDir].map((p) => path.resolve(p))));
        pathMode = 'default';
      }

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

          // 2. stat 检查存在性（先于 realpath）
          let stat: import('fs').Stats;
          try {
            stat = await fs.stat(inputPath);
          } catch {
            skipped.push({ path: inputPath, reason: 'not_found' });
            continue;
          }

          // 3. realpath 解析符号链接
          const realPath = await fs.realpath(inputPath);

          // 4. denylist（安全类 → 拒绝整个请求）—— 对 realpath 后的路径
          if (isSensitive(realPath)) {
            throw new SecurityRejection(realPath, 'sensitive', '');
          }

          // 5. allowlist 边界检查（安全类 → 拒绝整个请求）
          if (!isWithinAllowed(realPath, allowedBases)) {
            throw new SecurityRejection(realPath, 'out_of_scope', '');
          }

          if (stat.isDirectory()) {
            visited.add(realPath);
            const baseForRel = realPath;
            const files = await scanDirectory(
              realPath, baseForRel, allowedBases, visited, skipped,
              params.include_patterns, params.exclude_patterns,
            );
            collected.push(...files);
          } else if (stat.isFile()) {
            // /tmp 下 owner 检查（best-effort，TOCTOU 已知限制）
            if (realPath.startsWith(path.resolve(tmpDir) + path.sep)) {
              try {
                const st = await fs.stat(realPath);
                if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
                  throw new SecurityRejection(realPath, 'tmp_owner', '');
                }
              } catch {
                // 如果平台不支持 uid 检查，跳过
              }
            }

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
              text: formatSecurityError(e, allowedBases, pathMode),
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
        files.push({
          filename: cf.filename,
          content: buf.toString('utf-8'),
          path: cf.relPath,
        });
      }

      if (files.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `ERROR: 所有文件都被跳过。\n${formatSkipped(skipped)}`,
          }],
        };
      }

      // 发布——默认 is_public=false
      const entry = await client.createEntry({
        summary: params.summary,
        files,
        slug: params.slug,
        tags: params.tags,
        is_public: params.is_public ?? false,
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
