/**
 * Configuration module with file support
 * Priority: Env > File > Default
 */
import { loadConfigFromFile } from './config/file.js';
import { mergeConfig } from './config/merge.js';

export interface ServerConfig {
  peekviewUrl: string;
  publicUrl: string;
  apiKey?: string;
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: string;
}

export function loadConfig(): ServerConfig {
  // Load from file (lowest priority)
  const fileConfig = loadConfigFromFile();

  // Merge with env vars and defaults
  return mergeConfig(fileConfig, process.env);
}

export function validateConfig(): void {
  loadConfig(); // Throws if invalid
}

// Re-export for CLI usage
export { loadConfigFromFile } from './config/file.js';
export { mergeConfig, type MergedConfig } from './config/merge.js';
