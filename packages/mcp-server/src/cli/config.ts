#!/usr/bin/env node
/**
 * PeekView MCP Server CLI - Config commands
 */
import { Command } from 'commander';
import { saveConfigToFile, loadConfigFromFile } from '../config/file.js';
import type { ConfigFileData } from '../config/file.js';

export const configCommand = new Command('config')
  .description('Manage MCP Server configuration');

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

      if (!config) {
        console.log('No configuration file found.');
        console.log('Use "peekview-mcp config set" to create one.');
        return;
      }

      console.log('Configuration:');
      console.log('');

      // Print peekview section
      if (config.peekview) {
        console.log('peekview:');
        if (config.peekview.url) console.log(`  url: ${config.peekview.url}`);
        if (config.peekview.public_url) console.log(`  public_url: ${config.peekview.public_url}`);
        if (config.peekview.api_key) console.log(`  api_key: ***`); // Mask API key
        console.log('');
      }

      // Print server section
      if (config.server) {
        console.log('server:');
        if (config.server.host) console.log(`  host: ${config.server.host}`);
        if (config.server.port) console.log(`  port: ${config.server.port}`);
        if (config.server.cors_origins) console.log(`  cors_origins: ${config.server.cors_origins}`);
        console.log('');
      }

      // Print logging section
      if (config.logging) {
        console.log('logging:');
        if (config.logging.level) console.log(`  level: ${config.logging.level}`);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
