/**
 * Config merging logic
 * Priority: Env > File > Default
 */
import os from 'os';
import path from 'path';
import type { ConfigFileData } from './file.js';

export function expandHome(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

export interface MergedConfig {
  peekviewUrl: string;
  publicUrl: string;
  apiKey?: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
  mode: 'local' | 'remote';
  allowedPaths: string[];
  trustAllPaths: boolean;
  pathNamespaces: Record<string, Record<string, string>>;
  configSource: 'file' | 'env' | 'default';
  configPath: string | null;
}

export function mergeConfig(fileConfig: ConfigFileData | null, env: NodeJS.ProcessEnv, configFilePath?: string): MergedConfig {
  // Required fields
  const peekviewUrl = env.PEEKVIEW_URL ?? fileConfig?.peekview?.url;
  const publicUrl = env.PEEKVIEW_PUBLIC_URL ?? fileConfig?.peekview?.public_url;

  if (!peekviewUrl) {
    throw new Error('Configuration error:\nPEEKVIEW_URL: Required\n\nRequired environment variables:\n- PEEKVIEW_URL: PeekView API base URL (internal)\n- PEEKVIEW_PUBLIC_URL: PeekView public URL (for user-facing links)');
  }

  if (!publicUrl) {
    throw new Error('Configuration error:\nPEEKVIEW_PUBLIC_URL: Required\n\nRequired environment variables:\n- PEEKVIEW_URL: PeekView API base URL (internal)\n- PEEKVIEW_PUBLIC_URL: PeekView public URL (for user-facing links)');
  }

  // Parse port - env > file > default
  let port = 33333;
  if (env.MCP_PORT) {
    port = parseInt(env.MCP_PORT, 10);
  } else if (fileConfig?.server?.port) {
    port = fileConfig.server.port;
  }

  // Host - env > file > default
  const host = env.MCP_HOST ?? fileConfig?.server?.host ?? '0.0.0.0';

  // CORS origins - env > file > default
  let corsOrigins: string[] = ['*'];
  const corsOriginsValue = env.MCP_CORS_ORIGINS ?? fileConfig?.server?.cors_origins;
  if (corsOriginsValue) {
    corsOrigins = corsOriginsValue.split(',');
  }

  // Log level - env > file > default
  const logLevel = env.MCP_LOG_LEVEL ?? fileConfig?.logging?.level ?? 'info';

  // API key - env > file (file may be sensitive, so env takes precedence)
  const apiKey = env.PEEKVIEW_API_KEY ?? fileConfig?.peekview?.api_key;

  // Mode - env > file > default 'remote'
  const modeValue = env.MCP_MODE ?? fileConfig?.server?.mode ?? 'remote';
  if (modeValue !== 'local' && modeValue !== 'remote') {
    throw new Error(`Configuration error:\nMCP_MODE: must be 'local' or 'remote', got '${modeValue}'`);
  }
  const mode: 'local' | 'remote' = modeValue;

  // Allowed paths - env (colon-separated) > file (array) > default []
  let allowedPaths: string[] = [];
  if (env.MCP_ALLOWED_PATHS) {
    allowedPaths = env.MCP_ALLOWED_PATHS.split(':').filter((p) => p.length > 0).map(expandHome);
  } else if (fileConfig?.server?.allowed_paths) {
    const raw = fileConfig.server.allowed_paths;
    const paths = typeof raw === 'string'
      ? raw.split(':').filter((p: string) => p.length > 0)
      : Array.isArray(raw) ? raw : [];
    allowedPaths = paths.map(expandHome);
  }

  // Path namespaces - from file config only, host_path expanded via expandHome
  const rawNamespaces = (fileConfig?.server as Record<string, unknown> | undefined)?.path_namespaces as Record<string, Record<string, string>> | undefined ?? {};
  const pathNamespaces: Record<string, Record<string, string>> = {};
  for (const [nsId, mappings] of Object.entries(rawNamespaces)) {
    pathNamespaces[nsId] = {};
    for (const [containerPath, hostPath] of Object.entries(mappings as Record<string, string>)) {
      pathNamespaces[nsId][containerPath] = expandHome(hostPath);
    }
  }

  // Trust all paths - env > file > default false
  const trustAllPaths = parseBool(
    env.MCP_TRUST_ALL_PATHS ?? fileConfig?.server?.trust_all_paths ?? false
  );

  // local 模式 warning
  if (mode === 'local') {
    if (trustAllPaths) {
      // eslint-disable-next-line no-console
      console.warn(
        '[peekview-mcp] WARNING: server.trust_all_paths=true is enabled.\n' +
        '  Directory allowlist is disabled; sensitive path filtering is best-effort only.\n' +
        '  It cannot protect every secret file. Do not use this on multi-user machines,\n' +
        '  remote MCP servers, untrusted prompts, or environments containing credentials.'
      );
      if (allowedPaths.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('[peekview-mcp] allowed_paths is configured but will be ignored because trust_all_paths=true.');
      }
    } else if (allowedPaths.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[peekview-mcp] local 模式未配置 allowed_paths，默认仅允许当前工作目录和系统临时目录。\n' +
        '  若作为系统服务（systemd/launchd）运行，cwd 可能是 / 等过大范围，\n' +
        '  强烈建议在 ~/.peekview/mcp-config.yaml 的 server.allowed_paths 显式配置。'
      );
    }
  }

  let configSource: 'file' | 'env' | 'default' = 'default';
  if (fileConfig) configSource = 'file';
  if (env.PEEKVIEW_URL || env.MCP_PORT || env.MCP_MODE) configSource = 'env';

  const configPath = fileConfig ? (process.env.HOME || process.env.USERPROFILE || '/tmp') + '/.peekview/mcp-config.yaml' : null;

  return {
    peekviewUrl: peekviewUrl.replace(/\/$/, ''),
    publicUrl: publicUrl.replace(/\/$/, ''),
    port,
    host,
    corsOrigins,
    logLevel,
    mode,
    allowedPaths,
    trustAllPaths,
    pathNamespaces,
    configSource,
    configPath,
    ...(apiKey ? { apiKey } : {}),
  };

  function parseBool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true' || value === '1';
    return false;
  }
}
