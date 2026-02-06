import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clerkAuthMiddleware } from './clerk.middleware';
import { Hono } from 'hono';

// @hono/clerk-authのモック
const mockGetAuth = vi.fn();

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: vi.fn(),
  getAuth: () => mockGetAuth(),
}));

// 型定義
type TestVariables = {
  userId: string;
};

describe('ClerkMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('clerkAuthMiddleware', () => {
    it('有効なClerkセッションでuserIdを取得できる', async () => {
      // Arrange
      mockGetAuth.mockReturnValue({
        userId: 'clerk-user-456',
      });

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', clerkAuthMiddleware);
      app.get('/test', (c) => {
        const userId = c.get('userId');
        return c.json({ userId });
      });

      // Act
      const response = await app.request('/test');

      // Assert
      expect(response.status).toBe(200);
      const body = await response.json() as { userId: string };
      expect(body.userId).toBe('clerk-user-456');
    });

    it('無効なセッションを拒否できる（401）', async () => {
      // Arrange
      mockGetAuth.mockReturnValue({
        userId: null,
      });

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', clerkAuthMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      // Act
      const response = await app.request('/test');

      // Assert
      expect(response.status).toBe(401);
      const body = await response.json() as { error: string };
      expect(body.error).toBe('Unauthorized');
    });

    it('getAuthが例外を投げた場合401を返す', async () => {
      // Arrange
      mockGetAuth.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', clerkAuthMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      // Act
      const response = await app.request('/test');

      // Assert
      expect(response.status).toBe(401);
    });

    it('undefined authの場合401を返す', async () => {
      // Arrange
      mockGetAuth.mockReturnValue(undefined);

      const app = new Hono<{ Variables: TestVariables }>();
      app.use('*', clerkAuthMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      // Act
      const response = await app.request('/test');

      // Assert
      expect(response.status).toBe(401);
    });
  });
});
