/**
 * Configuration module with file support
 * Priority: Env > File > Default
 */
import { loadConfigFromFile, CONFIG_FILE_PATH } from './config/file.js';
import { mergeConfig } from './config/merge.js';

export type { MergedConfig as ServerConfig } from './config/merge.js';

export function loadConfig() {
  const fileConfig = loadConfigFromFile();
  return mergeConfig(fileConfig, process.env, CONFIG_FILE_PATH);
}

export function validateConfig(): void {
  loadConfig();
}

export { loadConfigFromFile } from './config/file.js';
export { mergeConfig, type MergedConfig } from './config/merge.js';
