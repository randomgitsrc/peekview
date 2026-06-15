#!/usr/bin/env node
/**
 * PeekView MCP Server CLI - Config commands
 */
import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { saveConfigToFile, loadConfigFromFile } from '../config/file.js';
import type { ConfigFileData } from '../config/file.js';
import { validateUrl } from '../config/validators.js';

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '/tmp';
}

function getConfigFilePath(): string {
  return join(getHomeDir(), '.peekview', 'mcp-config.yaml');
}

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

export function configListAction(): void {
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

  const namespaces = config?.server?.path_namespaces;
  if (namespaces && Object.keys(namespaces).length > 0) {
    console.log('path_namespaces:');
    for (const [ns, mappings] of Object.entries(namespaces)) {
      console.log(`  ${ns}:`);
      for (const [from, to] of Object.entries(mappings || {})) {
        console.log(`    ${from} → ${to}`);
      }
    }
    console.log('');
  }

  console.log('Available config keys:');
  console.log('  peekview.url, peekview.public_url');
  console.log('  server.port, server.host, server.cors_origins, server.mode, server.allowed_paths, server.trust_all_paths');
  console.log('  logging.level');
  console.log('');
  console.log('Subcommands:');
  console.log('  config allowed_path add <path>     # 追加白名单路径');
  console.log('  config allowed_path remove <path>  # 移除白名单路径');
  console.log('  config allowed_path list           # 列出白名单路径');
  console.log('  config namespace add <ns> <container_path> <host_path>     # 添加 namespace 映射');
  console.log('  config namespace remove <ns> [container_path]             # 删除 namespace 映射');
  console.log('  config namespace list [ns]                                 # 列出 namespace');
  console.log('  config verify                                                # 验证配置（连通性+认证）');
  console.log('  config unset <key>                                           # 删除配置值');
  console.log('');
  console.log(`Config file: ~/.peekview/mcp-config.yaml`);
}

