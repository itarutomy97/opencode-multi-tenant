import { describe, it, expect } from 'vitest';
import { decodeToken, generateToken } from './jwt';

describe('JWT', () => {
  describe('decodeToken', () => {
    it('有効なトークンでユーザーIDをデコードできる', () => {
      // Arrange
      const userId = 'user-123';
      const token = generateToken(userId, 'test-secret');

      // Act
      const decoded = decodeToken(token, 'test-secret');

      // Assert
      expect(decoded).toHaveProperty('userId', userId);
    });

    it('無効なトークンを拒否できる', () => {
      // Arrange
      const invalidToken = 'invalid.token.here';

      // Act & Assert
      expect(() => decodeToken(invalidToken, 'test-secret')).toThrow();
    });

    it('期限切れトークンを拒否できる', () => {
      // Arrange
      const userId = 'user-123';
      const expiredToken = generateToken(userId, 'test-secret', -1); // 期限切れ

      // Act & Assert
      expect(() => decodeToken(expiredToken, 'test-secret')).toThrow();
    });

    it('シークレットキーが異なるトークンを拒否できる', () => {
      // Arrange
      const token = generateToken('user-123', 'secret-a');

      // Act & Assert
      expect(() => decodeToken(token, 'secret-b')).toThrow();
    });
  });
});
