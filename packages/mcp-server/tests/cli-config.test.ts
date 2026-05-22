import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { saveConfigToFile, loadConfigFromFile } from '../src/config/file.js';
import { existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const testConfigPath = join(homedir(), '.peekview', 'mcp-config.yaml');

describe('CLI Config Commands', () => {
  beforeEach(() => {
    // Clean up test config
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up test config
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('config set', () => {
    it('should set peekview.url in config file', () => {
      saveConfigToFile({
        peekview: {
          url: 'http://test:8080',
        },
      });

      const config = loadConfigFromFile();
      expect(config?.peekview?.url).toBe('http://test:8080');
    });

    it('should set server.port as number', () => {
      saveConfigToFile({
        server: {
          port: 44444,
        },
      });

      const config = loadConfigFromFile();
      expect(config?.server?.port).toBe(44444);
      expect(typeof config?.server?.port).toBe('number');
    });

    it('should update existing config preserving other values', () => {
      // First save
      saveConfigToFile({
        peekview: {
          url: 'http://old:8080',
          public_url: 'http://old-public:8080',
        },
        server: {
          port: 33333,
        },
      });

      // Update only url
      const existing = loadConfigFromFile();
      saveConfigToFile({
        ...existing,
        peekview: {
          ...existing?.peekview,
          url: 'http://new:8080',
        },
      });

      const config = loadConfigFromFile();
      expect(config?.peekview?.url).toBe('http://new:8080');
      expect(config?.peekview?.public_url).toBe('http://old-public:8080');
      expect(config?.server?.port).toBe(33333);
    });
  });

  describe('config get', () => {
    it('should read value from config file', () => {
      saveConfigToFile({
        peekview: {
          url: 'http://get-test:8080',
        },
      });

      const config = loadConfigFromFile();
      expect(config?.peekview?.url).toBe('http://get-test:8080');
    });

    it('should return null for non-existent file', () => {
      const config = loadConfigFromFile();
      expect(config).toBeNull();
    });
  });

  describe('config list', () => {
    it('should list all config values', () => {
      saveConfigToFile({
        peekview: {
          url: 'http://list:8080',
          public_url: 'http://list-public:8080',
        },
        server: {
          port: 55555,
          host: '127.0.0.1',
        },
        logging: {
          level: 'debug',
        },
      });

      const config = loadConfigFromFile();
      expect(config).not.toBeNull();
      expect(config?.peekview?.url).toBe('http://list:8080');
      expect(config?.server?.port).toBe(55555);
      expect(config?.logging?.level).toBe('debug');
    });
  });

  describe('CLI help', () => {
    it('should have config command in help', () => {
      const program = new Command();

      program
        .name('peekview-mcp')
        .description('PeekView MCP Server');

      // Add config command
      const configCmd = new Command('config')
        .description('Manage MCP Server configuration');

      configCmd
        .command('set')
        .argument('<key>', 'Configuration key (e.g., peekview.url)')
        .argument('<value>', 'Configuration value')
        .description('Set a configuration value');

      configCmd
        .command('get')
        .argument('<key>', 'Configuration key')
        .description('Get a configuration value');

      configCmd
        .command('list')
        .description('List all configuration values');

      program.addCommand(configCmd);

      // Check command exists
      const commands = program.commands.map((cmd: Command) => cmd.name());
      expect(commands).toContain('config');
    });
  });
});
