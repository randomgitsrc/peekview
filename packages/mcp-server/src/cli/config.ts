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

  peekview.url          - MCP Server 调用 PeekView API 的地址（可以是内网或公网，只需要 MCP Server 能访问即可）
                          示例: http://localhost:8080, http://10.0.0.5:8080, https://peek.example.com

  peekview.public_url   - 用户浏览器查看条目的公开地址（必须是用户浏览器能访问的地址）
                          示例: https://peek.example.com, http://192.168.1.100:8080

  server.port           - MCP Server 端口 (default: 33333)

  server.host             - 绑定地址 (default: 0.0.0.0)

  server.cors_origins     - CORS 来源 (default: *)

  logging.level           - 日志级别: debug|info|warn|error (default: info)

Config file location: ~/.peekview/mcp-config.yaml

注意: peekview.url 和 peekview.public_url 可以是不同的地址：
  - peekview.url: 只需要 MCP Server 能访问 PeekView 即可（内网地址也可以）
  - peekview.public_url: 必须能被用户的浏览器访问（如果用户在外网，需要用公网地址）
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
