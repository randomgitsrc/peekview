#!/usr/bin/env node
/**
 * PeekView MCP Server CLI - Service commands
 */
import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import { writeFileSync, existsSync, unlinkSync, readFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadConfigFromFile } from '../config/file.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const serviceCommand = new Command('service')
  .description('Manage MCP Server as a system service')
  .addHelpText('after', `
Systemd service management for Linux.

Quick start:
  peekview-mcp service install          # Install as user service (recommended, auto-detected)
  peekview-mcp service start              # Start the service
  peekview-mcp service status             # Check service status

Service mode (auto-detected):
  By default, commands auto-detect which service exists (user or system).
  If both exist, user service is preferred.

  --user    Force user service mode
  --system  Force system service mode (requires sudo)

User vs System service:
  User service (default, no sudo):
    Service file: ~/.config/systemd/user/peekview-mcp.service
    Recommended for personal use

  System service (requires sudo):
    Service file: /etc/systemd/system/peekview-mcp.service
    Use only for shared servers

Prerequisites:
  1. Create config file: peekview-mcp config set peekview.url ...
  2. Systemd must be available (most Linux distributions)
`);

export function getNodePath(): string {
  const home = homedir();

  // 1. Try nvm current symlink (upgrades automatically)
  const nvmCurrent = join(home, '.nvm/versions/node/current/bin/node');
  if (existsSync(nvmCurrent)) {
    return nvmCurrent;
  }

  // 2. Fallback to which node
  try {
    return execSync('which node', { encoding: 'utf-8' }).trim();
  } catch {
    throw new Error('Node.js not found. Please install Node.js or ensure it is in PATH.');
  }
}

function getServiceName(): string {
  return 'peekview-mcp';
}

function getServicePath(userMode: boolean): string {
  const serviceName = `${getServiceName()}.service`;
  if (userMode) {
    return join(homedir(), '.config', 'systemd', 'user', serviceName);
  }
  return `/etc/systemd/system/${serviceName}`;
}

/**
 * Check if service file uses legacy format (contains Environment variables)
 */
function isLegacyServiceFormat(servicePath: string): boolean {
  if (!existsSync(servicePath)) {
    return false;
  }
  const content = readFileSync(servicePath, 'utf-8');
  return content.includes('Environment="PEEKVIEW_URL') ||
         content.includes('Environment="PEEKVIEW_PUBLIC_URL') ||
         content.includes('Environment="PEEKVIEW_API_KEY');
}

/**
 * Detect which service mode to use
 * Priority: user service > system service
 * Returns: { userMode: boolean, warnings: string[] }
 */
function detectServiceMode(preferSystem: boolean): { userMode: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const userPath = getServicePath(true);
  const systemPath = getServicePath(false);
  const hasUser = existsSync(userPath);
  const hasSystem = existsSync(systemPath);

  if (preferSystem) {
    if (hasSystem) {
      return { userMode: false, warnings };
    }
    warnings.push('System service not found, falling back to user service');
    return { userMode: true, warnings };
  }

  // Default: prefer user service
  if (hasUser && hasSystem) {
    warnings.push('Both user and system services exist. Using user service (recommended).');
    warnings.push('To use system service, add --system flag');
    return { userMode: true, warnings };
  }

  if (hasUser) {
    return { userMode: true, warnings };
  }

  if (hasSystem) {
    return { userMode: false, warnings };
  }

  // Neither exists, default to user service for install
  return { userMode: true, warnings };
}

/**
 * Wait for process to exit with timeout
 */
async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Check if process exists (kill -0 doesn't actually kill, just checks)
      process.kill(pid, 0);
      // Process still running, wait
      await new Promise(r => setTimeout(r, 100));
    } catch {
      // Process doesn't exist (exited)
      return true;
    }
  }
  return false; // Timeout
}

/**
 * Wait for port to be released
 */
async function waitForPortRelease(port: number, timeoutMs: number): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = execSync(`lsof -i :${port} 2>/dev/null || echo "FREE"`, { encoding: 'utf-8' }).trim();
      if (result === 'FREE' || !result) {
        return true;
      }
      await new Promise(r => setTimeout(r, 100));
    } catch {
      return true;
    }
  }
  return false;
}

/**
 * Clean up old service process before reinstall
 */
