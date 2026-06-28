#!/usr/bin/env node
/**
 * PeekView MCP Server - Entry Point
 */
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createMCPServer, createExpressApp } from './server.js';
import { PeekViewClient } from './client.js';
import { loadConfig } from './config.js';
import { createTools } from './tools/index.js';
import { configCommand } from './cli/config.js';
import { serviceCommand } from './cli/service.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get version from package.json
function getVersion(): string {
  try {
    const pkgPath = resolve(__dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.9.2';
  }
}

// Create main CLI program
const program = new Command();

program
  .name('peekview-mcp')
  .description('PeekView MCP Server - AI Agent integration')
  .version(getVersion(), '-v, --version')
  .addHelpText('after', `
Quick start:
  1. Configure:  peekview-mcp config set peekview.url http://localhost:8080
  2. Start:      peekview-mcp serve
  3. Service:    peekview-mcp service install --user

Commands:
  config    Manage configuration (set/get/list)
  serve     Start the MCP Server
  service   Manage systemd service (install/start/stop/status/uninstall)
  version   Show version
  uninstall Show uninstall instructions

For detailed help on a command:
  peekview-mcp config --help
  peekview-mcp serve --help
  peekview-mcp service --help
`);

// Global help option
program.helpOption('-h, --help', 'Show help');

// serve command
const serveCommand = new Command('serve')
  .description('Start the MCP Server')
  .option('--port <port>', 'Server port (overrides config)')
  .option('--host <host>', 'Server host (overrides config)')
  .action(async (options: { port?: string; host?: string }) => {
    try {
      // Load config (env > file > default)
      const config = loadConfig();

      // Override with CLI options
      const port = options.port ? parseInt(options.port, 10) : config.port;
      const host = options.host || config.host;

      // Create client and server
      const client = new PeekViewClient({ peekviewUrl: config.peekviewUrl });
      const tools = createTools(client, config);
      const app = createExpressApp(tools, {
        ...config,
        port,
        host,
      }, client);

      // Start server
      await new Promise<void>((resolve, reject) => {
        const httpServer = app.listen(port, host, () => {
          console.log(`✓ MCP Server running on http://${host}:${port}`);
          console.log(`  Public URL: ${config.publicUrl}`);
          console.log(`  PeekView: ${config.peekviewUrl}`);
          resolve();
        });

        httpServer.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Add serve epilog with examples
serveCommand.addHelpText('after', `
Examples:
  peekview-mcp serve                    # Start with config file
  peekview-mcp serve --port 33334       # Start with custom port
  peekview-mcp serve --host 127.0.0.1   # Start on localhost only

Configuration priority (highest to lowest):
  1. CLI options (--port, --host)
  2. Environment variables (PEEKVIEW_URL, MCP_PORT, etc.)
  3. Config file (~/.peekview/mcp-config.yaml)
  4. Default values

Config file example:
  peekview-mcp config set peekview.url http://localhost:8080
  peekview-mcp config set peekview.public_url https://peek.example.com
  peekview-mcp config set server.port 33333
  peekview-mcp config list

Health check:
  curl http://localhost:33333/health
`);

// Add subcommands
program.addCommand(serveCommand);
program.addCommand(configCommand);
program.addCommand(serviceCommand);

// version command (alias)
program
  .command('version')
  .description('Show version')
  .action(() => {
    console.log(getVersion());
  });

// uninstall command
program
  .command('uninstall')
  .description('Show uninstall instructions')
  .action(() => {
    console.log(`
=== Uninstall PeekView MCP Server ===

To uninstall, run:

  npm uninstall -g @peekview/mcp-server

This will remove:
  - The peekview-mcp command
  - MCP Server package files

Your data in PeekView server will NOT be affected.

=== Optional Cleanup ===

Remove config file:
  rm ~/.peekview/mcp-config.yaml

Stop systemd service (if configured):
  peekview-mcp service stop
  peekview-mcp service uninstall --user

Remove environment variables from ~/.bashrc or ~/.profile:
  - PEEKVIEW_URL
  - PEEKVIEW_PUBLIC_URL
  - PEEKVIEW_API_KEY
`);
  });

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

// Parse and execute
program.parseAsync();
