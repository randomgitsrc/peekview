/**
 * MCP Server Integration Tests
 *
 * Tests MCP Server tools with REAL PeekView backend (not mocked)
 * Requires PeekView backend running on PEEKVIEW_URL
 *
 * Run with: PEEKVIEW_URL=http://127.0.0.1:8888 PEEKVIEW_API_KEY=xxx npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PeekViewClient } from '../../src/client.js';
import { createEntryTool } from '../../src/tools/createEntry.js';
import { getEntryTool } from '../../src/tools/getEntry.js';
import { listEntriesTool } from '../../src/tools/listEntries.js';
import { deleteEntryTool } from '../../src/tools/deleteEntry.js';
import type { ServerConfig } from '../../src/types.js';

// Test configuration - uses environment variables
const TEST_CONFIG: ServerConfig = {
  peekviewUrl: process.env.PEEKVIEW_URL || 'http://127.0.0.1:8888',
  publicUrl: process.env.PEEKVIEW_PUBLIC_URL || 'http://127.0.0.1:8888',
  apiKey: process.env.PEEKVIEW_API_KEY || '',
  mcpToken: 'mcp_test_token_12345',
  port: 3333,
  host: '127.0.0.1',
  corsOrigins: ['*'],
  logLevel: 'info',
};

// Store created entries for cleanup
const createdSlugs: string[] = [];

/**
 * Call MCP tool directly (bypasses SSE, tests tool logic directly)
 */
