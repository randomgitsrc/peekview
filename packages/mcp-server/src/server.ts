/**
 * MCP Server with Streamable HTTP transport and user token passthrough
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';
import express from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { pino } from 'pino';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { PeekViewClient } from './client.js';
import type { ServerConfig, SessionContext, SessionInfo, ToolDefinition } from './types.js';
import { toSDKResult } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

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

const sessionContext = new AsyncLocalStorage<SessionContext>();

const sessions = new Map<string, SessionInfo>();

const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;

let cleanupStarted = false;

function startSessionCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of sessions) {
      if (now - entry.lastActivity > SESSION_IDLE_TIMEOUT) {
        entry.transport.close?.();
        sessions.delete(id);
        logger.info({ sessionId: id }, 'Session idle timeout, cleaned up');
      }
    }
  }, CLEANUP_INTERVAL);
  timer.unref();
}

async function authenticate(
  req: express.Request,
  client: PeekViewClient
): Promise<
  { ok: true; userId: number; username: string; userToken: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization?.replace('Bearer ', '') ?? '';

  if (!authHeader.startsWith('pv_')) {
    return { ok: false, status: 401, error: 'Only PeekView API Key (pv_ prefix) is supported' };
  }

  try {
    const userInfo = await client.validateToken(authHeader);
    if (!userInfo) {
      return { ok: false, status: 401, error: 'Invalid or expired API Key' };
    }
    return { ok: true, userId: userInfo.id, username: userInfo.username, userToken: authHeader };
  } catch {
    logger.warn('PeekView unreachable during auth');
    return { ok: false, status: 503, error: 'PeekView unreachable, please try again later' };
  }
}

function isValidOrigin(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;

  const alwaysAllowed = [
    'http://localhost',
    'http://127.0.0.1',
    'https://localhost',
    'https://127.0.0.1',
  ];

  if (alwaysAllowed.some(allowed => origin.startsWith(allowed))) {
    return true;
  }

  // DNS rebinding protection: even with CORS *, validate explicit origins
  // Only allow origins that are explicitly listed (not wildcard)
  return allowedOrigins.some(allowed => {
    if (allowed === '*') return false;
    return origin === allowed || origin.startsWith(allowed);
  });
}

export function createExpressApp(
  tools: ToolDefinition[],
  config: ServerConfig,
  client: PeekViewClient
): express.Application {
  const app = express();

  startSessionCleanup();

  const corsOrigins = process.env.MCP_CORS_ORIGINS?.split(',') || config.corsOrigins;
  app.use(cors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'mcp-session-id'],
    exposedHeaders: ['mcp-session-id'],
  }));

  app.use(express.json());

  app.use((req, res, next) => {
    logger.info({ method: req.method, path: req.path }, 'request');
    next();
  });

  app.post('/mcp', async (req, res) => {
    // Origin check (DNS rebinding protection)
    const origin = req.headers.origin;
    if (!isValidOrigin(origin, corsOrigins)) {
      res.status(403).json({ error: 'Invalid Origin header' });
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Existing session: reuse transport
    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      entry.lastActivity = Date.now();
      return sessionContext.run(
        { userToken: entry.userToken, userId: entry.userId, username: entry.username },
        () => entry.transport.handleRequest(req, res, req.body)
      );
    }

    // New session: must be initialize request
    if (!sessionId && isInitializeRequest(req.body)) {
      const auth = await authenticate(req, client);
      if (!auth.ok) {
        res.status(auth.status).json({ error: auth.error });
        return;
      }

      const ctx: SessionContext = {
        userToken: auth.userToken,
        userId: auth.userId,
        username: auth.username,
      };

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          sessions.delete(transport.sessionId);
          logger.info({ sessionId: transport.sessionId }, 'Session closed');
        }
      };

      const server = createMCPServer(tools);
      await server.connect(transport);

      // Handle the initialize request within context
      // StreamableHTTPServerTransport sets sessionId during handleRequest for initialize
      await sessionContext.run(ctx, () =>
        transport.handleRequest(req, res, req.body)
      );

      // Register session after handleRequest (sessionId is set by SDK during initialize processing)
      if (transport.sessionId) {
        sessions.set(transport.sessionId, {
          transport,
          server,
          ...ctx,
          lastActivity: Date.now(),
        });
      } else {
        logger.error('Session not registered: transport.sessionId is empty after initialize');
      }

      return;
    }

    // Session ID provided but session not found — expired or server restarted
    // Per MCP spec: server MUST respond with 404 when session is terminated,
    // client MUST re-initialize upon receiving 404.
    if (sessionId && !sessions.has(sessionId)) {
      res.status(404).json({ error: 'Session not found or expired. Client must re-initialize.' });
      return;
    }

    // No session ID and not an initialize request — protocol error
    if (!sessionId && !isInitializeRequest(req.body)) {
      res.status(400).json({ error: 'No valid session or not an initialize request' });
      return;
    }
  });

  // GET /mcp — Server-initiated notifications not supported
  // This endpoint is intentionally not implemented; all requests use POST /mcp with enableJsonResponse
  app.get('/mcp', async (_req, res) => {
    res.status(405).json({ error: 'Server-initiated notifications not supported. Use POST /mcp for all client requests.' });
  });

  // DELETE /mcp — session termination
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId && sessions.has(sessionId)) {
      const entry = sessions.get(sessionId)!;
      try {
        await entry.transport.close();
      } catch (e) {
        logger.warn({ sessionId, error: e }, 'Error closing transport during DELETE');
      }
      sessions.delete(sessionId);
      logger.info({ sessionId }, 'Session terminated via DELETE');
      res.status(200).json({ ok: true });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  });

  // Health check
  app.get('/health', async (_req, res) => {
    const isPeekViewHealthy = await client.ping();

    const healthResponse: {
      status: string;
      version: string;
      peekview: string;
      config: {
        source: string;
        path: string | null;
        peekview_url: string;
        public_url: string;
        api_key_configured: boolean;
      };
      peekview_error?: string;
    } = {
      status: isPeekViewHealthy ? 'ok' : 'degraded',
      version,
      peekview: isPeekViewHealthy ? 'ok' : 'unreachable',
      config: {
        source: config.configSource,
        path: config.configPath,
        peekview_url: config.peekviewUrl || '',
        public_url: config.publicUrl || '',
        api_key_configured: !!config.apiKey,
      }
    };

    if (!isPeekViewHealthy) {
      healthResponse.peekview_error = `Failed to connect to PeekView at ${config.peekviewUrl}`;
      res.status(503).json(healthResponse);
      return;
    }

    res.json(healthResponse);
  });

  return app;
}

export { sessionContext, sessions, logger };
