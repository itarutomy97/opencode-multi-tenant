/**
 * Sandbox Manager for Multi-User OpenCode
 *
 * Manages isolated sandbox environments for each user.
 */
import type { Sandbox } from '@cloudflare/sandbox';

export interface Env {
  OpenCodeSandbox: DurableObjectNamespace<Sandbox>;
}

/**
 * Sandbox Manager Class
 */
export class SandboxManager {
  private getSandbox: (ns: any, id: string) => Sandbox;
  private userWorkspaces = new Map<string, string>();

  constructor(getSandbox: (ns: any, id: string) => Sandbox) {
    this.getSandbox = getSandbox;
  }

  /**
   * Get sandbox instance for a specific user
   */
  async getSandboxForUser(userId: string): Promise<Sandbox> {
    const sanitizedId = this.sanitizeUserId(userId);
    const workspacePath = this.getUserWorkspacePath(sanitizedId);

    // Get or create sandbox for this user
    const sandbox = this.getSandbox(
      null as unknown as any, // Namespace would be passed in real usage
      `opencode-${sanitizedId}`
    );

    // Ensure workspace directory exists
    await sandbox.exec(`mkdir -p ${workspacePath}`);

    return sandbox;
  }

  /**
   * Get workspace path for a user
   */
  getUserWorkspacePath(userId: string): string {
    const sanitizedId = this.sanitizeUserId(userId);
    return `/home/user/workspaces/${sanitizedId}`;
  }

  /**
   * Sanitize userId to prevent path traversal attacks
   */
  private sanitizeUserId(userId: string): string {
    // Remove any path traversal components
    return userId
      .replace(/\.\./g, '')
      .replace(/\//g, '')
      .replace(/\\/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}