configCommand
  .command('list')
  .description('List all configuration values')
  .action(() => {
    try {
      configListAction();
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

// ── config namespace ────────────────────────────────────────────────────────

export function namespaceAdd(ns: string, containerPath: string, hostPath: string): void {
  if (!containerPath.startsWith('/')) {
    throw new Error('container_path must be an absolute path (starting with /)');
  }
  const existing = loadConfigFromFile() || {};
  const config: ConfigFileData = { ...existing };
  if (!config.server) config.server = {};
  if (!config.server.path_namespaces) config.server.path_namespaces = {};
  if (!config.server.path_namespaces[ns]) config.server.path_namespaces[ns] = {};
  config.server.path_namespaces[ns][containerPath] = hostPath;
  saveConfigToFile(config);
  console.log(`✓ Added namespace ${ns}: ${containerPath} → ${hostPath}`);
  console.log('  ⚠ Restart service to apply: peekview-mcp service restart');
}

export function namespaceRemove(ns: string, containerPath?: string, yes?: boolean): void {
  const existing = loadConfigFromFile() || {};
  const config: ConfigFileData = { ...existing };
  const namespaces = config.server?.path_namespaces;
  if (!namespaces?.[ns]) {
    throw new Error(`namespace '${ns}' not found`);
  }
  if (containerPath) {
    if (!(containerPath in namespaces[ns])) {
      throw new Error(`mapping '${containerPath}' not found in namespace '${ns}'`);
    }
    delete namespaces[ns][containerPath];
    if (Object.keys(namespaces[ns]).length === 0) {
      delete namespaces[ns];
    }
    console.log(`✓ Removed ${ns}: ${containerPath}`);
  } else {
    delete namespaces[ns];
    console.log(`✓ Deleted namespace ${ns}`);
  }
  saveConfigToFile(config);
}

export function namespaceList(ns?: string): void {
  const config = loadConfigFromFile();
  const namespaces = config?.server?.path_namespaces;
  if (!namespaces || Object.keys(namespaces).length === 0) {
    console.log('(no namespaces configured)');
    return;
  }
  const toShow = ns ? { [ns]: namespaces[ns] } : namespaces;
  for (const [nsId, mappings] of Object.entries(toShow)) {
    if (!mappings) {
      console.log(`  ${nsId}: (not found)`);
      continue;
    }
    console.log(`${nsId}:`);
    for (const [from, to] of Object.entries(mappings)) {
      console.log(`  ${from} → ${to}`);
    }
  }
}

const namespaceCmd = new Command('namespace')
  .description('Manage server.path_namespaces (add/remove/list)')
  .addHelpText('after', `
Examples:
  peekview-mcp config namespace add docker-a /opt/data ~/docker-data
  peekview-mcp config namespace add docker-a /opt/cache ~/cache
  peekview-mcp config namespace remove docker-a /opt/data
  peekview-mcp config namespace remove docker-a --yes
  peekview-mcp config namespace list
  peekview-mcp config namespace list docker-a
`);

namespaceCmd
  .command('add')
  .argument('<ns>', 'Namespace identifier')
  .argument('<container_path>', 'Container absolute path (must start with /)')
  .argument('<host_path>', 'Host path mapping')
  .description('Add a namespace path mapping')
  .action((ns: string, containerPath: string, hostPath: string) => {
    try {
      namespaceAdd(ns, containerPath, hostPath);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

namespaceCmd
  .command('remove')
  .argument('<ns>', 'Namespace identifier')
  .argument('[container_path]', 'Container path to remove; omit to delete entire namespace')
  .option('--yes', 'Skip confirmation when deleting entire namespace')
  .description('Remove a namespace path mapping or entire namespace')
  .action((ns: string, containerPath: string | undefined, options: { yes?: boolean }) => {
    try {
      if (!containerPath && !options.yes) {
        console.error('Error: Removing entire namespace requires --yes flag to confirm');
        process.exit(1);
      }
      namespaceRemove(ns, containerPath, options.yes);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

namespaceCmd
  .command('list')
  .argument('[ns]', 'Namespace identifier (omit to list all)')
  .description('List namespace path mappings')
  .action((ns: string | undefined) => {
    try {
      namespaceList(ns);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

configCommand.addCommand(namespaceCmd);

// ── config verify ──────────────────────────────────────────────────────────

export async function verifyAction(): Promise<void> {
  const configPath = getConfigFilePath();
  let allOk = true;

  if (!existsSync(configPath)) {
    console.log(`❌ 配置文件不存在：${configPath}`);
    process.exit(1);
  }
  console.log(`✅ 配置文件：${configPath}`);

  const config = loadConfigFromFile();

  const peekviewUrl = config?.peekview?.url;
  if (!peekviewUrl) {
    console.log('❌ peekview.url 未配置（必填）');
    process.exit(1);
  }

  try {
    validateUrl(peekviewUrl, 'peekview.url');
  } catch (e) {
    console.log(`❌ peekview.url 格式错误：${e instanceof Error ? e.message : e}`);
    allOk = false;
  }

  if (allOk) {
    try {
      const res = await fetch(`${peekviewUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        console.log(`✅ peekview.url：${peekviewUrl} — 可达`);
      } else {
        console.log(`❌ peekview.url：${peekviewUrl} — 响应 ${res.status}`);
        allOk = false;
      }
    } catch {
      console.log(`❌ peekview.url：${peekviewUrl} — 连接失败`);
      allOk = false;
    }
  }

  const apiKey = config?.peekview?.api_key;
  if (allOk) {
    if (!apiKey) {
      console.log('⚠️  api_key 未配置（某些操作需要）');
    } else {
      const maskedKey = apiKey.slice(0, 6) + '...' + apiKey.slice(-4);
      try {
        const res = await fetch(`${peekviewUrl}/api/v1/entries?per_page=1`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (res.status === 200 || res.status === 403) {
          console.log(`✅ api_key：${maskedKey} — 认证有效`);
        } else if (res.status === 401) {
          console.log(`❌ api_key：${maskedKey} — 认证失败（401）`);
          allOk = false;
        } else {
          console.log(`⚠️  api_key：${maskedKey} — 响应 ${res.status}（无法确认）`);
        }
      } catch {
        console.log('⚠️  api_key：无法验证（连接失败）');
      }
    }
  }

  const publicUrl = config?.peekview?.public_url;
  if (publicUrl) {
    console.log(`✅ peekview.public_url：${publicUrl}`);
  } else {
    console.log('⚠️  peekview.public_url 未配置（可选）');
  }

  if (!allOk) process.exit(1);
}

configCommand
  .command('verify')
  .description('Verify configuration — check connectivity and authentication')
  .action(async () => {
    try {
      await verifyAction();
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// ── config unset ───────────────────────────────────────────────────────────

export function unsetAction(key: string): void {
  const parts = key.split('.');
  if (parts.length !== 2) {
    console.error("Error: Invalid key format. Use 'section.key' format.");
    process.exit(1);
  }
  const [section, prop] = parts;

  const existing = loadConfigFromFile();
  if (!existing) {
    console.log(`${key} 未设置，无需删除`);
    return;
  }

  const sectionData = existing[section] as Record<string, unknown> | undefined;
  if (!sectionData || !(prop in sectionData)) {
    console.log(`${key} 未设置，无需删除`);
    return;
  }

  delete sectionData[prop];

  if (Object.keys(sectionData).length === 0) {
    delete existing[section];
  }

  saveConfigToFile(existing);
  console.log(`✓ 已删除 ${key}`);
  console.log('  ⚠ Restart service to apply: peekview-mcp service restart');
}

configCommand
  .command('unset')
  .argument('<key>', "Configuration key (e.g., peekview.url)")
  .description('Remove a configuration value')
  .action((key: string) => {
    try {
      unsetAction(key);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });
