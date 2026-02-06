/**
 * Sandbox Manager Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SandboxManager } from './sandbox-manager.js';

describe('SandboxManager', () => {
  let manager: SandboxManager;
  let mockGetSandbox: ReturnType<typeof vi.fn>;
  let mockSandbox: any;

  beforeEach(() => {
    // Mock sandbox
    mockSandbox = {
      exec: vi.fn().mockResolvedValue({ stdout: 'success', success: true }),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockResolvedValue({ content: 'file content' }),
      gitCheckout: vi.fn().mockResolvedValue(undefined),
    };

    // Mock getSandbox function
    mockGetSandbox = vi.fn().mockReturnValue(mockSandbox);

    manager = new SandboxManager(mockGetSandbox);
  });

  describe('getSandboxForUser', () => {
    it('returns sandbox for user', async () => {
      const sandbox = await manager.getSandboxForUser('user_123');

      expect(sandbox).toBe(mockSandbox);
      expect(mockGetSandbox).toHaveBeenCalledWith(
        null,
        'opencode-user_123'
      );
    });

    it('uses different sandbox instances for different users', async () => {
      await manager.getSandboxForUser('user_123');
      await manager.getSandboxForUser('user_456');

      expect(mockGetSandbox).toHaveBeenCalledWith(null, 'opencode-user_123');
      expect(mockGetSandbox).toHaveBeenCalledWith(null, 'opencode-user_456');
      expect(mockGetSandbox).toHaveBeenCalledTimes(2);
    });

    it('creates user directory on first access', async () => {
      await manager.getSandboxForUser('user_123');

      expect(mockSandbox.exec).toHaveBeenCalledWith(
        'mkdir -p /home/user/workspaces/user_123'
      );
    });
  });

  describe('getUserWorkspacePath', () => {
    it('returns correct path for user', () => {
      const path = manager.getUserWorkspacePath('user_123');
      expect(path).toBe('/home/user/workspaces/user_123');
    });

    it('sanitizes userId to prevent path traversal', () => {
      const path = manager.getUserWorkspacePath('../etc/passwd');
      expect(path).not.toContain('../');
      expect(path).not.toContain('..');
      expect(path).toBe('/home/user/workspaces/etcpasswd');
    });

    it('replaces special characters with underscore', () => {
      const path = manager.getUserWorkspacePath('user@123!test');
      expect(path).toBe('/home/user/workspaces/user_123_test');
    });
  });
});
