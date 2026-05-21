#!/usr/bin/env node
/**
 * PeekView MCP Server - Entry Point (v0.2.1 multi-user)
 */
import { createMCPServer, createExpressApp } from './server.js';
import { PeekViewClient } from './client.js';
import { loadConfig } from './config.js';
import { createTools } from './tools/index.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Handle CLI flags before loading config
const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-v')) {
  try {
    const pkgPath = resolve(import.meta.dirname, '../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  } catch {
    console.log('0.2.1');
    process.exit(0);
  }
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
PeekView MCP Server - AI Agent integration

Usage:
  peekview-mcp [options]
  peekview-mcp serve [options]

Environment Variables:
  PEEKVIEW_URL        PeekView API base URL (required)
  PEEKVIEW_PUBLIC_URL PeekView public URL for links (required)
  MCP_PORT            Server port (default: 33333)
  MCP_HOST            Server host (default: 0.0.0.0)
  LOG_LEVEL           Log level (default: info)

Options:
  -v, --version       Show version
  -h, --help          Show help
  uninstall           Show uninstall instructions

Example:
  export PEEKVIEW_URL=https://api.example.com
  export PEEKVIEW_PUBLIC_URL=https://app.example.com
  peekview-mcp

Uninstall:
  npm uninstall -g @peekview/mcp-server
`);
  process.exit(0);
}

if (args.includes('uninstall')) {
  console.log(`
=== Uninstall PeekView MCP Server ===

To uninstall, run:

  npm uninstall -g @peekview/mcp-server

This will remove:
  - The peekview-mcp command
  - MCP Server package files

Your data in PeekView server will NOT be affected.

=== Optional Cleanup ===

Remove environment variables from ~/.bashrc or ~/.profile:
  - PEEKVIEW_URL
  - PEEKVIEW_PUBLIC_URL
  - PEEKVIEW_API_KEY

Stop systemd service (if configured):
  sudo systemctl stop peekview-mcp
  sudo systemctl disable peekview-mcp
`);
  process.exit(0);
}

async function main() {
  const config = loadConfig();

  console.log(`Starting PeekView MCP Server...`);
  console.log(`PeekView URL: ${config.peekviewUrl}`);
  console.log(`Public URL: ${config.publicUrl}`);
  console.log(`Listening on: ${config.host}:${config.port}`);

  const client = new PeekViewClient({ peekviewUrl: config.peekviewUrl });
  const tools = createTools(client, config.publicUrl);

  const mcpServer = createMCPServer(tools);
  const app = createExpressApp(mcpServer, config, client);

  app.listen(config.port, config.host, () => {
    console.log(`✓ MCP Server ready at http://${config.host}:${config.port}`);
    console.log(`  SSE endpoint: http://${config.host}:${config.port}/sse`);
    console.log(`  Health check: http://${config.host}:${config.port}/health`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});