async function cleanupOldService(userMode: boolean): Promise<void> {
  const serviceName = getServiceName();

  try {
    // 1. Stop the service
    if (userMode) {
      try {
        execSync(`systemctl --user stop ${serviceName} 2>/dev/null`);
      } catch {
        // Service might not be running
      }
    } else {
      try {
        execSync(`sudo systemctl stop ${serviceName} 2>/dev/null`);
      } catch {
        // Service might not be running
      }
    }

    // 2. Find and kill any lingering processes by name
    try {
      const pids = execSync(`pgrep -f "peekview-mcp serve" 2>/dev/null || echo ""`, { encoding: 'utf-8' }).trim();
      if (pids) {
        for (const pid of pids.split('\n')) {
          if (pid) {
            const pidNum = parseInt(pid, 10);
            if (!isNaN(pidNum)) {
              // Try graceful shutdown first
              try {
                process.kill(pidNum, 'SIGTERM');
                const exited = await waitForProcessExit(pidNum, 5000);
                if (!exited) {
                  // Force kill
                  process.kill(pidNum, 'SIGKILL');
                  await waitForProcessExit(pidNum, 2000);
                }
              } catch {
                // Process might already be gone
              }
            }
          }
        }
      }
    } catch {
      // No processes found
    }

    // 3. Find and kill any processes using port 33333
    try {
      const portPids = execSync(`lsof -t -i :33333 2>/dev/null || echo ""`, { encoding: 'utf-8' }).trim();
      if (portPids) {
        for (const pid of portPids.split('\n')) {
          if (pid) {
            const pidNum = parseInt(pid, 10);
            if (!isNaN(pidNum)) {
              console.log(`  → Stopping process ${pidNum} using port 33333...`);
              try {
                process.kill(pidNum, 'SIGTERM');
                const exited = await waitForProcessExit(pidNum, 5000);
                if (!exited) {
                  process.kill(pidNum, 'SIGKILL');
                  await waitForProcessExit(pidNum, 2000);
                }
              } catch {
                // Process might already be gone
              }
            }
          }
        }
      }
    } catch {
      // No processes found on port
    }

    // 4. Wait for port to be released
    await waitForPortRelease(33333, 5000);

  } catch (error) {
    console.warn('Warning: Cleanup of old service may have incomplete:', error instanceof Error ? error.message : String(error));
  }
}

