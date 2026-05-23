#!/usr/bin/env node
/**
 * PeekView MCP Server CLI - Config commands
 */
import { Command } from 'commander';
import { saveConfigToFile, loadConfigFromFile } from '../config/file.js';
import type { ConfigFileData } from '../config/file.js';

export const configCommand = new Command('config')
  .description('Manage MCP Server configuration')
  .addHelpText('after', `
Available configuration keys:

  peekview.url          - PeekView API internal URL (required)
                          Example: http://localhost:8080

  peekview.public_url     - Public URL for user-facing links (required)
                          Example: https://peek.example.com

  server.port           - MCP Server port (default: 33333)

  server.host             - Bind address (default: 0.0.0.0)

  server.cors_origins     - CORS origins (default: *)

  logging.level           - Log level: debug|info|warn|error (default: info)

Config file location: ~/.peekview/mcp-config.yaml
`);

// config set <key> <value>
configCommand
  .command('set')
  .argument('<key>', 'Configuration key (e.g., peekview.url, server.port)')
  .argument('<value>', 'Configuration value')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    try {
      // Load existing config
      const existing = loadConfigFromFile() || {};
      const config: ConfigFileData = { ...existing };

      // Parse key path (e.g., "peekview.url" -> config.peekview.url)
      const parts = key.split('.');
      if (parts.length !== 2) {
        console.error(`Error: Invalid key format '${key}'. Use 'section.key' format.`);
        process.exit(1);
      }

      const [section, prop] = parts;

      // Type conversion
      let typedValue: string | number | boolean = value;
      if (value === 'true') typedValue = true;
      else if (value === 'false') typedValue = false;
      else if (/^\d+$/.test(value)) typedValue = parseInt(value, 10);

      // Ensure section exists
      if (!config[section]) {
        config[section] = {};
      }

      // Set value
      (config[section] as Record<string, unknown>)[prop] = typedValue;

      // Save
      saveConfigToFile(config);
      console.log(`✓ Set ${key} = ${value}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// config get <key>
configCommand
  .command('get')
  .argument('<key>', 'Configuration key (e.g., peekview.url)')
  .description('Get a configuration value')
  .action((key: string) => {
    try {
      const config = loadConfigFromFile();

      if (!config) {
        console.error('Error: No configuration file found. Run "peekview-mcp config set" first.');
        process.exit(1);
      }

      // Parse key path
      const parts = key.split('.');
      if (parts.length !== 2) {
        console.error(`Error: Invalid key format '${key}'. Use 'section.key' format.`);
        process.exit(1);
      }

      const [section, prop] = parts;
      const value = config[section]?.[prop as keyof typeof config[typeof section]];

      if (value === undefined) {
        console.log(`(not set)`);
      } else {
        console.log(value);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// config list
configCommand
  .command('list')
  .description('List all configuration values')
  .action(() => {
    try {
      const config = loadConfigFromFile();

      console.log('Configuration:');
      console.log('');

      // peekview section
      console.log('peekview:');
      console.log(`  url:          ${config?.peekview?.url || '(not set)'}  # 必填：PeekView API 内部地址`);
      console.log(`  public_url:   ${config?.peekview?.public_url || '(not set)'}  # 必填：公开访问地址`);
      console.log('');

      // server section
      console.log('server:');
      console.log(`  port:         ${config?.server?.port || 33333}  # MCP 服务端口`);
      console.log(`  host:         ${config?.server?.host || '0.0.0.0'}  # 绑定地址`);
      console.log(`  cors_origins: ${config?.server?.cors_origins || '*'}  # CORS 来源`);
      console.log('');

      // logging section
      console.log('logging:');
      console.log(`  level:        ${config?.logging?.level || 'info'}  # 日志级别 (debug/info/warn/error)`);
      console.log('');

      // Show available keys
      console.log('Available config keys:');
      console.log('  peekview.url, peekview.public_url');
      console.log('  server.port, server.host, server.cors_origins');
      console.log('  logging.level');
      console.log('');
      console.log(`Config file: ~/.peekview/mcp-config.yaml`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
