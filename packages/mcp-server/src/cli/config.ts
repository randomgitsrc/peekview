#!/usr/bin/env node
/**
 * PeekView MCP Server CLI - Config commands
 */
import { Command } from 'commander';
import { saveConfigToFile, loadConfigFromFile } from '../config/file.js';
import type { ConfigFileData } from '../config/file.js';

const DEFAULT_CONFIG = {
  server: { port: 33333, host: '0.0.0.0', cors_origins: '*', mode: 'remote' },
  logging: { level: 'info' },
} as const;

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

  server.mode             - 部署模式: remote|local (default: remote)

  server.allowed_paths    - local 模式显式路径白名单；配置后覆盖默认 cwd+系统临时目录
  server.trust_all_paths  - 危险选项：local 模式跳过路径白名单，仅 best-effort 敏感路径保护 (default: false)

  logging.level           - 日志级别: debug|info|warn|error (default: info)

Config file location: ~/.peekview/mcp-config.yaml

local 模式 publish_files 路径规则：
  - 默认允许 cwd + 系统临时目录（如 Linux /tmp）
  - 不默认允许 $HOME
  - 如需额外目录：peekview-mcp config allowed_path add /path/to/dir
  - 完全本机自用：peekview-mcp config set server.trust_all_paths true（危险；denylist 仅 best-effort）
  - 修改配置后需重启 service：peekview-mcp service restart

注意: peekview.url 和 peekview.public_url 可以是不同的地址：
  - peekview.url: 只需要 MCP Server 能访问 PeekView 即可（内网地址也可以）
  - peekview.public_url: 必须能被用户的浏览器访问（如果用户在外网，需要用公网地址）
