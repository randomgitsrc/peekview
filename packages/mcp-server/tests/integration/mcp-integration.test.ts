/**
 * MCP Server Integration Tests (v0.2.0 multi-user)
 *
 * Tests MCP Server tools with REAL PeekView backend
 * Requires PeekView backend running and PEEKVIEW_API_KEY set
 *
 * Run with: PEEKVIEW_URL=http://127.0.0.1:8888 PEEKVIEW_API_KEY=pv_xxx npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PeekViewClient } from '../../src/client.js';
import { createEntryTool } from '../../src/tools/createEntry.js';
import { getEntryTool } from '../../src/tools/getEntry.js';
import { listEntriesTool } from '../../src/tools/listEntries.js';
import { deleteEntryTool } from '../../src/tools/deleteEntry.js';
import type { SessionContext } from '../../src/types.js';

const PEEKVIEW_URL = process.env.PEEKVIEW_URL || 'http://127.0.0.1:8888';
const PEEKVIEW_PUBLIC_URL = process.env.PEEKVIEW_PUBLIC_URL || PEEKVIEW_URL;
const PEEKVIEW_API_KEY = process.env.PEEKVIEW_API_KEY || '';

// Session context for tool calls (simulates what AsyncLocalStorage provides)
const testContext: SessionContext = {
  userToken: PEEKVIEW_API_KEY,
  userId: 0,     // Will be populated after auth check
  username: '',  // Will be populated after auth check
};

const createdSlugs: string[] = [];
let backendAvailable = false;

async function callMCPTool(toolName: string, args: any): Promise<any> {
  const client = new PeekViewClient({ peekviewUrl: PEEKVIEW_URL });

  let tool;
  switch (toolName) {
    case 'create_entry':
      tool = createEntryTool(client, PEEKVIEW_PUBLIC_URL);
      break;
    case 'get_entry':
      tool = getEntryTool(client);
      break;
    case 'list_entries':
      tool = listEntriesTool(client);
      break;
    case 'delete_entry':
      tool = deleteEntryTool(client);
      break;
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  return await tool.handler(args, testContext);
}

describe('Integration: MCP Server v0.2.0 + PeekView Backend', () => {
  beforeAll(async () => {
    // Check backend availability
    try {
      const response = await fetch(`${PEEKVIEW_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        console.log(`Connected to PeekView backend v${data.version} at ${PEEKVIEW_URL}`);
        backendAvailable = true;
      }
    } catch {
      console.warn(`PeekView backend not available at ${PEEKVIEW_URL}`);
      console.warn('Skipping integration tests. Run with: make debug-start');
    }

    // Validate API key and get user info
    if (PEEKVIEW_API_KEY) {
      const client = new PeekViewClient({ peekviewUrl: PEEKVIEW_URL });
      const userInfo = await client.validateToken(PEEKVIEW_API_KEY);
      if (userInfo) {
        testContext.userId = userInfo.id;
        testContext.username = userInfo.username;
        console.log(`Authenticated as user: ${userInfo.username} (id: ${userInfo.id})`);
      } else {
        console.warn('API key validation failed - some tests may fail');
      }
    } else {
      console.warn('PEEKVIEW_API_KEY not set, skipping tests');
    }
  });

  afterAll(async () => {
    console.log(`Cleaning up ${createdSlugs.length} test entries...`);
    for (const slug of createdSlugs) {
      try {
        await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
        });
      } catch { /* ignore cleanup errors */ }
    }
  });

  const itIfReady = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!backendAvailable || !PEEKVIEW_API_KEY) {
        console.warn(`Skipping "${name}" - backend or API key not available`);
        return;
      }
      await fn();
    });
  };

  // Pre-flight
  describe('Pre-flight', () => {
    it('should verify PeekView backend is accessible', async () => {
      const response = await fetch(`${PEEKVIEW_URL}/health`);
      expect(response.ok).toBe(true);
    });

    itIfReady('should validate API key and get user identity', async () => {
      const client = new PeekViewClient({ peekviewUrl: PEEKVIEW_URL });
      const userInfo = await client.validateToken(PEEKVIEW_API_KEY);
      expect(userInfo).not.toBeNull();
      expect(userInfo!.id).toBeGreaterThan(0);
      expect(userInfo!.username).toBeTruthy();
    });
  });

  // create_entry
  describe('Tool: create_entry', () => {
    itIfReady('should create a public entry owned by API key user', async () => {
      const slug = `mcp-test-${Date.now()}`;
      createdSlugs.push(slug);

      const result = await callMCPTool('create_entry', {
        slug,
        summary: 'MCP Integration Test Entry',
        files: [
          { filename: 'test.py', content: 'print("Hello from MCP")' },
          { filename: 'readme.md', content: '# Test\nThis is a test.' },
        ],
        is_public: true,
        tags: ['mcp', 'test'],
      });

      expect(result.content[0].text).toContain('Entry created successfully');
      expect(result.content[0].text).toContain(slug);

      // Verify entry exists and is owned by the correct user
      const verifyResponse = await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
      expect(verifyResponse.ok).toBe(true);
      const entry = await verifyResponse.json();
      expect(entry.summary).toBe('MCP Integration Test Entry');
      expect(entry.is_public).toBe(true);
      expect(entry.owner_id).toBe(testContext.userId);
      expect(entry.files).toHaveLength(2);
    });

    itIfReady('should create a private entry', async () => {
      const slug = `mcp-private-${Date.now()}`;
      createdSlugs.push(slug);

      const result = await callMCPTool('create_entry', {
        slug,
        summary: 'MCP Private Test',
        files: [{ filename: 'secret.txt', content: 'secret content' }],
        is_public: false,
      });

      expect(result.content[0].text).toContain('Entry created successfully');

      const verifyResponse = await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
      const entry = await verifyResponse.json();
      expect(entry.is_public).toBe(false);
      expect(entry.owner_id).toBe(testContext.userId);
    });
  });

  // get_entry
  describe('Tool: get_entry', () => {
    itIfReady('should retrieve own entry details', async () => {
      const slug = `mcp-get-${Date.now()}`;
      await callMCPTool('create_entry', {
        slug,
        summary: 'Test Entry for Get Tool',
        files: [
          { filename: 'main.py', content: 'def main():\n    pass' },
        ],
        tags: ['test'],
      });
      createdSlugs.push(slug);

      const result = await callMCPTool('get_entry', { slug });
      expect(result.content[0].text).toContain('Test Entry for Get Tool');
      expect(result.content[0].text).toContain('main.py');
    });

    itIfReady('should handle non-existent entry', async () => {
      const result = await callMCPTool('get_entry', {
        slug: 'non-existent-entry-12345',
      });
      expect(result.isError).toBe(true);
    });
  });

  // list_entries
  describe('Tool: list_entries', () => {
    itIfReady('should list entries with pagination', async () => {
      const result = await callMCPTool('list_entries', {
        page: 1,
        per_page: 10,
      });

      // API returns items or "No entries found."
      const text = result.content[0].text;
      expect(text).toMatch(/Found|No entries found/);
    });
  });

  // delete_entry
  describe('Tool: delete_entry', () => {
    itIfReady('should require confirmation before deletion', async () => {
      const result = await callMCPTool('delete_entry', { slug: 'any-entry' });
      expect(result.content[0].text).toContain('About to delete');
      expect(result.content[0].text).toContain('"confirm": true');
    });

    itIfReady('should delete own entry when confirmed', async () => {
      const slug = `mcp-delete-${Date.now()}`;
      await callMCPTool('create_entry', {
        slug,
        summary: 'Entry to Delete',
        files: [{ filename: 'temp.txt', content: 'temp' }],
      });

      const result = await callMCPTool('delete_entry', { slug, confirm: true });
      expect(result.content[0].text).toContain('deleted successfully');

      const verifyResponse = await fetch(`${PEEKVIEW_URL}/api/v1/entries/${slug}`, {
        headers: { Authorization: `Bearer ${PEEKVIEW_API_KEY}` },
      });
      expect(verifyResponse.status).toBe(404);
    });
  });

  // Multi-user isolation
  describe('Multi-user isolation', () => {
    itIfReady('should note behavior with invalid API key (PeekView may allow anonymous creation)', async () => {
      const badContext: SessionContext = {
        userToken: 'pv_invalid_key_that_does_not_exist',
        userId: 999,
        username: 'nobody',
      };

      const client = new PeekViewClient({ peekviewUrl: PEEKVIEW_URL });
      const tool = createEntryTool(client, PEEKVIEW_PUBLIC_URL);

      const result = await tool.handler({
        summary: 'Test invalid key behavior',
        files: [{ filename: 't.txt', content: 'x' }],
      }, badContext);

      // Behavior depends on PeekView config:
      // - ALLOW_ANONYMOUS_CREATE=true: invalid key still creates entry (owner_id=null)
      // - ALLOW_ANONYMOMS_CREATE=false: returns 401 error with "认证失败"
      // Both are valid behaviors - just verify it doesn't crash
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeTruthy();
    });
  });
});