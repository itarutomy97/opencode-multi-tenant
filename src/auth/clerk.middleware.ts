import type { Context, Next } from 'hono';
import { clerkMiddleware, getAuth } from '@hono/clerk-auth';

// 型定義
type ClerkVariables = {
  userId: string;
};

/**
 * Clerk認証ミドルウェア（Hono用）
 * @hono/clerk-authをラップ
 */
export const clerkAuthMiddleware = async (c: Context<{ Variables: ClerkVariables }>, next: Next) => {
  try {
    const auth = getAuth(c);

    if (!auth?.userId) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    c.set('userId', auth.userId);
    await next();
  } catch {
    return c.json({ error: 'Authentication failed' }, 401);
  }
};

/**
 * Clerkミドルウェアを直接エクスポート
 * ルートレベルで使用する場合
 */
export { clerkMiddleware };
