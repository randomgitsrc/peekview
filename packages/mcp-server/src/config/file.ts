/**
 * Config file operations
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import YAML from 'yaml';

export const CONFIG_FILE_PATH = join(homedir(), '.peekview', 'mcp-config.yaml');

export interface ConfigFileData {
  peekview?: {
    url?: string;
    public_url?: string;
    api_key?: string;
  };
  server?: {
    host?: string;
    port?: number;
    cors_origins?: string;
    mode?: 'local' | 'remote';
    allowed_paths?: string[];
  };
  logging?: {
    level?: string;
  };
  [key: string]: Record<string, unknown> | undefined;
}

/**
 * Load config from YAML file
 * Returns null if file doesn't exist
 */
export function loadConfigFromFile(): ConfigFileData | null {
  if (!existsSync(CONFIG_FILE_PATH)) {
    return null;
  }

  const content = readFileSync(CONFIG_FILE_PATH, 'utf-8');
  return YAML.parse(content) as ConfigFileData;
}

/**
 * Save config to YAML file
 * Creates parent directory if needed
 */
export function saveConfigToFile(config: ConfigFileData): void {
  const dir = join(homedir(), '.peekview');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const yamlContent = YAML.stringify(config);
  writeFileSync(CONFIG_FILE_PATH, yamlContent, 'utf-8');
}
