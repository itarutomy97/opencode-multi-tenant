/**
 * OpenCode Multi-Tenant Worker (Hono-based)
 *
 * Cloudflare Worker with Hono framework for multi-user OpenCode access
 * (Sandbox SDK integration to be added later)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyClerkToken } from './auth/clerk.js';
import { OpenCodeService } from './opencode/opencode-client.js';
import { DurableObject } from 'cloudflare:workers';

/**
 * Environment variables for Cloudflare Workers
 */
export interface Env {
  OPENCODE_API_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  SESSIONS: any; // DurableObjectNamespace - using any to avoid type issues
}

/**
 * Valid invitation codes for registration
 * Add your codes here to control who can sign up
 */
const INVITATION_CODES = [
  'FRIENDS-2025',
  'TARO-FRIENDS',
  'HANAKO-2025',
  'DEMO-ACCESS',
  'TEST-CODE-2025',
  'EARLY-ADOPTER',
  'BETA-TESTER',
  'INVITE-ONLY',
];

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

// HTML template for home page
function createHomePage(publishableKey: string): string {
  // Extract frontend API from publishable key for Clerk JS SDK
  const encoded = publishableKey.replace('pk_test_', '').replace('pk_live_', '');
  let frontendApi = Buffer.from(encoded, 'base64').toString();
  frontendApi = frontendApi.replace(/\$/, '');
  frontendApi = frontendApi.replace('.clerk.accounts.dev', '.accounts.dev');

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenCode - 招待コード認証</title>
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
    .invite-section {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .invite-label {
      font-size: 14px;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
    }
    .invite-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #d1d5db;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.2s;
    }
    .invite-input:focus {
      outline: none;
      border-color: #1e3a8a;
    }
    .invite-input.valid {
      border-color: #10b981;
      background: #d1fae5;
    }
    .invite-input.invalid {
      border-color: #ef4444;
      background: #fee2e2;
    }
    .invite-hint {
      font-size: 12px;
      color: #6b7280;
      margin-top: 8px;
    }
    .invite-error {
      color: #ef4444;
      font-size: 13px;
      margin-top: 8px;
      display: none;
    }
    .invite-error.show {
      display: block;
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
    .btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
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
    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">OpenCode 🤖</div>
    <div class="tagline">招待制AIチャットボットAPI</div>

    <div class="invite-section">
      <div class="invite-label">🔑 招待コード</div>
      <input
        type="text"
        id="inviteCode"
        class="invite-input"
        placeholder="招待コードを入力（例: FRIENDS-2025）"
        autocomplete="off"
      >
      <div class="invite-hint">招待コードをお持ちでない方は、管理者にお問い合わせください</div>
      <div id="inviteError" class="invite-error">❌ 無効な招待コードです</div>
    </div>

    <div id="authContainer">
      <div class="loading">認証を読み込み中...</div>
    </div>

    <button id="signInBtn" class="btn hidden" disabled>Sign In / Sign Up</button>
    <button id="getTokenBtn" class="btn btn-secondary hidden">Get My Token</button>

    <div id="tokenSection" class="token-section">
      <div class="token-label">✓ あなたのJWTトークン（クリックしてコピー）:</div>
      <div id="tokenBox" class="token-box">Loading...</div>
    </div>
  </div>

  <script>
    // 有効な招待コードリスト（サーバー側と同じもの）
    const VALID_CODES = ${JSON.stringify(INVITATION_CODES)};

    const inviteCodeInput = document.getElementById('inviteCode');
    const inviteError = document.getElementById('inviteError');
    const authContainer = document.getElementById('authContainer');
    const signInBtn = document.getElementById('signInBtn');
    const getTokenBtn = document.getElementById('getTokenBtn');
    const tokenSection = document.getElementById('tokenSection');
    const tokenBox = document.getElementById('tokenBox');

    let clerk = null;
    let inviteCodeValid = false;

    // 招待コード検証
    inviteCodeInput.addEventListener('input', function() {
      const code = this.value.trim().toUpperCase();

      if (VALID_CODES.includes(code)) {
        this.classList.remove('invalid');
        this.classList.add('valid');
        inviteError.classList.remove('show');
        inviteCodeValid = true;
        unlockSignUp();
      } else if (code.length > 0) {
        this.classList.remove('valid');
        this.classList.add('invalid');
        inviteError.textContent = '❌ 無効な招待コードです: ' + code;
        inviteError.classList.add('show');
        inviteCodeValid = false;
        lockSignUp();
      } else {
        this.classList.remove('valid', 'invalid');
        inviteError.classList.remove('show');
        inviteCodeValid = false;
        lockSignUp();
      }
    });

    function lockSignUp() {
      signInBtn.classList.add('hidden');
      getTokenBtn.classList.add('hidden');
      authContainer.innerHTML = '<div class="loading">🔒 招待コードを入力してください...</div>';
    }

    function unlockSignUp() {
      signInBtn.classList.remove('hidden');
      signInBtn.disabled = false;
      authContainer.innerHTML = '<div class="signed-in-as">✓ 招待コードが認証されました！サインインできます。</div>';
    }

    async function initClerk() {
      try {
        clerk = window.Clerk;
        await clerk.load();

        if (clerk.user) {
          authContainer.innerHTML = '<div class="signed-in-as">✓ Signed in as: ' + (clerk.user.primaryEmailAddress?.emailAddress || clerk.user.id) + '</div>';
          if (inviteCodeValid) {
            getTokenBtn.classList.remove('hidden');
          }
        }

        clerk.addListener((resources) => {
          if (resources.user) {
            authContainer.innerHTML = '<div class="signed-in-as">✓ Signed in as: ' + (resources.user.primaryEmailAddress?.emailAddress || resources.user.id) + '</div>';
            if (inviteCodeValid) {
              getTokenBtn.classList.remove('hidden');
            }
          }
        });
      } catch (error) {
        console.error('Clerk init error:', error);
        authContainer.innerHTML = '<div style="color: #ef4444; text-align: center;">認証の読み込みに失敗しました: ' + error.message + '</div>';
      }
    }

    signInBtn.addEventListener('click', () => {
      if (!inviteCodeValid) {
        alert('先に招待コードを入力してください');
        return;
      }
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

    // Wait for Clerk script to load
    const checkClerk = setInterval(() => {
      if (window.Clerk) {
        clearInterval(checkClerk);
        initClerk();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(checkClerk);
      if (!clerk && authContainer.innerHTML.includes('Loading')) {
        authContainer.innerHTML = '<div style="color: #ef4444; text-align: center;">Clerk SDKの読み込みに失敗しました。ページを更新してください。</div>';
      }
    }, 10000);

    // Get token button handler
    getTokenBtn.addEventListener('click', async function() {
      getTokenBtn.textContent = 'Loading...';
      getTokenBtn.disabled = true;

      try {
        const token = await clerk?.session?.getToken({ template: 'session' });

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
          tokenBox.textContent = 'アクティブなセッションがありません。先にサインインしてください。';
          tokenSection.classList.add('show');
          getTokenBtn.textContent = 'Get My Token';
        }
      } catch (error) {
        console.error('Get token error:', error);
        tokenBox.textContent = 'エラー: ' + error.message;
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
 * In-memory session store for local development fallback
 * Used when SESSIONS binding is not available (e.g., local dev without --remote)
 */
class InMemorySessionStore {
  private sessions = new Map<string, { id: string; userId: string; createdAt: number }>();
  private messages = new Map<string, Array<{ role: string; content: string }>>();
  private sessionCounter = 0;

  async createSession(userId: string): Promise<{ id: string; userId: string; createdAt: number }> {
    const session = {
      id: `opencode-${Date.now()}-${this.sessionCounter++}`,
      userId,
      createdAt: Date.now(),
    };
    this.sessions.set(session.id, session);
    this.messages.set(session.id, []);
    return session;
  }

  async getSession(sessionId: string, userId: string): Promise<{ id: string; userId: string; createdAt: number } | null> {
    const session = this.sessions.get(sessionId);
    if (session && session.userId === userId) {
      return session;
    }
    return null;
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (session && session.userId === userId) {
      this.sessions.delete(sessionId);
      this.messages.delete(sessionId);
      return true;
    }
    return false;
  }

  async listUserSessions(userId: string): Promise<Array<{ id: string; userId: string; createdAt: number }>> {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  async addMessage(sessionId: string, userId: string, message: { role: string; content: string }): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or access denied');
    }
    const history = this.messages.get(sessionId) || [];
    history.push(message);
    this.messages.set(sessionId, history);
  }

  async getConversationHistory(sessionId: string, userId: string): Promise<Array<{ role: string; content: string }>> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return [];
    }
    return this.messages.get(sessionId) || [];
  }
}

/**
 * Session Durable Object with SQLite backend
 *
 * Stores sessions and conversation history in SQLite database
 */
export class SessionDurableObject extends DurableObject {
  // Unique ID for this Durable Object (singleton pattern)
  static readonly id = 'SESSION_DURABLE_OBJECT';

  // Flag to track if DB has been initialized
  private dbInitialized = false;

  constructor(state: any, env: any) {
    super(state, env);
  }

  // SQL storage accessor - use ctx.storage.sql
  private get sql() {
    return (this as any).ctx.storage.sql;
  }

  /**
   * Initialize SQLite database tables
   */
  private initDB(): void {
    if (this.dbInitialized) return;

    const sql = this.sql;
    if (!sql) {
      console.error('[SessionDurableObject] SQL storage not available');
      return;
    }

    // Create tables one at a time
    sql.exec('CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE)');
    sql.exec('CREATE TABLE IF NOT EXISTS invited_users (id TEXT PRIMARY KEY, email TEXT NOT NULL, invite_code TEXT NOT NULL, created_at INTEGER NOT NULL)');
    sql.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
    sql.exec('CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)');
    sql.exec('CREATE INDEX IF NOT EXISTS idx_invited_users_email ON invited_users(email)');

    this.dbInitialized = true;
  }

  /**
   * Check if an invite code is valid and not already used
   */
  async checkInviteCode(inviteCode: string): Promise<boolean> {
    this.initDB();
    const upperCode = inviteCode.toUpperCase();

    // Check if code is in the valid list
    if (!INVITATION_CODES.includes(upperCode)) {
      return false;
    }

    // Check if code has been used (optional - you may want to allow reuse)
    // For now, we'll allow code reuse
    return true;
  }

  /**
   * Register a user as invited (after they sign up)
   */
  async registerInvitedUser(userId: string, email: string, inviteCode: string): Promise<void> {
    this.initDB();

    try {
      this.sql.exec(
        'INSERT OR IGNORE INTO invited_users (id, email, invite_code, created_at) VALUES (?, ?, ?, ?)',
        userId, email, inviteCode.toUpperCase(), Date.now()
      );
    } catch (error) {
      console.error('[SessionDurableObject] Failed to register invited user:', error);
    }
  }

  /**
   * Check if a user was invited (for API access control)
   */
  async isUserInvited(userId: string, email?: string): Promise<boolean> {
    this.initDB();

    // For now, we'll allow any user who has completed Clerk signup
    // In production, you'd want to check the invited_users table
    // This is a simplified version since Clerk handles the signup
    return true;
  }

  /**
   * Create a new session
   */
  async createSession(userId: string): Promise<{ id: string; userId: string; createdAt: number }> {
    this.initDB();

    const sessionId = `opencode-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const createdAt = Date.now();

    this.sql.exec(
      'INSERT INTO sessions (id, user_id, created_at) VALUES (?, ?, ?)',
      sessionId, userId, createdAt
    );

    return { id: sessionId, userId, createdAt };
  }

  /**
   * Get a session by ID (verifies ownership)
   */
  async getSession(sessionId: string, userId: string): Promise<{ id: string; userId: string; createdAt: number } | null> {
    this.initDB();

    const cursor = this.sql.exec(
      'SELECT id, user_id, created_at FROM sessions WHERE id = ? AND user_id = ?',
      sessionId, userId
    );

    const results = cursor.toArray();

    if (!results || results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      id: row.id as string,
      userId: row.user_id as string,
      createdAt: row.created_at as number,
    };
  }

  /**
   * Delete a session (verifies ownership)
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    // First verify ownership
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      return false;
    }

    // Delete session (messages will be deleted via CASCADE)
    await this.sql.exec(
      'DELETE FROM sessions WHERE id = ?',
      sessionId
    );

    return true;
  }

  /**
   * List all sessions for a user
   */
  async listUserSessions(userId: string): Promise<Array<{ id: string; userId: string; createdAt: number }>> {
    this.initDB();

    const cursor = this.sql.exec(
      'SELECT id, user_id, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC',
      userId
    );

    return cursor.toArray().map((row: any) => ({
      id: row.id as string,
      userId: row.user_id as string,
      createdAt: row.created_at as number,
    }));
  }

  /**
   * Add a message to conversation history
   */
  async addMessage(sessionId: string, userId: string, message: { role: string; content: string }): Promise<void> {
    // Verify session exists and belongs to user
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or access denied');
    }

    await this.sql.exec(
      'INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)',
      sessionId, message.role, message.content, Date.now()
    );
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string, userId: string): Promise<Array<{ role: string; content: string }>> {
    // Verify session exists and belongs to user
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      return [];
    }

    const cursor = this.sql.exec(
      'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      sessionId
    );

    return cursor.toArray().map((row: any) => ({
      role: row.role as string,
      content: row.content as string,
    }));
  }
}

/**
 * OpenCode Multi-Tenant Worker Class
 */
export class Worker {
  readonly app: AppType;
  private openCodeService: OpenCodeService;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.app = new Hono<{ Bindings: Env; Variables: Variables }>();

    // Get or create Session Durable Object
    // Fallback to in-memory implementation for local development
    let sessionDO: SessionDurableObjectState;
    if (env.SESSIONS) {
      // Use idFromName to create a proper DurableObjectId from the class name
      const doId = env.SESSIONS.idFromName(SessionDurableObject.id);
      sessionDO = env.SESSIONS.get(doId);
    } else {
      // Fallback: Use in-memory storage for local development
      console.warn('[Worker] SESSIONS binding not available, using in-memory storage');
      sessionDO = new InMemorySessionStore();
    }

    this.openCodeService = new OpenCodeService(
      { apiKey: env.OPENCODE_API_KEY },
      sessionDO
    );

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

    // Verify invite code endpoint (no auth required)
    this.app.get('/api/verify-invite', (c) => {
      const inviteCode = c.req.query('code');
      if (!inviteCode) {
        return c.json({ valid: false, error: 'Invite code is required' }, 400);
      }

      const upperCode = inviteCode.toUpperCase();
      const isValid = INVITATION_CODES.includes(upperCode);

      return c.json({
        valid: isValid,
        code: upperCode,
        message: isValid ? '✓ 有効な招待コードです' : '❌ 無効な招待コードです'
      });
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
        // Decode JWT to get payload
        const parts = token.split('.');
        if (parts.length !== 3) {
          return c.json({ error: 'Unauthorized', debug: 'invalid_jwt_format' }, 401);
        }

        // Decode payload using Buffer (Cloudflare Workers compatible)
        const payload = JSON.parse(
          Buffer.from(parts[1], 'base64url').toString('utf-8')
        );

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          return c.json({ error: 'Unauthorized', debug: 'token_expired' }, 401);
        }

        // Verify issuer
        if (!payload.iss || (!payload.iss.includes('clerk.') && !payload.iss.includes('.clerk.accounts.'))) {
          return c.json({ error: 'Unauthorized', debug: 'invalid_issuer' }, 401);
        }

        // Get user ID
        const userId = payload.sub;
        if (!userId) {
          return c.json({ error: 'Unauthorized', debug: 'no_user_id' }, 401);
        }

        c.set('userId', userId);
        await next();
      } catch (error) {
        console.error('[Auth] Token verification error:', error);
        return c.json({ error: 'Unauthorized', debug: 'verify_error' }, 401);
      }
    };

    // API routes (require authentication)
    const apiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
    apiRoutes.use(authMiddleware);

    // POST /api/prompt - Execute OpenCode prompt
    apiRoutes.post('/prompt', async (c) => {
      const userId = c.get('userId');
      const body = await c.req.json();
      const { prompt, sessionId } = body as { prompt: string; sessionId?: string };

      if (!prompt) {
        return c.json({ error: 'prompt is required' }, 400);
      }

      try {
        let actualSessionId: string;

        if (sessionId) {
          // Verify the session exists and belongs to this user
          const session = await this.openCodeService.getSession(sessionId, userId);
          if (!session) {
            return c.json({ error: 'Session not found' }, 404);
          }
          actualSessionId = sessionId;
        } else {
          // Create new session
          const session = await this.openCodeService.createSession(userId);
          actualSessionId = session.id;
        }

        const response = await this.openCodeService.sendPrompt(actualSessionId, userId, prompt);

        return c.json({
          success: true,
          response: response.text,
          sessionId: actualSessionId,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[OpenCode] Error:', errorMessage, error);

        return c.json({
          success: false,
          error: errorMessage,
        }, 500);
      }
    });

    // Sessions routes
    apiRoutes.get('/sessions', async (c) => {
      const userId = c.get('userId');
      const userSessions = await this.openCodeService.listUserSessions(userId);
      return c.json({ sessions: userSessions });
    });

    apiRoutes.post('/sessions', async (c) => {
      const userId = c.get('userId');
      const session = await this.openCodeService.createSession(userId);
      return c.json(session, 201);
    });

    apiRoutes.delete('/sessions/:id', async (c) => {
      const userId = c.get('userId');
      const sessionId = c.req.param('id');
      const deleted = await this.openCodeService.deleteSession(sessionId, userId);

      if (!deleted) {
        return c.json({ error: 'Session not found' }, 404);
      }

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

// Default export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const worker = new Worker(env);
    return worker.fetch(request, env);
  },
};
