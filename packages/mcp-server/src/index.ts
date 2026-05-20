#!/usr/bin/env node
/**
 * PeekView MCP Server - Entry Point (v0.2.0 multi-user)
 */
import { createMCPServer, createExpressApp } from './server.js';
import { PeekViewClient } from './client.js';
import { loadConfig } from './config.js';
import { createTools } from './tools/index.js';

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