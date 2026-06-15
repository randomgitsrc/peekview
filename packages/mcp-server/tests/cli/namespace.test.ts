import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { saveConfigToFile, loadConfigFromFile } from '../../src/config/file.js';
import {
  namespaceAdd,
  namespaceRemove,
  namespaceList,
  configListAction,
} from '../../src/cli/config.js';

describe('CLI config namespace', () => {
  let testHome: string;
  const originalEnv = { ...process.env };

  function restoreEnv() {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }

  beforeEach(() => {
    testHome = mkdtempSync(join(tmpdir(), 'pv-ns-test-'));
    process.env.HOME = testHome;
    process.env.USERPROFILE = testHome;
  });

  afterEach(() => {
    restoreEnv();
    rmSync(testHome, { recursive: true, force: true });
  });

  function writeConfig(data: object) {
    saveConfigToFile(data as any);
  }

  function readConfig() {
    return loadConfigFromFile();
  }

  function captureOutput(fn: () => void): string {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => lines.push(args.join(' '));
    try {
      fn();
    } finally {
      console.log = orig;
    }
    return lines.join('\n');
  }

  it('AC1: add creates namespace mapping in config', () => {
    namespaceAdd('docker-a', '/opt/data', '~/docker-data1');

    const config = readConfig();
    expect(config?.server?.path_namespaces?.['docker-a']?.['/opt/data'])
      .toBe('~/docker-data1');
  });

  it('AC2: add appends mapping to existing namespace', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } },
    });

    namespaceAdd('docker-a', '/opt/cache', '~/cache1');

    const config = readConfig();
    const ns = config?.server?.path_namespaces?.['docker-a'];
    expect(ns?.['/opt/data']).toBe('~/d1');
    expect(ns?.['/opt/cache']).toBe('~/cache1');
  });

  it('AC3: list outputs all namespaces', () => {
    writeConfig({
      server: {
        path_namespaces: {
          'docker-a': { '/opt/data': '~/d1' },
          'docker-b': { '/opt/data': '~/d2' },
        },
      },
    });

    const output = captureOutput(() => namespaceList());
    expect(output).toContain('docker-a');
    expect(output).toContain('docker-b');
    expect(output).toContain('/opt/data');
  });

  it('AC4: list with ns arg shows only that namespace', () => {
    writeConfig({
      server: {
        path_namespaces: {
          'docker-a': { '/opt/data': '~/d1' },
          'docker-b': { '/opt/data': '~/d2' },
        },
      },
    });

    const output = captureOutput(() => namespaceList('docker-a'));
    expect(output).toContain('docker-a');
    expect(output).not.toContain('docker-b');
  });

  it('AC5: remove single mapping leaves others intact', () => {
    writeConfig({
      server: {
        path_namespaces: {
          'docker-a': { '/opt/data': '~/d1', '/opt/cache': '~/c1' },
        },
      },
    });

    namespaceRemove('docker-a', '/opt/data');

    const ns = readConfig()?.server?.path_namespaces?.['docker-a'];
    expect(ns?.['/opt/data']).toBeUndefined();
    expect(ns?.['/opt/cache']).toBe('~/c1');
  });

  it('AC6: remove without container_path deletes entire namespace', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } },
    });

    namespaceRemove('docker-a', undefined, true);

    const config = readConfig();
    expect(config?.server?.path_namespaces?.['docker-a']).toBeUndefined();
  });

  it('AC7: add with relative container_path throws error', () => {
    expect(() => namespaceAdd('docker-a', 'relative/path', '~/d1')).toThrow();
    expect(readConfig()?.server?.path_namespaces).toBeUndefined();
  });

  it('AC8: config list shows path_namespaces section', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } },
    });

    const output = captureOutput(() => configListAction());
    expect(output).toContain('path_namespaces');
    expect(output).toContain('docker-a');
  });

  it('AC9: list with no config file shows friendly message', () => {
    const output = captureOutput(() => namespaceList());
    expect(output).toMatch(/no namespace|not configured/i);
  });

  it('remove non-existent namespace throws error', () => {
    expect(() => namespaceRemove('nonexistent', undefined, true)).toThrow(/not found/i);
  });

  it('remove non-existent container_path throws error', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } },
    });

    expect(() => namespaceRemove('docker-a', '/nonexistent')).toThrow(/not found/i);
  });

  it('add overwrites existing container_path mapping', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/old' } } },
    });

    namespaceAdd('docker-a', '/opt/data', '~/new');

    const config = readConfig();
    expect(config?.server?.path_namespaces?.['docker-a']?.['/opt/data']).toBe('~/new');
  });

  it('namespace ID with special characters is stored as-is', () => {
    namespaceAdd('my-ns_1', '/opt/data', '~/d1');

    const config = readConfig();
    expect(config?.server?.path_namespaces?.['my-ns_1']?.['/opt/data']).toBe('~/d1');
  });

  it('remove last mapping in namespace deletes the namespace key', () => {
    writeConfig({
      server: { path_namespaces: { 'docker-a': { '/opt/data': '~/d1' } } },
    });

    namespaceRemove('docker-a', '/opt/data');

    const config = readConfig();
    expect(config?.server?.path_namespaces?.['docker-a']).toBeUndefined();
  });
});
