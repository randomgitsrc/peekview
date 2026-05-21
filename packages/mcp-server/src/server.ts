/**
 * MCP Server with SSE transport and user token passthrough
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
import type { ServerConfig, SessionContext, SessionInfo, ToolDefinition } from './types.js';
import { toSDKResult } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// Module-level logger (available in tool handlers and Express routes)
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});

export function createMCPServer(tools: ToolDefinition[]): Server {
  const server = new Server(
    {
      name: 'peekview-mcp-server',
      version,
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
      logger.error('No session context in CallToolRequest');
      return toSDKResult({
        content: [{ type: 'text', text: 'No session context' }],
        isError: true,
      });
    }

    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      logger.warn({ tool: request.params.name }, 'Unknown tool requested');
      return toSDKResult({
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      });
    }

    try {
      const result = await tool.handler(request.params.arguments, ctx);
      return toSDKResult(result);
    } catch (error) {
      logger.error({ tool: request.params.name, error }, 'tool execution failed');
      return toSDKResult({
        content: [{
          type: 'text',
          text: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      });
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
    let userInfo: { id: number; username: string } | null;
    try {
      userInfo = await client.validateToken(authHeader);
      if (!userInfo) {
        res.status(401).json({ error: 'Invalid or expired API Key' });
        return;
      }
    } catch (e) {
      // Timeout or connection error → 503, not 401
      logger.warn({ error: e }, 'PeekView unreachable during SSE auth');
      res.status(503).json({ error: 'PeekView unreachable, please try again later' });
      return;
    }

    // SDK auto-generates sessionId and appends ?sessionId= to the endpoint event.
    // Passing just '/messages' (not '/messages?sessionId=...') avoids double sessionId.
    // Verified: SSEServerTransport.sessionId is a getter returning SDK-generated UUID.
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;

    sessions.set(sessionId, {
      transport,
      userToken: authHeader,
      userId: userInfo!.id,
      username: userInfo!.username,
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
        version,
        peekview: 'unreachable'
      });
      return;
    }

    res.json({ status: 'ok', version });
  });

  return app;
}