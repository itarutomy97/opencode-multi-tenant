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
  CLERK_PUBLISHABLE_KEY: string;
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

// HTML template for home page
function createHomePage(publishableKey: string): string {
  // Extract frontend API from publishable key for Clerk JS SDK
  const encoded = publishableKey.replace('pk_test_', '').replace('pk_live_', '');
  let frontendApi = Buffer.from(encoded, 'base64').toString();
  frontendApi = frontendApi.replace(/\$/, '');
  frontendApi = frontendApi.replace('.clerk.accounts.dev', '.accounts.dev');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenCode - Get Auth Token</title>
  <!-- Clerk JS SDK -->
  <script
    async
    crossorigin="anonymous"
    data-clerk-publishable-key="${publishableKey}"
    src="https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
  ></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #1e3a8a;
      margin-bottom: 8px;
      text-align: center;
    }
    .tagline {
      color: #6b7280;
      text-align: center;
      margin-bottom: 30px;
      font-size: 14px;
    }
    .steps {
      background: #f9fafb;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .step {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }
    .step:last-child { margin-bottom: 0; }
    .step-num {
      background: #1e3a8a;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      flex-shrink: 0;
    }
    .step-text {
      font-size: 14px;
      color: #374151;
      line-height: 1.5;
    }
    .step-text code {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 24px;
      background: #1e3a8a;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      transition: background 0.2s;
      margin-bottom: 12px;
    }
    .btn:hover {
      background: #1e40af;
    }
    .btn-secondary {
      background: #10b981;
    }
    .btn-secondary:hover {
      background: #059669;
    }
    .token-section {
      display: none;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .token-section.show {
      display: block;
    }
    .token-label {
      font-size: 14px;
      color: #374151;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .token-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 11px;
      word-break: break-all;
      max-height: 150px;
      overflow-y: auto;
      margin-bottom: 12px;
      cursor: pointer;
    }
    .token-box:hover {
      background: #e5e7eb;
    }
    #clerk-auth-container {
      margin-bottom: 12px;
    }
    .loading {
      text-align: center;
      color: #6b7280;
      padding: 20px;
    }
    .signed-in-as {
      background: #d1fae5;
      color: #065f46;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 12px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">OpenCode</div>
    <div class="tagline">Get Authentication Token</div>

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Sign in with the button below</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Click "Get My Token" button</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Click token to copy</div>
      </div>
    </div>

    <div id="authContainer">
      <div class="loading">Loading authentication...</div>
    </div>

    <button id="getTokenBtn" class="btn btn-secondary">Get My Token</button>

    <div id="tokenSection" class="token-section">
      <div class="token-label">✓ Your JWT Token (click to copy):</div>
      <div id="tokenBox" class="token-box">Loading...</div>
    </div>
  </div>

  <script>
    const authContainer = document.getElementById('authContainer');
    const getTokenBtn = document.getElementById('getTokenBtn');
    const tokenSection = document.getElementById('tokenSection');
    const tokenBox = document.getElementById('tokenBox');

    let clerk = null;

    async function initClerk() {
      try {
        // Clerk is already initialized from the script tag
        clerk = window.Clerk;
        await clerk.load();

        if (clerk.user) {
          // User is signed in
          authContainer.innerHTML = '<div class="signed-in-as">✓ Signed in as: ' + (clerk.user.primaryEmailAddress?.emailAddress || clerk.user.id) + '</div>';
        } else {
          // Show sign-in button
          authContainer.innerHTML = '<button id="signInBtn" class="btn">Sign In / Sign Up</button>';
          document.getElementById('signInBtn').addEventListener('click', () => {
            clerk.openSignUp({
              appearance: {
                elements: {
                  modal: {
                    zIndex: 99999
                  }
                }
              }
            });
          });
        }

        // Listen for sign-in changes
        clerk.addListener((resources) => {
          if (resources.user) {
            authContainer.innerHTML = '<div class="signed-in-as">✓ Signed in as: ' + (resources.user.primaryEmailAddress?.emailAddress || resources.user.id) + '</div>';
          }
        });
      } catch (error) {
        console.error('Clerk init error:', error);
        authContainer.innerHTML = '<div style="color: #ef4444; text-align: center;">Failed to load authentication: ' + error.message + '</div>';
      }
    }

    // Wait for Clerk script to load
    const checkClerk = setInterval(() => {
      if (window.Clerk) {
        clearInterval(checkClerk);
        initClerk();
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkClerk);
      if (!clerk && authContainer.innerHTML.includes('Loading')) {
        authContainer.innerHTML = '<div style="color: #ef4444; text-align: center;">Failed to load Clerk SDK. Please refresh the page.</div>';
      }
    }, 10000);

    // Get token button handler
    getTokenBtn.addEventListener('click', async function() {
      getTokenBtn.textContent = 'Loading...';
      getTokenBtn.disabled = true;

      try {
        // Get token directly from Clerk
        const token = await clerk?.session?.getToken();

        if (token) {
          tokenBox.textContent = token;
          tokenSection.classList.add('show');
          getTokenBtn.textContent = '✓ Token Ready!';

          tokenBox.addEventListener('click', function() {
            navigator.clipboard.writeText(token).then(() => {
              const original = tokenBox.style.background;
              tokenBox.style.background = '#d1fae5';
              setTimeout(() => tokenBox.style.background = original, 500);
            });
          });
        } else {
          tokenBox.textContent = 'No active session. Please sign in first.';
          tokenSection.classList.add('show');
          getTokenBtn.textContent = 'Get My Token';
        }
      } catch (error) {
        console.error('Get token error:', error);
        tokenBox.textContent = 'Error: ' + error.message;
        tokenSection.classList.add('show');
        getTokenBtn.textContent = 'Get My Token';
      }

      getTokenBtn.disabled = false;
    });
  </script>
</body>
</html>
`;
}

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

    // Home page - Get auth token
    this.app.get('/', (c) => {
      const publishableKey = c.env.CLERK_PUBLISHABLE_KEY || '';
      return c.html(createHomePage(publishableKey));
    });

    // Get token endpoint
    this.app.get('/get-token', async (c) => {
      const cookieHeader = c.req.header('cookie');
      if (!cookieHeader) {
        return c.json({ error: 'No cookies. Please sign in first.' }, 401);
      }

      const cookies = cookieHeader.split(';').map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith('__session='));

      if (!sessionCookie) {
        return c.json({ error: 'No session cookie found. Please sign in first.' }, 401);
      }

      const sessionToken = sessionCookie.split('=')[1];

      try {
        const response = await fetch(`https://api.clerk.com/v1/sessions/${sessionToken}/verify`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.CLERK_SECRET_KEY}`,
          },
        });

        if (!response.ok) {
          return c.json({ error: 'Invalid session' }, 401);
        }

        const data = await response.json() as { last_active_token?: { jwt: string } };
        const jwt = data.last_active_token?.jwt;

        if (jwt) {
          return c.json({ token: jwt });
        } else {
          return c.json({ error: 'No JWT found' }, 400);
        }
      } catch (error) {
        return c.json({ error: 'Failed to verify session' }, 500);
      }
    });

    // Clerk authentication middleware
    const authMiddleware = async (c: any, next: any) => {
      const authHeader = c.req.header('Authorization') || '';

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized', debug: 'no_bearer' }, 401);
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix

      try {
        // Simple base64 decode to get payload
        const parts = token.split('.');
        if (parts.length !== 3) {
          return c.json({ error: 'Unauthorized', debug: 'invalid_jwt_format' }, 401);
        }

        // Decode payload (Cloudflare Workers compatible)
        let base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64Payload.length % 4) {
          base64Payload += '=';
        }

        const binaryString = atob(base64Payload);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decoded = new TextDecoder().decode(bytes);
        const payload = JSON.parse(decoded);

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
          return c.json({ error: 'Unauthorized', debug: 'token_expired' }, 401);
        }

        // Verify issuer (should be Clerk - supports both clerk.com and custom domains)
        if (!payload.iss || (!payload.iss.includes('clerk.') && !payload.iss.includes('.clerk.accounts.'))) {
          return c.json({ error: 'Unauthorized', debug: 'invalid_issuer', iss: payload.iss }, 401);
        }

        // Use the user ID from the token
        const userId = payload.sub;
        if (!userId) {
          return c.json({ error: 'Unauthorized', debug: 'no_user_id' }, 401);
        }

        c.set('userId', userId);
        await next();
      } catch (error) {
        return c.json({ error: 'Unauthorized', debug: String(error) }, 401);
      }
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
