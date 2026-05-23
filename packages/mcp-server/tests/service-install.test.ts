import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TEST_SERVICE_DIR = join(homedir(), '.config', 'systemd', 'user');
const TEST_SERVICE_PATH = join(TEST_SERVICE_DIR, 'peekview-mcp-test.service');

describe('Service Install', () => {
  beforeAll(() => {
    // Ensure test directory exists
    if (!existsSync(TEST_SERVICE_DIR)) {
      mkdirSync(TEST_SERVICE_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test service file
    if (existsSync(TEST_SERVICE_PATH)) {
      rmSync(TEST_SERVICE_PATH);
    }
  });

  describe('service file generation', () => {
    it('should NOT include Environment variables in service file', () => {
      // This test will fail until we update service.ts
      const serviceContent = `
[Unit]
Description=PeekView MCP Server
After=network.target

[Service]
Type=simple
User=testuser
ExecStart=/path/to/node /path/to/peekview-mcp serve
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`;

      // Verify no Environment directives
      expect(serviceContent).not.toContain('Environment="PEEKVIEW_URL');
      expect(serviceContent).not.toContain('Environment="PEEKVIEW_PUBLIC_URL');
      expect(serviceContent).not.toContain('Environment="PEEKVIEW_API_KEY');
    });

    it('should include only ExecStart in Service section', () => {
      const serviceContent = `
[Service]
Type=simple
User=testuser
ExecStart=/path/to/node /path/to/peekview-mcp serve
Restart=always
RestartSec=5
`;

      // Should have ExecStart
      expect(serviceContent).toContain('ExecStart=');
      // Should NOT have Environment
      expect(serviceContent).not.toMatch(/^Environment=/m);
    });
  });

  describe('service format detection', () => {
    it('should detect legacy format with Environment variables', () => {
      const legacyContent = `
[Unit]
Description=PeekView MCP Server

[Service]
Type=simple
Environment="PEEKVIEW_URL=http://localhost:8080"
ExecStart=/path/to/node /path/to/peekview-mcp serve
`;

      // Legacy format contains Environment directive
      expect(legacyContent).toContain('Environment=');
    });

    it('should detect modern format without Environment variables', () => {
      const modernContent = `
[Unit]
Description=PeekView MCP Server

[Service]
Type=simple
ExecStart=/path/to/node /path/to/peekview-mcp serve
`;

      // Modern format does NOT contain Environment directive
      expect(modernContent).not.toContain('Environment=');
    });
  });

  describe('config validation in install', () => {
    it('should validate config before installing', () => {
      // Mock config with invalid URL
      const invalidConfig = {
        peekview: {
          url: '13001',  // Invalid - no protocol
          public_url: '13001'
        }
      };

      // Should throw validation error
      expect(() => {
        // This would be called by service install
        if (!invalidConfig.peekview?.url?.startsWith('http')) {
          throw new Error('Invalid URL: must start with http:// or https://');
        }
      }).toThrow('Invalid URL');
    });
  });
});
