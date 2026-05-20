/**
 * MCP Server with SSE transport and user token passthrough
 */
import cors from 'cors';
import express from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { validate as validateUUID } from 'uuid';
import { pino } from 'pino';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { PeekViewClient } from './client.js';
import type { ServerConfig, SessionContext, SessionInfo, ToolDefinition, ToolResult } from './types.js';

export function createMCPServer(tools: ToolDefinition[]): Server {
  const server = new Server(
    {
      name: 'peekview-mcp-server',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const ctx = sessionContext.getStore();
    if (!ctx) {
      return {
        content: [{ type: 'text', text: 'No session context' }],
        isError: true,
      } as any;
    }

    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      } as any;
    }

    try {
      const result = await tool.handler(request.params.arguments, ctx);
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

// AsyncLocalStorage for session context propagation
const sessionContext = new AsyncLocalStorage<SessionContext>();

// Session store
const sessions = new Map<string, SessionInfo>();

export function createExpressApp(
  server: Server,
  config: ServerConfig,
  client: PeekViewClient
): express.Application {
  const app = express();

  const logger = pino({
    level: config.logLevel,
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
  });

  const corsOrigins = process.env.MCP_CORS_ORIGINS?.split(',') || config.corsOrigins;
  app.use(cors({
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  }));

  app.use((req, res, next) => {
    logger.info({ method: req.method, path: req.path }, 'request');
    next();
  });

  // SSE endpoint - pv_ prefix check + validateToken
  app.get('/sse', async (req, res) => {
    const authHeader = req.headers.authorization?.replace('Bearer ', '') ?? '';

    // Must be pv_ prefix (reject JWT)
    if (!authHeader.startsWith('pv_')) {
      res.status(401).json({ error: 'Only PeekView API Key (pv_ prefix) is supported' });
      return;
    }

    // Validate token with PeekView
    const userInfo = await client.validateToken(authHeader);
    if (!userInfo) {
      res.status(401).json({ error: 'Invalid or expired API Key' });
      return;
    }

    // Establish SSE session
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;

    sessions.set(sessionId, {
      transport,
      userToken: authHeader,
      userId: userInfo.id,
      username: userInfo.username,
    });

    res.on('close', () => {
      sessions.delete(sessionId);
    });

    await server.connect(transport);
  });

  // Message endpoint - session-based auth (no Authorization header from client)
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId || !validateUUID(sessionId)) {
      res.status(400).json({ error: 'Invalid sessionId format' });
      return;
    }

    const sessionInfo = sessions.get(sessionId);
    if (!sessionInfo) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Run in AsyncLocalStorage context for tool handlers
    sessionContext.run(
      { userToken: sessionInfo.userToken, userId: sessionInfo.userId, username: sessionInfo.username },
      () => sessionInfo.transport.handlePostMessage(req, res)
    );
  });

  // Health check
  app.get('/health', async (_req, res) => {
    const isPeekViewHealthy = await client.ping();

    if (!isPeekViewHealthy) {
      res.status(503).json({
        status: 'degraded',
        version: '0.2.0',
        peekview: 'unreachable'
      });
      return;
    }

    res.json({ status: 'ok', version: '0.2.0' });
  });

  return app;
}