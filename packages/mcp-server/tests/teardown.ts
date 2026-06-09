/**
 * Vitest global teardown - runs after all tests
 * Cleans up temporary test HOME directories.
 * Does NOT touch the user's real ~/.peekview/ configuration.
 */

import { readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export default async function () {
  return async function () {
    const prefix = 'peekview-mcp-test-home-';
    for (const entry of readdirSync(tmpdir())) {
      if (entry.startsWith(prefix)) {
        const testHome = join(tmpdir(), entry);
        rmSync(testHome, { recursive: true, force: true });
        console.log('[Test Teardown] Cleaned up temp HOME:', testHome);
      }
    }
  };
}
