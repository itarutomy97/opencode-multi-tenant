import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenCodeService } from './opencode-client';
import type { SessionDurableObjectState } from '../durable-objects/session-durable-object';

// Mock the SessionDurableObjectState
const mockSessionDurableObject: SessionDurableObjectState = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
  listUserSessions: vi.fn(),
  addMessage: vi.fn(),
  getConversationHistory: vi.fn(),
};

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
    service = new OpenCodeService(
      { apiKey: 'test-api-key' },
      mockSessionDurableObject
    );
  });

  describe('createSession', () => {
    it('新しいOpenCodeセッションを作成できる', async () => {
      // Arrange
      const userId = 'user-123';
      const expectedSession = {
        id: 'opencode-1234567890-abc123',
        userId,
        createdAt: Date.now(),
      };
      vi.mocked(mockSessionDurableObject.createSession).mockResolvedValue(expectedSession);

      // Act
      const session = await service.createSession(userId);

      // Assert
      expect(session).toEqual(expectedSession);
      expect(mockSessionDurableObject.createSession).toHaveBeenCalledWith(userId);
    });

    it('ユーザーIDごとにセッションを分離できる', async () => {
      // Arrange
      const session1 = { id: 's1', userId: 'user-1', createdAt: Date.now() };
      const session2 = { id: 's2', userId: 'user-2', createdAt: Date.now() };
      vi.mocked(mockSessionDurableObject.createSession)
        .mockResolvedValueOnce(session1)
        .mockResolvedValueOnce(session2);

      // Act
      const result1 = await service.createSession('user-1');
      const result2 = await service.createSession('user-2');

      // Assert
      expect(result1.userId).toBe('user-1');
      expect(result2.userId).toBe('user-2');
      expect(result1.id).not.toBe(result2.id);
    });
  });

  describe('sendPrompt', () => {
    it('プロンプトを送信してレスポンスを受け取れる', async () => {
      // Arrange
      const userId = 'user-123';
      const session = { id: 'session-123', userId, createdAt: Date.now() };
      vi.mocked(mockSessionDurableObject.getSession).mockResolvedValue(session);
      vi.mocked(mockSessionDurableObject.addMessage).mockResolvedValue(undefined);
      const prompt = 'Hello, OpenCode!';

      // Act
      const response = await service.sendPrompt(session.id, userId, prompt);

      // Assert
      expect(response).toHaveProperty('text');
      expect(typeof response.text).toBe('string');
      expect(mockSessionDurableObject.addMessage).toHaveBeenCalledWith(
        session.id,
        userId,
        { role: 'user', content: prompt }
      );
    });

    it('存在しないセッションでエラーになる', async () => {
      // Arrange
      vi.mocked(mockSessionDurableObject.getSession).mockResolvedValue(null);
      const sessionId = 'non-existent-session';
      const userId = 'user-123';
      const prompt = 'Test prompt';

      // Act & Assert
      await expect(
        service.sendPrompt(sessionId, userId, prompt)
      ).rejects.toThrow('Session not found or access denied');
    });

    it('他ユーザーのセッションにアクセスできない', async () => {
      // Arrange
      const ownerSession = { id: 'session-1', userId: 'user-1', createdAt: Date.now() };
      vi.mocked(mockSessionDurableObject.getSession).mockResolvedValue(null);
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
      const expected = { id: 'session-123', userId, createdAt: Date.now() };
      vi.mocked(mockSessionDurableObject.getSession).mockResolvedValue(expected);

      // Act
      const retrieved = await service.getSession(expected.id, userId);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(expected.id);
      expect(mockSessionDurableObject.getSession).toHaveBeenCalledWith(expected.id, userId);
    });

    it('存在しないセッションでundefinedを返す', async () => {
      // Arrange
      vi.mocked(mockSessionDurableObject.getSession).mockResolvedValue(null);

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
      const session = { id: 'session-123', userId, createdAt: Date.now() };
      vi.mocked(mockSessionDurableObject.getSession).mockResolvedValue(session);
      vi.mocked(mockSessionDurableObject.deleteSession).mockResolvedValue(true);

      // Act
      const result = await service.deleteSession(session.id, userId);

      // Assert
      expect(result).toBe(true);
      expect(mockSessionDurableObject.deleteSession).toHaveBeenCalledWith(session.id, userId);
    });

    it('存在しないセッションは削除できない', async () => {
      // Arrange
      vi.mocked(mockSessionDurableObject.getSession).mockResolvedValue(null);
      vi.mocked(mockSessionDurableObject.deleteSession).mockResolvedValue(false);

      // Act
      const result = await service.deleteSession('non-existent', 'user-123');

      // Assert
      expect(result).toBe(false);
      expect(mockSessionDurableObject.deleteSession).toHaveBeenCalledWith('non-existent', 'user-123');
    });
  });

  describe('listUserSessions', () => {
    it('ユーザーの全セッションを取得できる', async () => {
      // Arrange
      const userId = 'user-123';
      const sessions = [
        { id: 's1', userId, createdAt: Date.now() },
        { id: 's2', userId, createdAt: Date.now() },
      ];
      vi.mocked(mockSessionDurableObject.listUserSessions).mockResolvedValue(sessions);

      // Act
      const result = await service.listUserSessions(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual(sessions);
      expect(mockSessionDurableObject.listUserSessions).toHaveBeenCalledWith(userId);
    });
  });
});