function getExecutablePath(): string {
  try {
    // Try to find peekview-mcp in PATH
    return execSync('which peekview-mcp', { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback to common locations
    const home = homedir();
    const candidates = [
      join(home, '.npm-global', 'bin', 'peekview-mcp'),
      join(home, '.local', 'bin', 'peekview-mcp'),
      '/usr/local/bin/peekview-mcp',
      '/usr/bin/peekview-mcp',
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return 'peekview-mcp'; // Hope it's in PATH
  }
}

// service install [--user] [--system] [--force]
serviceCommand
  .command('install')
  .option('--user', 'Install as user service (no sudo needed) [default if neither exists]')
  .option('--system', 'Install as system service (requires sudo)')
  .option('--force', 'Overwrite existing service')
  .description('Install MCP Server as a systemd service')
  .action(async (options: { user?: boolean; system?: boolean; force?: boolean }) => {
    try {
      // Determine mode: explicit flags take precedence, otherwise auto-detect
      let userMode: boolean;
      let warnings: string[] = [];

      if (options.user && options.system) {
        console.error('Error: Cannot use both --user and --system');
        process.exit(1);
      }

      if (options.system) {
        userMode = false;
      } else if (options.user) {
        userMode = true;
      } else {
        // Auto-detect based on existing services
        const detection = detectServiceMode(false);
        userMode = detection.userMode;
        warnings = detection.warnings;
      }

      // Show warnings
      for (const warning of warnings) {
        console.log(`⚠ ${warning}`);
      }
      if (warnings.length > 0) console.log('');

      // Check config file exists
      const config = loadConfigFromFile();
      if (!config) {
        console.error('Error: No configuration file found.');
        console.error('');
        console.error('Please create a configuration first:');
        console.error('  peekview-mcp config set peekview.url http://localhost:8080');
        console.error('  peekview-mcp config set peekview.public_url http://localhost:8080');
        process.exit(1);
      }

      // Check required fields
      if (!config.peekview?.url || !config.peekview?.public_url) {
        console.error('Error: Configuration incomplete.');
        console.error('');
        console.error('Required settings:');
        console.error('  peekview.url');
        console.error('  peekview.public_url');
        console.error('');
        console.error('Run:');
        console.error('  peekview-mcp config set peekview.url http://localhost:8080');
        console.error('  peekview-mcp config set peekview.public_url http://localhost:8080');
        process.exit(1);
      }

      const servicePath = getServicePath(userMode);
      const execPath = getExecutablePath();
      const nodePath = getNodePath();
      const currentUser = execSync('whoami', { encoding: 'utf-8' }).trim();

      // Get config values for environment variables
      const peekviewUrl = config.peekview?.url || '';
      const peekviewPublicUrl = config.peekview?.public_url || '';
      const apiKey = config.peekview?.api_key || '';

      // Check if service exists
      if (existsSync(servicePath)) {
        if (!options.force) {
          console.error(`Error: Service already exists at ${servicePath}`);
          console.error('Use --force to overwrite');
          process.exit(1);
        }
        // Cleanup old service before reinstall
        console.log('→ Cleaning up old service...');
        await cleanupOldService(userMode);
      }

      // Create service content - NO Environment variables (read from config file at runtime)
      const homeDir = homedir();
      const userDirective = userMode ? '' : `User=${currentUser}\n`;
      const serviceContent = `[Unit]
Description=PeekView MCP Server
After=network.target

[Service]
Type=simple
${userDirective}WorkingDirectory=${homeDir}
ExecStart=${nodePath} ${execPath} serve
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
`;

      if (userMode) {
        // Create user systemd directory
        const userDir = join(homedir(), '.config', 'systemd', 'user');
        if (!existsSync(userDir)) {
          mkdirSync(userDir, { recursive: true });
        }
        writeFileSync(servicePath, serviceContent);

        // Reload and enable
        await runCommand('systemctl', ['--user', 'daemon-reload']);
        await runCommand('systemctl', ['--user', 'enable', getServiceName()]);

        console.log(`✓ User service installed: ${servicePath}`);
        console.log('');
        console.log('To start:');
        console.log(`  peekview-mcp service start`);
        console.log('');
        console.log('To check status:');
        console.log(`  peekview-mcp service status`);
      } else {
        // System service requires sudo
        const tempPath = join('/tmp', `${getServiceName()}.service`);
        writeFileSync(tempPath, serviceContent);

        await runCommand('sudo', ['cp', tempPath, servicePath]);
        await runCommand('sudo', ['systemctl', 'daemon-reload']);
        await runCommand('sudo', ['systemctl', 'enable', getServiceName()]);

        console.log(`✓ System service installed: ${servicePath}`);
        console.log('');
        console.log('To start:');
        console.log(`  peekview-mcp service start --system`);
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// service start
serviceCommand
  .command('start')
  .option('--user', 'Start user service')
  .option('--system', 'Start system service')
  .description('Start the MCP Server service')
  .action(async (options: { user?: boolean; system?: boolean }) => {
    try {
      // Determine mode
      let userMode: boolean;
      let warnings: string[] = [];

      if (options.user && options.system) {
        console.error('Error: Cannot use both --user and --system');
        process.exit(1);
      }

      if (options.system) {
        userMode = false;
      } else if (options.user) {
        userMode = true;
      } else {
        const detection = detectServiceMode(false);
        userMode = detection.userMode;
        warnings = detection.warnings;
      }

      for (const warning of warnings) {
        console.log(`⚠ ${warning}`);
      }

      if (userMode) {
        await runCommand('systemctl', ['--user', 'start', getServiceName()]);
      } else {
        await runCommand('sudo', ['systemctl', 'start', getServiceName()]);
      }
      console.log('✓ Service started');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// service stop
serviceCommand
  .command('stop')
  .option('--user', 'Stop user service')
  .option('--system', 'Stop system service')
  .description('Stop the MCP Server service')
  .action(async (options: { user?: boolean; system?: boolean }) => {
    try {
      // Determine mode
      let userMode: boolean;
      let warnings: string[] = [];

      if (options.user && options.system) {
        console.error('Error: Cannot use both --user and --system');
        process.exit(1);
      }

      if (options.system) {
        userMode = false;
      } else if (options.user) {
        userMode = true;
      } else {
        const detection = detectServiceMode(false);
        userMode = detection.userMode;
        warnings = detection.warnings;
      }

      for (const warning of warnings) {
        console.log(`⚠ ${warning}`);
      }

      // 1. Stop systemd service
      try {
        if (userMode) {
          await runCommand('systemctl', ['--user', 'stop', getServiceName()]);
        } else {
          await runCommand('sudo', ['systemctl', 'stop', getServiceName()]);
        }
      } catch {
        // Service might not be running via systemd
      }

      // 2. Clean up any orphaned processes
      console.log('→ Cleaning up orphaned processes...');
      await cleanupOldService(userMode);

      console.log('✓ Service stopped');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// service restart
serviceCommand
  .command('restart')
  .option('--user', 'Restart user service')
  .option('--system', 'Restart system service')
  .description('Restart the MCP Server service')
  .action(async (options: { user?: boolean; system?: boolean }) => {
    try {
      // Determine mode
      let userMode: boolean;
      let warnings: string[] = [];

      if (options.user && options.system) {
        console.error('Error: Cannot use both --user and --system');
        process.exit(1);
      }

      if (options.system) {
        userMode = false;
      } else if (options.user) {
        userMode = true;
      } else {
        const detection = detectServiceMode(false);
        userMode = detection.userMode;
        warnings = detection.warnings;
      }

      for (const warning of warnings) {
        console.log(`⚠ ${warning}`);
      }

      if (userMode) {
        await runCommand('systemctl', ['--user', 'restart', getServiceName()]);
      } else {
        await runCommand('sudo', ['systemctl', 'restart', getServiceName()]);
      }
      console.log('✓ Service restarted');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// service status
serviceCommand
  .command('status')
  .option('--user', 'Check user service status')
  .option('--system', 'Check system service status')
  .description('Check the MCP Server service status')
  .action(async (options: { user?: boolean; system?: boolean }) => {
    try {
      // Determine mode
      let userMode: boolean;
      let warnings: string[] = [];

      if (options.user && options.system) {
        console.error('Error: Cannot use both --user and --system');
        process.exit(1);
      }

      if (options.system) {
        userMode = false;
      } else if (options.user) {
        userMode = true;
      } else {
        const detection = detectServiceMode(false);
        userMode = detection.userMode;
        warnings = detection.warnings;
      }

      for (const warning of warnings) {
        console.log(`⚠ ${warning}`);
      }
      if (warnings.length > 0) console.log('');

      const servicePath = getServicePath(userMode);

      // Check for legacy format
      if (existsSync(servicePath) && isLegacyServiceFormat(servicePath)) {
        console.log('⚠ WARNING: Service uses legacy format (Environment variables detected)');
        console.log('   This means config changes require "service install --force" to take effect.');
        console.log('   Run "peekview-mcp service install --force" to migrate to new format.\n');
      } else if (existsSync(servicePath)) {
        console.log('✓ Service uses modern format (reads config from file at runtime)\n');
      }

      // Run status and inherit stdio to show output
      const cmd = 'systemctl';
      const args = userMode
        ? ['--user', 'status', getServiceName()]
        : ['status', getServiceName()];

      if (userMode) {
        const child = spawn(cmd, args, { stdio: 'inherit', shell: false });
        await new Promise((resolve, reject) => {
          child.on('close', (code) => { resolve(code); });
          child.on('error', reject);
        });
      } else {
        // System service needs sudo
        const child = spawn('sudo', [cmd, ...args], { stdio: 'inherit', shell: false });
        await new Promise((resolve, reject) => {
          child.on('close', (code) => { resolve(code); });
          child.on('error', reject);
        });
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// service uninstall
serviceCommand
  .command('uninstall')
  .option('--user', 'Uninstall user service')
  .option('--system', 'Uninstall system service')
  .description('Remove the MCP Server service')
  .action(async (options: { user?: boolean; system?: boolean }) => {
    try {
      // Determine mode
      let userMode: boolean;
      let warnings: string[] = [];

      if (options.user && options.system) {
        console.error('Error: Cannot use both --user and --system');
        process.exit(1);
      }

      if (options.system) {
        userMode = false;
      } else if (options.user) {
        userMode = true;
      } else {
        const detection = detectServiceMode(false);
        userMode = detection.userMode;
        warnings = detection.warnings;
      }

      for (const warning of warnings) {
        console.log(`⚠ ${warning}`);
      }

      const servicePath = getServicePath(userMode);

      // Stop service first
      try {
        if (userMode) {
          await runCommand('systemctl', ['--user', 'stop', getServiceName()]);
          await runCommand('systemctl', ['--user', 'disable', getServiceName()]);
        } else {
          await runCommand('sudo', ['systemctl', 'stop', getServiceName()]);
          await runCommand('sudo', ['systemctl', 'disable', getServiceName()]);
        }
      } catch {
        // Service might not be running
      }

      // Clean up orphaned processes
      console.log('→ Cleaning up orphaned processes...');
      await cleanupOldService(userMode);

      // Remove service file
      if (userMode) {
        if (existsSync(servicePath)) {
          unlinkSync(servicePath);
        }
        await runCommand('systemctl', ['--user', 'daemon-reload']);
      } else {
        await runCommand('sudo', ['rm', '-f', servicePath]);
        await runCommand('sudo', ['systemctl', 'daemon-reload']);
      }

      console.log('✓ Service uninstalled');
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

async function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed: ${cmd} ${args.join(' ')}\n${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
