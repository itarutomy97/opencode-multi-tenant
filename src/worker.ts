/**
 * OpenCode Multi-Tenant Worker Entry Point
 *
 * Cloudflare Worker that provides multi-user access to OpenCode AI
 * via Cloudflare Sandbox SDK.
 */
import { getSandbox } from '@cloudflare/sandbox';
import type { Config } from '@opencode-ai/sdk';
import { verifyClerkToken } from './auth/clerk.js';
import { SandboxManager } from './sandbox/sandbox-manager.js';

export { Sandbox } from '@cloudflare/sandbox';

/**
 * Environment variables for the Worker
 */
export interface Env {
  OpenCodeSandbox: DurableObjectNamespace<Sandbox>;
  OPENCODE_API_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY: string;
}

/**
 * OpenCode configuration
 */
const getOpenCodeConfig = (env: Env): Config => ({
  provider: {
    opencode: {
      options: {
        apiKey: env.OPENCODE_API_KEY
      }
    }
  }
});

/**
 * Sandbox manager instance (will be initialized per request)
 */
const sandboxManager = new SandboxManager((ns, id) => getSandbox(ns, id));

/**
 * Main Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint (no auth required)
    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: performance.now(),
      });
    }

    // API routes that require authentication
    if (url.pathname.startsWith('/api/')) {
      return handleApiRoute(request, env, url);
    }

    // Session management routes
    if (url.pathname.startsWith('/sessions')) {
      return handleSessionRoute(request, env, url);
    }

    return new Response('Not Found', { status: 404 });
  }
};

/**
 * Handle API routes
 */
async function handleApiRoute(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  // Verify authentication
  const authHeader = request.headers.get('Authorization') || '';
  const userId = verifyClerkToken(authHeader);

  if (!userId) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // POST /api/prompt - Execute OpenCode prompt
  if (url.pathname === '/api/prompt' && request.method === 'POST') {
    return handlePromptExecution(request, env, userId);
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Handle session management routes
 */
async function handleSessionRoute(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  // Verify authentication
  const authHeader = request.headers.get('Authorization') || '';
  const userId = verifyClerkToken(authHeader);

  if (!userId) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // GET /sessions - List user's sessions
  if (url.pathname === '/sessions' && request.method === 'GET') {
    return Response.json({ sessions: [] });
  }

  // POST /sessions - Create new session
  if (url.pathname === '/sessions' && request.method === 'POST') {
    return Response.json({
      id: `session_${Date.now()}`,
      userId,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }

  // DELETE /sessions/:id - Delete session
  const match = url.pathname.match(/^\/sessions\/([^/]+)$/);
  if (match && request.method === 'DELETE') {
    return new Response(null, { status: 204 });
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Handle OpenCode prompt execution
 */
async function handlePromptExecution(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as { prompt: string };
    const { prompt } = body;

    if (!prompt) {
      return Response.json(
        { error: 'prompt is required' },
        { status: 400 }
      );
    }

    // Get user's sandbox
    const sandbox = await sandboxManager.getSandboxForUser(userId);
    const workspacePath = sandboxManager.getUserWorkspacePath(userId);

    // TODO: Integrate with OpenCode SDK to execute prompt
    // For now, return a mock response
    return Response.json({
      success: true,
      response: `Executed prompt for user ${userId}: ${prompt}`,
      workspace: workspacePath,
    });
  } catch (error) {
    return Response.json(
      {
        error: 'Failed to execute prompt',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
