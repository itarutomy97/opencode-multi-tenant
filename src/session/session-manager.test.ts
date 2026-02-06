import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './session-manager';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  describe('createSession', () => {
    it('新しいセッションを作成できる', () => {
      // Arrange
      const userId = 'user-123';

      // Act
      const session = sessionManager.createSession(userId);

      // Assert
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('userId', userId);
      expect(session).toHaveProperty('createdAt');
      expect(typeof session.id).toBe('string');
      expect(typeof session.createdAt).toBe('number');
    });

    it('ユーザーIDごとにセッションを分離できる', () => {
      // Arrange
      const user1Session = sessionManager.createSession('user-1');
      const user2Session = sessionManager.createSession('user-2');

      // Act & Assert
      expect(user1Session.userId).toBe('user-1');
      expect(user2Session.userId).toBe('user-2');
      expect(user1Session.id).not.toBe(user2Session.id);
    });
  });

  describe('getSession', () => {
    it('存在するセッションを取得できる', () => {
      // Arrange
      const userId = 'user-123';
      const created = sessionManager.createSession(userId);

      // Act
      const retrieved = sessionManager.getSession(created.id, userId);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('存在しないセッションの取得でundefinedを返す', () => {
      // Arrange
      const sessionId = 'non-existent-id';
      const userId = 'user-123';

      // Act
      const session = sessionManager.getSession(sessionId, userId);

      // Assert
      expect(session).toBeUndefined();
    });

    it('他ユーザーのセッション取得を拒否できる', () => {
      // Arrange
      const ownerSession = sessionManager.createSession('user-1');
      const otherUserId = 'user-2';

      // Act
      const session = sessionManager.getSession(ownerSession.id, otherUserId);

      // Assert
      expect(session).toBeUndefined();
    });
  });

  describe('deleteSession', () => {
    it('セッションを削除できる', () => {
      // Arrange
      const userId = 'user-123';
      const session = sessionManager.createSession(userId);

      // Act
      sessionManager.deleteSession(session.id, userId);
      const retrieved = sessionManager.getSession(session.id, userId);

      // Assert
      expect(retrieved).toBeUndefined();
    });

    it('他ユーザーのセッション削除を無視する', () => {
      // Arrange
      const ownerSession = sessionManager.createSession('user-1');
      const otherUserId = 'user-2';

      // Act - 他ユーザーが削除を試みる
      sessionManager.deleteSession(ownerSession.id, otherUserId);
      const retrieved = sessionManager.getSession(ownerSession.id, 'user-1');

      // Assert - セッションは残っている
      expect(retrieved).toBeDefined();
    });
  });
});
