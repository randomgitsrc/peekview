import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfigFromFile, saveConfigToFile, CONFIG_FILE_PATH } from '../src/config/file.js';
import { loadConfig } from '../src/config.js';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Config File', () => {
  const originalEnv = process.env;
  const testConfigDir = `${process.env.HOME}/.peekview`;
  const testConfigPath = `${testConfigDir}/mcp-config.yaml`;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clean up test config file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up test config file
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  describe('loadConfigFromFile', () => {
    it('should return null when config file does not exist', () => {
      const config = loadConfigFromFile();
      expect(config).toBeNull();
    });

    it('should load config from file when it exists', () => {
      // First create a config file
      const testConfig = {
        peekview: {
          url: 'http://file-config:8080',
          public_url: 'http://public:8080',
        },
        server: {
          port: 44444,
          host: '127.0.0.1',
        },
        logging: {
          level: 'debug',
        },
      };
      saveConfigToFile(testConfig);

      const config = loadConfigFromFile();
      expect(config).not.toBeNull();
      expect(config?.peekview?.url).toBe('http://file-config:8080');
      expect(config?.peekview?.public_url).toBe('http://public:8080');
      expect(config?.server?.port).toBe(44444);
      expect(config?.server?.host).toBe('127.0.0.1');
      expect(config?.logging?.level).toBe('debug');
    });

    it('should handle partial config in file', () => {
      const testConfig = {
        server: {
          port: 55555,
        },
      };
      saveConfigToFile(testConfig);

      const config = loadConfigFromFile();
      expect(config).not.toBeNull();
      expect(config?.server?.port).toBe(55555);
      // Other values should be undefined
      expect(config?.peekview?.url).toBeUndefined();
    });
  });

  describe('saveConfigToFile', () => {
    it('should create config file with correct structure', () => {
      const testConfig = {
        peekview: {
          url: 'http://test:8080',
          public_url: 'http://public:8080',
        },
      };

      saveConfigToFile(testConfig);

      // Verify file exists
      expect(existsSync(testConfigPath)).toBe(true);

      // Verify it can be loaded back
      const loaded = loadConfigFromFile();
      expect(loaded?.peekview?.url).toBe('http://test:8080');
      expect(loaded?.peekview?.public_url).toBe('http://public:8080');
    });

    it('should create .peekview directory if not exists', () => {
      const testConfig = { server: { port: 12345 } };
      saveConfigToFile(testConfig);

      expect(existsSync(testConfigDir)).toBe(true);
      expect(existsSync(testConfigPath)).toBe(true);
    });
  });

  describe('CONFIG_FILE_PATH', () => {
    it('should point to ~/.peekview/mcp-config.yaml', () => {
      expect(CONFIG_FILE_PATH).toContain('.peekview/mcp-config.yaml');
    });
  });
});
