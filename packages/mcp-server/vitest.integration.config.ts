import { defineConfig } from 'vitest/config';

/**
 * Integration test config - runs only tests/integration/
 * Requires PeekView backend running on PEEKVIEW_URL
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    hookTimeout: 30000, // Longer timeout for real network calls
  },
});