async function callMCPTool(toolName: string, args: any): Promise<any> {
  // Create client connected to real backend
  const client = new PeekViewClient({
    peekviewUrl: TEST_CONFIG.peekviewUrl,
    apiKey: TEST_CONFIG.apiKey,
  });

  // Get the tool
  let tool;
  switch (toolName) {
    case 'create_entry':
      tool = createEntryTool(client, TEST_CONFIG);
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

  return await tool.handler(args);
}

describe('Integration: MCP Server + PeekView Backend', () => {
  // Skip all tests if backend is not available
  let backendAvailable = false;

  beforeAll(async () => {
    // Check if PeekView backend is accessible
    try {
      const response = await fetch(`${TEST_CONFIG.peekviewUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        console.log(`Connected to PeekView backend v${data.version} at ${TEST_CONFIG.peekviewUrl}`);
        backendAvailable = true;
      }
    } catch (error) {
      console.warn(`PeekView backend not available at ${TEST_CONFIG.peekviewUrl}`);
      console.warn('Skipping integration tests. Run with: make debug-start');
    }

    // Check API key
    if (!TEST_CONFIG.apiKey) {
      console.warn('Warning: PEEKVIEW_API_KEY not set, some tests may fail');
    }
  });

  afterAll(async () => {
    // Cleanup created entries
    console.log(`Cleaning up ${createdSlugs.length} test entries...`);
    for (const slug of createdSlugs) {
      try {
        await fetch(`${TEST_CONFIG.peekviewUrl}/api/v1/entries/${slug}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${TEST_CONFIG.apiKey}`,
          },
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  // Helper to skip tests if backend unavailable
  const itIfBackend = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!backendAvailable) {
        console.warn(`Skipping "${name}" - backend not available`);
        return;
      }
      if (!TEST_CONFIG.apiKey) {
        console.warn(`Skipping "${name}" - API key not set`);
        return;
      }
      await fn();
    });
  };

  // ========================================
  // Test Suite 1: Pre-flight Checks
  // ========================================
  describe('Pre-flight', () => {
    it('should verify PeekView backend is accessible', async () => {
      const response = await fetch(`${TEST_CONFIG.peekviewUrl}/health`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });
  });

  // ========================================
  // Test Suite 2: create_entry tool
  // ========================================
  describe('Tool: create_entry', () => {
    itIfBackend('should create a public entry via MCP', async () => {
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

      // Verify entry exists in backend
      const verifyResponse = await fetch(`${TEST_CONFIG.peekviewUrl}/api/v1/entries/${slug}`);
      expect(verifyResponse.ok).toBe(true);
      const entry = await verifyResponse.json();
      expect(entry.summary).toBe('MCP Integration Test Entry');
      expect(entry.is_public).toBe(true);
      expect(entry.files).toHaveLength(2);
    });

    itIfBackend('should create a private entry via MCP', async () => {
      const slug = `mcp-private-${Date.now()}`;
      createdSlugs.push(slug);

      const result = await callMCPTool('create_entry', {
        slug,
        summary: 'MCP Private Test',
        files: [{ filename: 'secret.txt', content: 'secret content' }],
        is_public: false,
      });

      expect(result.content[0].text).toContain('Entry created successfully');

      // Verify entry is private
      const verifyResponse = await fetch(`${TEST_CONFIG.peekviewUrl}/api/v1/entries/${slug}`);
      const entry = await verifyResponse.json();
      expect(entry.is_public).toBe(false);
    });

    itIfBackend('should handle empty files gracefully', async () => {
      const slug = `mcp-empty-${Date.now()}`;
      createdSlugs.push(slug);

      const result = await callMCPTool('create_entry', {
        slug,
        summary: 'Entry with no files',
        files: [],
      });

      expect(result.content[0].text).toContain('Entry created successfully');
    });
  });

  // ========================================
  // Test Suite 3: get_entry tool
  // ========================================
  describe('Tool: get_entry', () => {
    const testSlug = 'mcp-get-test';

    itIfBackend('should retrieve entry details', async () => {
      // Create test entry first
      if (!createdSlugs.includes(testSlug)) {
        await callMCPTool('create_entry', {
          slug: testSlug,
          summary: 'Test Entry for Get Tool',
          files: [
            { filename: 'main.py', content: 'def main():\n    pass' },
            { filename: 'utils.py', content: 'def helper():\n    return 42' },
          ],
          tags: ['test', 'integration'],
        });
        createdSlugs.push(testSlug);
      }

      const result = await callMCPTool('get_entry', {
        slug: testSlug,
      });

      expect(result.content[0].text).toContain('Test Entry for Get Tool');
      expect(result.content[0].text).toContain('Files (2)');
      expect(result.content[0].text).toContain('main.py');
      expect(result.content[0].text).toContain('utils.py');
    });

    itIfBackend('should handle non-existent entry', async () => {
      const result = await callMCPTool('get_entry', {
        slug: 'non-existent-entry-12345',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  // ========================================
  // Test Suite 4: list_entries tool
  // ========================================
  describe('Tool: list_entries', () => {
    itIfBackend('should list entries with pagination', async () => {
      const result = await callMCPTool('list_entries', {
        page: 1,
        per_page: 10,
      });

      expect(result.content[0].text).toContain('Found');
      expect(result.content[0].text).toContain('Page 1');
    });

    itIfBackend('should handle empty results', async () => {
      const result = await callMCPTool('list_entries', {
        search: 'xyz-non-existent-search-12345',
      });

      expect(result.content[0].text).toBe('No entries found.');
    });
  });

  // ========================================
  // Test Suite 5: delete_entry tool
  // ========================================
  describe('Tool: delete_entry', () => {
    itIfBackend('should require confirmation before deletion', async () => {
      const result = await callMCPTool('delete_entry', {
        slug: 'any-entry',
      });

      expect(result.content[0].text).toContain('About to delete');
      expect(result.content[0].text).toContain('"confirm": true');
    });

    itIfBackend('should delete entry when confirmed', async () => {
      // Create entry to delete
      const slug = `mcp-delete-${Date.now()}`;
      await callMCPTool('create_entry', {
        slug,
        summary: 'Entry to Delete',
        files: [{ filename: 'temp.txt', content: 'temp' }],
      });
      createdSlugs.push(slug);

      // Delete it
      const result = await callMCPTool('delete_entry', {
        slug,
        confirm: true,
      });

      expect(result.content[0].text).toContain('deleted successfully');

      // Verify it's gone
      const verifyResponse = await fetch(`${TEST_CONFIG.peekviewUrl}/api/v1/entries/${slug}`);
      expect(verifyResponse.status).toBe(404);
    });

    itIfBackend('should handle deletion of non-existent entry', async () => {
      const result = await callMCPTool('delete_entry', {
        slug: 'non-existent-entry-xyz',
        confirm: true,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });
});