`);

// ── config set <key> <value> ────────────────────────────────────────────────
configCommand
  .command('set')
  .argument('<key>', 'Configuration key (e.g., peekview.url, server.port)')
  .argument('<value>', 'Configuration value')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    try {
      const existing = loadConfigFromFile() || {};
      const config: ConfigFileData = { ...existing };

      const parts = key.split('.');
      if (parts.length !== 2) {
        console.error(`Error: Invalid key format '${key}'. Use 'section.key' format.`);
        process.exit(1);
      }

      const [section, prop] = parts;

      let typedValue: string | number | boolean | string[] = value;
      if (section === 'server' && prop === 'allowed_paths') {
        typedValue = value.split(':').filter((p) => p.length > 0);
      } else if (value === 'true') typedValue = true;
      else if (value === 'false') typedValue = false;
      else if (/^\d+$/.test(value)) typedValue = parseInt(value, 10);

      if (!config[section]) {
        config[section] = {};
      }
      (config[section] as Record<string, unknown>)[prop] = typedValue;

      saveConfigToFile(config);
      console.log(`✓ Set ${key} = ${value}`);
      console.log(`  Config file: ~/.peekview/mcp-config.yaml`);
      console.log(`  ⚠ Restart service to apply: peekview-mcp service restart`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ── config get <key> ────────────────────────────────────────────────────────
configCommand
  .command('get')
  .argument('<key>', 'Configuration key (e.g., peekview.url)')
  .description('Get a configuration value')
  .action((key: string) => {
    try {
      const config = loadConfigFromFile();
      const parts = key.split('.');

      if (parts.length !== 2) {
        console.error(`Error: Invalid key format '${key}'. Use 'section.key' format.`);
        process.exit(1);
      }

      const [section, prop] = parts;
      const value = config?.[section]?.[prop as keyof typeof config[typeof section]];

      if (value === undefined || value === null) {
        const defaults = DEFAULT_CONFIG as Record<string, Record<string, unknown>>;
        const defaultVal = defaults[section]?.[prop];
        if (defaultVal !== undefined) {
          console.log(`${defaultVal} (default)`);
        } else {
          console.log('(not set)');
        }
      } else {
        console.log(value);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ── config list ─────────────────────────────────────────────────────────────
configCommand
  .command('list')
  .description('List all configuration values')
  .action(() => {
    try {
      const config = loadConfigFromFile();

      console.log('Configuration:');
      console.log('');

      console.log('peekview:');
      console.log(`  url:          ${config?.peekview?.url || '(not set)'}  # 必填：PeekView API 内部地址`);
      console.log(`  public_url:   ${config?.peekview?.public_url || '(not set)'}  # 必填：公开访问地址`);
      console.log('');

      console.log('server:');
      console.log(`  port:         ${config?.server?.port ?? DEFAULT_CONFIG.server.port}  # MCP 服务端口`);
      console.log(`  host:         ${config?.server?.host ?? DEFAULT_CONFIG.server.host}  # 绑定地址`);
      console.log(`  cors_origins: ${config?.server?.cors_origins ?? DEFAULT_CONFIG.server.cors_origins}  # CORS 来源`);
      console.log(`  mode:         ${config?.server?.mode ?? DEFAULT_CONFIG.server.mode}  # 部署模式: remote|local`);
      console.log(`  allowed_paths:${config?.server?.allowed_paths?.join(':') || '(not set)'}  # local 显式白名单；未设置时默认 cwd+系统临时目录`);
      console.log(`  trust_all_paths:  ${config?.server?.trust_all_paths === true ? 'true' : 'false'}  # 危险：跳过白名单，仅 best-effort 敏感路径保护`);
      console.log('');

      console.log('logging:');
      console.log(`  level:        ${config?.logging?.level || 'info'}  # 日志级别 (debug/info/warn/error)`);
      console.log('');

      console.log('Available config keys:');
      console.log('  peekview.url, peekview.public_url');
      console.log('  server.port, server.host, server.cors_origins, server.mode, server.allowed_paths, server.trust_all_paths');
      console.log('  logging.level');
      console.log('');
      console.log('Subcommands:');
      console.log('  config allowed_path add <path>     # 追加白名单路径');
      console.log('  config allowed_path remove <path>  # 移除白名单路径');
      console.log('  config allowed_path list           # 列出白名单路径');
      console.log('');
      console.log(`Config file: ~/.peekview/mcp-config.yaml`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ── config allowed_path ─────────────────────────────────────────────────────
const allowedPathCmd = new Command('allowed_path')
  .description('Manage server.allowed_paths (append/remove/list)')
  .addHelpText('after', `
Examples:
  peekview-mcp config allowed_path add /home/kity/cclab
  peekview-mcp config allowed_path add /tmp
  peekview-mcp config allowed_path remove /home/kity/cclab
  peekview-mcp config allowed_path list
`);

allowedPathCmd
  .command('add')
  .argument('<path>', 'Absolute directory path to add')
  .description('Add a path to server.allowed_paths')
  .action((addPath: string) => {
    try {
      const existing = loadConfigFromFile() || {};
      const config: ConfigFileData = { ...existing };
      if (!config.server) config.server = {};

      const current: string[] = config.server.allowed_paths || [];
      const resolved = addPath; // keep as-is; user can pass absolute path

      if (current.includes(resolved)) {
        console.log(`Path already in allowed_paths: ${resolved}`);
        return;
      }

      current.push(resolved);
      config.server.allowed_paths = current;
      saveConfigToFile(config);
      console.log(`✓ Added ${resolved} to allowed_paths`);
      console.log(`  Current: ${current.join(':')}`);
      console.log(`  Restart service to apply: peekview-mcp service restart`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

allowedPathCmd
  .command('remove')
  .argument('<path>', 'Directory path to remove')
  .description('Remove a path from server.allowed_paths')
  .action((removePath: string) => {
    try {
      const existing = loadConfigFromFile() || {};
      const config: ConfigFileData = { ...existing };
      if (!config.server) config.server = {};

      const current: string[] = config.server.allowed_paths || [];
      const idx = current.indexOf(removePath);
      if (idx === -1) {
        console.log(`Path not found in allowed_paths: ${removePath}`);
        console.log(`  Current: ${current.length > 0 ? current.join(':') : '(empty)'}`);
        return;
      }

      current.splice(idx, 1);
      config.server.allowed_paths = current;
      saveConfigToFile(config);
      console.log(`✓ Removed ${removePath} from allowed_paths`);
      console.log(`  Current: ${current.length > 0 ? current.join(':') : '(empty)'}`);
      console.log(`  Restart service to apply: peekview-mcp service restart`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

allowedPathCmd
  .command('list')
  .description('List current server.allowed_paths')
  .action(() => {
    try {
      const config = loadConfigFromFile();
      const paths = config?.server?.allowed_paths || [];
      if (paths.length === 0) {
        console.log('allowed_paths: (not set)');
        console.log('  Default allowlist: cwd + system temporary directory (e.g., /tmp)');
      } else {
        console.log('allowed_paths:');
        for (const p of paths) {
          console.log(`  - ${p}`);
        }
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

configCommand.addCommand(allowedPathCmd);
