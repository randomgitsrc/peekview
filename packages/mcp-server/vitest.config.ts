import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    hookTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
    globalSetup: './tests/teardown.ts',
    // Many config tests intentionally mutate process.env/HOME.
    // Run test files serially to avoid cross-file environment races and
    // to guarantee tests never touch the user's real ~/.peekview config.
    fileParallelism: false,
  },
});
