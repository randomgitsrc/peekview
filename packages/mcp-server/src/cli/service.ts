#!/usr/bin/env node
/**
 * PeekView MCP Server CLI - Service commands
 */
import { Command } from 'commander';
import { spawn } from 'child_process';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
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
  peekview-mcp service install --user   # Install as user service (recommended)
  peekview-mcp service start            # Start the service
  peekview-mcp service status           # Check service status

User vs System service:
  --user    User service (no sudo, runs as current user)
            Service file: ~/.config/systemd/user/peekview-mcp.service

  (default) System service (requires sudo, runs as root)
            Service file: /etc/systemd/system/peekview-mcp.service

Prerequisites:
  1. Create config file: peekview-mcp config set peekview.url ...
  2. Systemd must be available (most Linux distributions)
`);

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

function getExecutablePath(): string {
  try {
    // Try to find peekview-mcp in PATH
    const { execSync } = require('child_process');
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

// service install [--user] [--force]
serviceCommand
  .command('install')
  .option('--user', 'Install as user service (no sudo needed)')
  .option('--force', 'Overwrite existing service')
  .description('Install MCP Server as a systemd service')
  .action(async (options: { user?: boolean; force?: boolean }) => {
    try {
      const userMode = options.user || false;

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
      const currentUser = require('child_process').execSync('whoami', { encoding: 'utf-8' }).trim();

      // Check if service exists
      if (existsSync(servicePath) && !options.force) {
        console.error(`Error: Service already exists at ${servicePath}`);
        console.error('Use --force to overwrite');
        process.exit(1);
      }

      // Create service content - NO environment variables!
      const serviceContent = `[Unit]
Description=PeekView MCP Server
After=network.target

[Service]
Type=simple
User=${currentUser}
ExecStart=${execPath} serve
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
        console.log(`  peekview-mcp service start`);
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
  .description('Start the MCP Server service')
  .action(async (options: { user?: boolean }) => {
    try {
      const userMode = options.user || false;
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
  .description('Stop the MCP Server service')
  .action(async (options: { user?: boolean }) => {
    try {
      const userMode = options.user || false;
      if (userMode) {
        await runCommand('systemctl', ['--user', 'stop', getServiceName()]);
      } else {
        await runCommand('sudo', ['systemctl', 'stop', getServiceName()]);
      }
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
  .description('Restart the MCP Server service')
  .action(async (options: { user?: boolean }) => {
    try {
      const userMode = options.user || false;
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
  .description('Check the MCP Server service status')
  .action(async (options: { user?: boolean }) => {
    try {
      const userMode = options.user || false;
      const args = userMode
        ? ['--user', 'status', getServiceName()]
        : ['status', getServiceName()];
      const cmd = userMode ? 'systemctl' : 'sudo';

      // Run status and inherit stdio to show output
      const child = spawn(cmd, args, {
        stdio: 'inherit',
        shell: false,
      });

      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          resolve(code);
        });
        child.on('error', reject);
      });
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// service uninstall
serviceCommand
  .command('uninstall')
  .option('--user', 'Uninstall user service')
  .description('Remove the MCP Server service')
  .action(async (options: { user?: boolean }) => {
    try {
      const userMode = options.user || false;
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
