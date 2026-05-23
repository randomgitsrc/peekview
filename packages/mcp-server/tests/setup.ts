/**
 * Vitest setup file - runs before all tests
 * Ensures clean environment for tests
 */

import { existsSync, renameSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Clean environment variables that might affect tests
const envVarsToClean = [
  'PORT',
  'MCP_PORT',
  'SERVER_PORT',
];

// Clean before all tests
envVarsToClean.forEach((key) => {
  if (key in process.env) {
    delete process.env[key];
  }
});

// Backup config file during tests to prevent interference
const configPath = join(homedir(), '.peekview', 'mcp-config.yaml');
const backupPath = join(homedir(), '.peekview', 'mcp-config.yaml.test-backup');

// Only backup if not already backed up (setup may run multiple times)
if (existsSync(configPath) && !existsSync(backupPath)) {
  renameSync(configPath, backupPath);
  console.log('[Test Setup] Config file backed up:', configPath);
} else if (!existsSync(configPath) && !existsSync(backupPath)) {
  // Config file doesn't exist, which is fine for tests
  console.log('[Test Setup] No config file to backup');
}

console.log('[Test Setup] Environment cleaned:', envVarsToClean);
