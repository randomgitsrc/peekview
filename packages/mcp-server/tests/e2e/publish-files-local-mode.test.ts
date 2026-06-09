/**
 * publish_files local-mode E2E test.
 *
 * Safety:
 * - Opt-in only: RUN_PUBLISH_FILES_E2E=1
 * - Refuses to target :8080 or non-localhost URLs
 * - Uses files under /tmp only
 * - Cleans created debug entries after verification
 *
 * Run with:
 *   RUN_PUBLISH_FILES_E2E=1 \
 *   PEEKVIEW_URL=http://127.0.0.1:8888 \
 *   PEEKVIEW_PUBLIC_URL=http://127.0.0.1:8888 \
 *   npx vitest run tests/e2e/publish-files-local-mode.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PeekViewClient } from '../../src/client.js';
import { createTools } from '../../src/tools/index.js';
import { publishFilesTool } from '../../src/tools/publishFiles.js';
import type { ServerConfig } from '../../src/config.js';

const RUN = process.env.RUN_PUBLISH_FILES_E2E === '1';
const PEEKVIEW_URL = process.env.PEEKVIEW_URL || 'http://127.0.0.1:8888';
const PEEKVIEW_PUBLIC_URL = process.env.PEEKVIEW_PUBLIC_URL || PEEKVIEW_URL;
const describeIfEnabled = RUN ? describe : describe.skip;

function assertSafeTarget(): void {
  const url = new URL(PEEKVIEW_URL);
  if (url.port === '8080') {
    throw new Error('Refusing to run publish_files E2E against production port 8080');
  }
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error(`Refusing to run publish_files E2E against non-local target: ${PEEKVIEW_URL}`);
  }
}

function makeConfig(allowedPaths: string[]): ServerConfig {
  return {
    peekviewUrl: PEEKVIEW_URL,
    publicUrl: PEEKVIEW_PUBLIC_URL,
    port: 33333,
    host: '127.0.0.1',
    corsOrigins: ['*'],
    logLevel: 'info',
    mode: 'local',
    allowedPaths,
  };
}

describeIfEnabled('E2E: publish_files local mode', () => {
  beforeAll(async () => {
    assertSafeTarget();
    const health = await fetch(`${PEEKVIEW_URL}/health`);
    expect(health.ok).toBe(true);
  });

  it('exposes publish_files only in local mode and creates clean relative paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pv-publish-e2e-'));
    const slug = `pv-publish-e2e-${Date.now()}`;
    const client = new PeekViewClient({ peekviewUrl: PEEKVIEW_URL });
    const config = makeConfig([root]);

    try {
      await mkdir(join(root, 'src', 'utils'), { recursive: true });
      await writeFile(join(root, 'README.md'), '# publish_files E2E\n');
      await writeFile(join(root, 'src', 'main.py'), 'print("ok")\n');
      await writeFile(join(root, 'src', 'utils', 'helper.py'), 'def helper():\n    return 42\n');

      const toolNames = createTools(client, config).map((tool) => tool.name);
      expect(toolNames).toContain('publish_files');
      expect(toolNames).not.toContain('create_entry');
      expect(toolNames).toContain('get_entry');
      expect(toolNames).toContain('list_entries');
      expect(toolNames).toContain('delete_entry');

      const tool = publishFilesTool(client, config);
      const result = await tool.handler({
        summary: 'publish_files local-mode E2E',
        slug,
        paths: [root],
        include_patterns: ['*.md', '*.py'],
      }, {});

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('已发布 3 个文件');

      const entryRes = await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`);
      expect(entryRes.ok).toBe(true);
      const entry = await entryRes.json();
      const paths = entry.files.map((file: { path: string }) => file.path).sort();
      expect(paths).toEqual(['README.md', 'src/main.py', 'src/utils/helper.py']);

      await writeFile(join(root, 'secret.pem'), 'PRIVATE');
      const blocked = await tool.handler({ summary: 'Blocked', paths: [join(root, 'secret.pem')] }, {});
      expect(blocked.content[0].text).toContain('发布被拒绝');
    } finally {
      await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, { method: 'DELETE' }).catch(() => undefined);
      await rm(root, { recursive: true, force: true });
    }
  });
});
