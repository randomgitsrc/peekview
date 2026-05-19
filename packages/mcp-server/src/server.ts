/**
 * MCP Server with SSE transport and connection authentication
 */
import cors from 'cors';
import express from 'express';
import { randomUUID } from 'crypto';
import { validate as validateUUID } from 'uuid';
import { pino } from 'pino';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { PeekViewClient } from './client.js';
import type { ServerConfig, ToolDefinition, ToolResult } from './types.js';

export function createMCPServer(tools: ToolDefinition[]): Server {
  const server = new Server(
    {
      name: 'peekview-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      } as any;
    }

    try {
      const result = await tool.handler(request.params.arguments);
      return result as any;
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      } as any;
    }
  });

  return server;
}

// Session store for SSE connections
// ⚠️ TD-MCP-01: Single-process memory structure, not shared across processes
//    Current single-server deployment is fine, future multi-instance needs Redis
const sessions = new Map<string, SSEServerTransport>();

export function createExpressApp(
  server: Server,
  config: ServerConfig,
  client: PeekViewClient
): express.Application {
  const app = express();

  // Initialize structured logging
  const logger = pino({
    level: config.logLevel,
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
  });

  // CORS — allow AI client origins
  const corsOrigins = process.env.MCP_CORS_ORIGINS?.split(',') || ['*'];
  app.use(cors({ origin: corsOrigins, methods: ['GET', 'POST'] }));
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    logger.info({ method: req.method, path: req.path }, 'request');
    next();
  });

  // SSE connection authentication middleware
  function authenticateSSE(req: express.Request, res: express.Response, next: express.NextFunction) {
    // Token from Authorization header only (production)
    // Query param allowed only in development (prevents token leakage to logs)
    const authHeader = req.headers.authorization?.replace('Bearer ', '');
    const queryToken = req.query.token as string;

    const token = process.env.NODE_ENV === 'production'
      ? authHeader
      : (authHeader || queryToken);

    if (!token || token !== config.mcpToken) {
      res.status(401).json({ error: 'Invalid or missing MCP_TOKEN' });
      return;
    }

    next();
  }

  // Health check with dependency probing
  app.get('/health', async (_req, res) => {
    // Check PeekView API availability
    const isPeekViewHealthy = await client.ping();

    if (!isPeekViewHealthy) {
      res.status(503).json({
        status: 'degraded',
        version: '0.1.0',
        peekview: 'unreachable'
      });
      return;
    }

    res.json({ status: 'ok', version: '0.1.0' });
  });

  // SSE endpoint — authenticated
  app.get('/sse', authenticateSSE, async (req, res) => {
    // Generate sessionId first, then construct transport with sessionId in endpoint
    // SDK will automatically push /messages?sessionId=<uuid> as endpoint to client
    const sessionId = randomUUID();
    const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);

    sessions.set(sessionId, transport);

    // Cleanup on close
    res.on('close', () => {
      sessions.delete(sessionId);
    });

    await server.connect(transport);
  });

  // Message endpoint — routes to correct session
  app.post('/messages', authenticateSSE, async (req, res) => {
    const sessionId = req.query.sessionId as string;

    // Validate sessionId format to prevent pollution attacks
    if (!sessionId || !validateUUID(sessionId)) {
      res.status(400).json({ error: 'Invalid sessionId format' });
      return;
    }

    const transport = sessions.get(sessionId);

    if (!transport) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await transport.handlePostMessage(req, res);
  });

  return app;
}
