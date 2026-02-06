import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiApp } from './app';

// @hono/clerk-authのモック
const mockGetAuth = vi.fn();

vi.mock('@hono/clerk-auth', () => ({
  clerkMiddleware: vi.fn(),
  getAuth: () => mockGetAuth(),
}));

interface SessionResponse {
  id: string;
  userId: string;
  createdAt: number;
}

describe('ApiApp with Clerk', () => {
  let app: ApiApp;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new ApiApp({
      jwtSecret: 'test-secret', // 互換性のため残す
      storageDir: '/tmp/test-opencode-storage',
      useClerk: true, // Clerkを使用
    });
  });

  describe('POST /sessions', () => {
    it('Clerk認証済みユーザーで新規セッション作成', async () => {
      // Arrange
      mockGetAuth.mockReturnValue({
        userId: 'clerk-user-123',
      });

      // Act
      const response = await app.request('/sessions', {
        method: 'POST',
      });

      // Assert
      expect(response.status).toBe(201);
      const body = await response.json() as SessionResponse;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('userId');
    });

    it('Clerk認証なしで401を返す', async () => {
      // Arrange
      mockGetAuth.mockReturnValue({
        userId: null,
      });

      // Act
      const response = await app.request('/sessions', {
        method: 'POST',
      });

      // Assert
      expect(response.status).toBe(401);
      const body = await response.json() as { error: string };
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('GET /sessions/:id', () => {
    it('所有するセッションを取得できる', async () => {
      // Arrange
      const userId = 'clerk-user-456';
      mockGetAuth.mockReturnValue({ userId });

      // まずセッションを作成
      const createResponse = await app.request('/sessions', {
        method: 'POST',
      });
      const createdSession = await createResponse.json() as SessionResponse;

      // Act
      const response = await app.request(`/sessions/${createdSession.id}`, {
        method: 'GET',
      });

      // Assert
      expect(response.status).toBe(200);
      const body = await response.json() as SessionResponse;
      expect(body.id).toBe(createdSession.id);
    });

    it('存在しないセッションで404を返す', async () => {
      // Arrange
      mockGetAuth.mockReturnValue({
        userId: 'clerk-user-789',
      });

      // Act
      const response = await app.request('/sessions/non-existent', {
        method: 'GET',
      });

      // Assert
      expect(response.status).toBe(404);
      const body = await response.json() as { error: string };
      expect(body.error).toBe('Session not found');
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('所有するセッションを削除できる', async () => {
      // Arrange
      const userId = 'clerk-user-delete';
      mockGetAuth.mockReturnValue({ userId });

      // まずセッションを作成
      const createResponse = await app.request('/sessions', {
        method: 'POST',
      });
      const createdSession = await createResponse.json() as SessionResponse;

      // Act
      const deleteResponse = await app.request(`/sessions/${createdSession.id}`, {
        method: 'DELETE',
      });

      // Assert
      expect(deleteResponse.status).toBe(204);

      // 削除確認
      const getResponse = await app.request(`/sessions/${createdSession.id}`, {
        method: 'GET',
      });
      expect(getResponse.status).toBe(404);
    });
  });
});
