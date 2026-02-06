/**
 * OpenCode Multi-Tenant Worker (Hono-based)
 *
 * Cloudflare Worker with Hono framework for multi-user OpenCode access
 * (Sandbox SDK integration to be added later)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyClerkToken } from './auth/clerk.js';

/**
 * Environment variables for Cloudflare Workers
 */
export interface Env {
  OPENCODE_API_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY: string;
}

/**
 * Variables stored in Hono context
 */
type Variables = {
  userId: string;
};

/**
 * Hono app with Cloudflare Workers bindings
 */
type AppType = Hono<{ Bindings: Env; Variables: Variables }>;

/**
 * Session data (in-memory, will be replaced with Durable Objects)
 */
interface Session {
  id: string;
  userId: string;
  createdAt: string;
}

// Simple in-memory session storage (for demo)
const sessions = new Map<string, Session>();

/**
 * OpenCode Multi-Tenant Worker Class
 */
export class Worker {
  readonly app: AppType;

  constructor() {
    this.app = new Hono<{ Bindings: Env; Variables: Variables }>();
    this.setupRoutes();
  }

  /**
   * Setup all routes
   */
  private setupRoutes() {
    // CORS middleware (apply to all routes)
    this.app.use('*', cors());

    // Health check (no auth required)
    this.app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: performance.now(),
      });
    });

    // Clerk authentication middleware
    const authMiddleware = async (c: any, next: any) => {
      const authHeader = c.req.header('Authorization') || '';
      const userId = verifyClerkToken(authHeader);

      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      c.set('userId', userId);
      await next();
    };

    // API routes (require authentication)
    const apiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
    apiRoutes.use(authMiddleware);

    // POST /api/prompt - Execute OpenCode prompt
    apiRoutes.post('/prompt', async (c) => {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { prompt } = body as { prompt: string };

      if (!prompt) {
        return c.json({ error: 'prompt is required' }, 400);
      }

      // TODO: Integrate with OpenCode SDK (when Sandbox access is available)
      // For now, return a mock response
      return c.json({
        success: true,
        response: `Executed prompt for user ${userId}: ${prompt}`,
        note: 'OpenCode SDK integration coming soon',
      });
    });

    // Sessions routes
    apiRoutes.get('/sessions', (c) => {
      const userId = c.get('userId');
      const userSessions = Array.from(sessions.values()).filter(s => s.userId === userId);
      return c.json({ sessions: userSessions });
    });

    apiRoutes.post('/sessions', (c) => {
      const userId = c.get('userId');
      const session: Session = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        createdAt: new Date().toISOString(),
      };
      sessions.set(session.id, session);
      return c.json(session, 201);
    });

    apiRoutes.delete('/sessions/:id', (c) => {
      const userId = c.get('userId');
      const sessionId = c.req.param('id');
      const session = sessions.get(sessionId);

      if (!session || session.userId !== userId) {
        return c.json({ error: 'Session not found' }, 404);
      }

      sessions.delete(sessionId);
      return c.body(null, 204);
    });

    // Mount API routes at /api
    this.app.route('/api', apiRoutes);

    // 404 handler (must come after all routes)
    this.app.notFound((c) => {
      return c.json({ error: 'Not Found' }, 404);
    });
  }

  /**
   * Fetch handler for Cloudflare Workers
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    return this.app.fetch(request, env);
  }
}

// Export singleton instance
export const worker = new Worker();

// Default export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return worker.fetch(request, env);
  },
};
