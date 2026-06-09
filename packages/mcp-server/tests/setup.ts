/**
 * Vitest setup file - runs before all tests
 * Ensures clean environment for tests
 */

import { mkdirSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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

// Isolate config file access during tests.
// IMPORTANT: never rename or modify the user's real ~/.peekview/mcp-config.yaml.
const testHome = mkdtempSync(join(tmpdir(), 'peekview-mcp-test-home-'));
mkdirSync(join(testHome, '.peekview'), { recursive: true });
process.env.PEEKVIEW_MCP_TEST_HOME = testHome;
process.env.HOME = testHome;
process.env.USERPROFILE = testHome;

console.log('[Test Setup] HOME isolated:', testHome);
console.log('[Test Setup] Environment cleaned:', envVarsToClean);
