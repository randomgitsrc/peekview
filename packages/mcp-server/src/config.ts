/**
 * Configuration module with validation
 */
import { z } from 'zod';
import type { ServerConfig } from './types.js';

const configSchema = z.object({
  PEEKVIEW_URL: z.string().url().min(1),
  PEEKVIEW_PUBLIC_URL: z.string().url().min(1),
  MCP_PORT: z.coerce.number().int().positive().default(33333),
  MCP_HOST: z.string().default('0.0.0.0'),
  MCP_CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export function loadConfig(): ServerConfig {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path}: ${e.message}`).join('\n');
    throw new Error(`Configuration error:\n${errors}\n\nRequired environment variables:\n- PEEKVIEW_URL: PeekView API base URL (internal)\n- PEEKVIEW_PUBLIC_URL: PeekView public URL (for user-facing links)`);
  }

  const env = result.data;

  return {
    peekviewUrl: env.PEEKVIEW_URL.replace(/\/$/, ''),
    publicUrl: env.PEEKVIEW_PUBLIC_URL.replace(/\/$/, ''),
    port: env.MCP_PORT,
    host: env.MCP_HOST,
    corsOrigins: env.MCP_CORS_ORIGINS.split(','),
    logLevel: env.LOG_LEVEL,
  };
}

export function validateConfig(): void {
  loadConfig(); // Throws if invalid
}