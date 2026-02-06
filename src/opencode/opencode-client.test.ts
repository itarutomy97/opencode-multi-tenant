import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenCodeService } from './opencode-client';

vi.mock('@opencode-ai/sdk', () => {
  let sessionCounter = 0;

  return {
    default: class MockOpencode {
      constructor(config: any) {
        this.config = config;
      }
      config: any;

      session = {
        create: vi.fn().mockImplementation(({ model }: any) => Promise.resolve({
          id: `opencode-session-${sessionCounter++}`,
          model: model || 'gpt-4o',
        })),
        prompt: vi.fn().mockResolvedValue({
          text: 'Test response',
        }),
      };
    },
  };
});

describe('OpenCodeService', () => {
  let service: OpenCodeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OpenCodeService({
      apiKey: 'test-api-key',
    });
  });

  describe('createSession', () => {
    it('新しいOpenCodeセッションを作成できる', async () => {
      // Arrange
      const userId = 'user-123';
      const model = 'claude-3-5-sonnet';

      // Act
      const session = await service.createSession(userId, model);

      // Assert
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('userId', userId);
      expect(session).toHaveProperty('model', model);
    });

    it('ユーザーIDごとにセッションを分離できる', async () => {
      // Arrange
      const session1 = await service.createSession('user-1', 'gpt-4o');
      const session2 = await service.createSession('user-2', 'gpt-4o');

      // Act & Assert
      expect(session1.userId).toBe('user-1');
      expect(session2.userId).toBe('user-2');
      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('sendPrompt', () => {
    it('プロンプトを送信してレスポンスを受け取れる', async () => {
      // Arrange
      const userId = 'user-123';
      const model = 'claude-3-5-sonnet';
      const session = await service.createSession(userId, model);
      const prompt = 'Hello, OpenCode!';

      // Act
      const response = await service.sendPrompt(session.id, userId, prompt);

      // Assert
      expect(response).toHaveProperty('text');
      expect(typeof response.text).toBe('string');
    });

    it('存在しないセッションでエラーになる', async () => {
      // Arrange
      const sessionId = 'non-existent-session';
      const userId = 'user-123';
      const prompt = 'Test prompt';

      // Act & Assert
      await expect(
        service.sendPrompt(sessionId, userId, prompt)
      ).rejects.toThrow('Session not found');
    });

    it('他ユーザーのセッションにアクセスできない', async () => {
      // Arrange
      const ownerSession = await service.createSession('user-1', 'gpt-4o');
      const otherUserId = 'user-2';

      // Act & Assert
      await expect(
        service.sendPrompt(ownerSession.id, otherUserId, 'Test')
      ).rejects.toThrow('Session not found or access denied');
    });
  });

  describe('getSession', () => {
    it('存在するセッションを取得できる', async () => {
      // Arrange
      const userId = 'user-123';
      const created = await service.createSession(userId, 'gpt-4o');

      // Act
      const retrieved = await service.getSession(created.id, userId);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('存在しないセッションでundefinedを返す', async () => {
      // Act
      const session = await service.getSession('non-existent', 'user-123');

      // Assert
      expect(session).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('セッションを削除できる', async () => {
      // Arrange
      const userId = 'user-123';
      const session = await service.createSession(userId, 'gpt-4o');

      // Act
      await service.deleteSession(session.id, userId);
      const retrieved = await service.getSession(session.id, userId);

      // Assert
      expect(retrieved).toBeUndefined();
    });
  });
});
