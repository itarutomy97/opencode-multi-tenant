import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { clerkAuthMiddleware } from '../auth/clerk.middleware.js';
import { SessionManager } from '../session/session-manager.js';

// 型定義
type Variables = {
  userId: string;
};

type Bindings = {};

export interface ApiConfig {
  jwtSecret?: string; // 互換性のため残す（非推奨）
  storageDir: string;
  useClerk?: boolean; // Clerk使用フラグ
}

// 型付きHonoアプリケーション
type AppType = Hono<{
  Variables: Variables;
  Bindings: Bindings;
}>;

/**
 * メインAPIアプリケーション
 */
export class ApiApp {
  readonly app: AppType;
  private sessionManager: SessionManager;

  constructor(config: ApiConfig) {
    this.sessionManager = new SessionManager();
    this.app = new Hono() as AppType;

    this.setupRoutes(config.useClerk ?? true);
  }

  /**
   * 認証ミドルウェア（JWT - 非推奨、後方互換性のみ）
   * @deprecated Clerk認証を使用してください
   */
  private jwtAuthMiddleware = async (c: Context<{ Variables: Variables }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);

    try {
      // 動的インポートで循環依存を回避
      const { decodeToken } = await import('../auth/jwt.js');
      const payload = decodeToken(token, process.env.JWT_SECRET || 'secret');
      c.set('userId', payload.userId);
      await next();
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  };

  private setupRoutes(useClerk: boolean) {
    // 認証ミドルウェアを選択
    const authMiddleware = useClerk ? clerkAuthMiddleware : this.jwtAuthMiddleware;

    // セッション管理エンドポイント（認証必要）
    const sessionRoutes = new Hono<{ Variables: Variables }>();
    sessionRoutes.use(authMiddleware);

    // セッション作成
    sessionRoutes.post('/', (c) => {
      const userId = c.get('userId');
      const session = this.sessionManager.createSession(userId);
      return c.json(session, 201);
    });

    // セッション取得
    sessionRoutes.get('/:id', (c) => {
      const userId = c.get('userId');
      const sessionId = c.req.param('id');
      const session = this.sessionManager.getSession(sessionId, userId);

      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }

      return c.json(session);
    });

    // セッション削除
    sessionRoutes.delete('/:id', (c) => {
      const userId = c.get('userId');
      const sessionId = c.req.param('id');
      this.sessionManager.deleteSession(sessionId, userId);
      return c.body(null, 204);
    });

    this.app.route('/sessions', sessionRoutes);
  }

  /**
   * テスト用ヘルパー: トークン生成（JWTのみ）
   * @deprecated 使用推奨しません
   */
  async generateTestToken(userId: string): Promise<string> {
    const { generateToken } = await import('../auth/jwt.js');
    return generateToken(userId, 'test-secret');
  }

  /**
   * リクエスト処理（テスト用）
   */
  async request(path: string, init?: RequestInit): Promise<Response> {
    const url = `http://localhost${path}`;
    return this.app.request(url, init);
  }

  /**
   * Fetchハンドラー取得（デプロイ用）
   */
  get fetch(): typeof this.app.fetch {
    return this.app.fetch;
  }
}
