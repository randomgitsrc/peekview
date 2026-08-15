import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpServer = path.resolve(__dirname, '../../../../../packages/mcp-server');

export default {
  resolve: {
    alias: {
      zod: path.join(mcpServer, 'node_modules/zod/index.js'),
      pino: path.join(mcpServer, 'node_modules/pino/pino.js'),
    },
  },
  test: {
    environment: 'node',
    include: [path.resolve(__dirname, 'verify-tpv0092.test.ts')],
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: [],
    globalSetup: [],
    hookTimeout: 30000,
  },
};
