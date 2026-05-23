/**
 * Vitest global teardown - runs after all tests
 * Restores backed up config file
 */

import { existsSync, renameSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// This function runs after all tests
export default async function() {
  // Return teardown function
  return async function() {
    const configPath = join(homedir(), '.peekview', 'mcp-config.yaml');
    const backupPath = join(homedir(), '.peekview', 'mcp-config.yaml.test-backup');

    // Restore config file if backed up
    if (existsSync(backupPath)) {
      renameSync(backupPath, configPath);
      console.log('[Test Teardown] Config file restored:', configPath);
    }
  };
}
