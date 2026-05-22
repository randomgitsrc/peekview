/**
 * Config merging logic
 * Priority: Env > File > Default
 */
import type { ConfigFileData } from './file.js';

export interface MergedConfig {
  peekviewUrl: string;
  publicUrl: string;
  apiKey?: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
}

export function mergeConfig(fileConfig: ConfigFileData | null, env: NodeJS.ProcessEnv): MergedConfig {
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

  return {
    peekviewUrl: peekviewUrl.replace(/\/$/, ''), // remove trailing slash
    publicUrl: publicUrl.replace(/\/$/, ''),
    port,
    host,
    corsOrigins,
    logLevel,
    ...(apiKey ? { apiKey } : {}),
  };
}
