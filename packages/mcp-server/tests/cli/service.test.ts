import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as child_process from 'child_process';

// Mocks
vi.mock('fs', async () => {
  return {
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('child_process', async () => {
  return {
    execSync: vi.fn(),
    spawn: vi.fn(),
  };
});

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

vi.mock('../../src/config/file.js', () => ({
  loadConfigFromFile: vi.fn(() => null),
}));

// Import after mocks
const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockExecSync = child_process.execSync as ReturnType<typeof vi.fn>;

describe('getNodePath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return nvm current path when nvm symlink exists', async () => {
    const { getNodePath } = await import('../../src/cli/service.js');
    const nvmPath = '/home/testuser/.nvm/versions/node/current/bin/node';

    // Mock nvm path exists
    mockExistsSync.mockImplementation((path: string) => {
      return path === nvmPath;
    });

    const result = getNodePath();

    expect(result).toBe(nvmPath);
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('should fallback to which node when nvm not found', async () => {
    const { getNodePath } = await import('../../src/cli/service.js');

    // Mock nvm path doesn't exist
    mockExistsSync.mockReturnValue(false);
    // Mock which node returns system path
    mockExecSync.mockReturnValue('/usr/bin/node\n');

    const result = getNodePath();

    expect(result).toBe('/usr/bin/node');
    expect(mockExecSync).toHaveBeenCalledWith('which node', { encoding: 'utf-8' });
  });

  it('should throw error when node not found anywhere', async () => {
    const { getNodePath } = await import('../../src/cli/service.js');

    // Mock nvm path doesn't exist
    mockExistsSync.mockReturnValue(false);
    // Mock which node throws
    mockExecSync.mockImplementation(() => {
      throw new Error('command not found');
    });

    expect(() => getNodePath()).toThrow('Node.js not found');
  });
});
