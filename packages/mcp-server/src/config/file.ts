/**
 * Config file operations
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

/** Get home directory from env (overridable in tests), not os.homedir() which caches */
function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '/tmp';
}

export const CONFIG_FILE_PATH = join(getHomeDir(), '.peekview', 'mcp-config.yaml');

function getConfigFilePath(): string {
  return join(getHomeDir(), '.peekview', 'mcp-config.yaml');
}

function getConfigDir(): string {
  return join(getHomeDir(), '.peekview');
}

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
    trust_all_paths?: boolean;
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
  const configPath = getConfigFilePath();
  if (!existsSync(configPath)) {
    return null;
  }

  const content = readFileSync(configPath, 'utf-8');
  return YAML.parse(content) as ConfigFileData;
}

/**
 * Save config to YAML file
 * Creates parent directory if needed
 */
export function saveConfigToFile(config: ConfigFileData): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const yamlContent = YAML.stringify(config);
  writeFileSync(getConfigFilePath(), yamlContent, 'utf-8');
}
