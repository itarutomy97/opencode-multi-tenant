import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserStorage } from './user-storage';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('UserStorage', () => {
  let storage: UserStorage;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'user-storage-test-'));
    storage = new UserStorage(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('writeFile', () => {
    it('ユーザー別ディレクトリにファイルを保存できる', async () => {
      // Arrange
      const userId = 'user-123';
      const filename = 'test.txt';
      const content = 'Hello, World!';

      // Act
      await storage.writeFile(userId, filename, content);

      // Assert
      const readContent = await storage.readFile(userId, filename);
      expect(readContent).toBe(content);
    });

    it('日本語コンテンツを保存できる', async () => {
      // Arrange
      const userId = 'user-123';
      const filename = 'japanese.txt';
      const content = 'こんにちは、世界！';

      // Act
      await storage.writeFile(userId, filename, content);

      // Assert
      const readContent = await storage.readFile(userId, filename);
      expect(readContent).toBe(content);
    });
  });

  describe('readFile', () => {
    it('ユーザー自身のファイルのみ読み取りできる', async () => {
      // Arrange
      const user1 = 'user-1';
      const user2 = 'user-2';
      const filename = 'secret.txt';
      await storage.writeFile(user1, filename, 'user1 data');

      // Act & Assert
      const content1 = await storage.readFile(user1, filename);
      expect(content1).toBe('user1 data');

      // user2はuser1のファイルを読めない
      const content2 = await storage.readFile(user2, filename);
      expect(content2).toBeNull();
    });

    it('存在しないファイルでnullを返す', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      const content = await storage.readFile(userId, 'nonexistent.txt');

      // Assert
      expect(content).toBeNull();
    });
  });

  describe('ensureUserDir', () => {
    it('ユーザーディレクトリを作成できる', async () => {
      // Arrange
      const userId = 'user-123';

      // Act
      await storage.ensureUserDir(userId);

      // Assert - ディレクトリが存在することを確認
      // （writeFile/readFile経由で間接的に確認される）
      await storage.writeFile(userId, 'test.txt', 'content');
      const content = await storage.readFile(userId, 'test.txt');
      expect(content).toBe('content');
    });
  });

  describe('listFiles', () => {
    it('ユーザーのファイル一覧を取得できる', async () => {
      // Arrange
      const user1 = 'user-1';
      const user2 = 'user-2';
      await storage.writeFile(user1, 'file1.txt', 'content1');
      await storage.writeFile(user1, 'file2.txt', 'content2');
      await storage.writeFile(user2, 'file3.txt', 'content3');

      // Act
      const user1Files = await storage.listFiles(user1);
      const user2Files = await storage.listFiles(user2);

      // Assert
      expect(user1Files).toHaveLength(2);
      expect(user1Files).toContain('file1.txt');
      expect(user1Files).toContain('file2.txt');

      expect(user2Files).toHaveLength(1);
      expect(user2Files).toContain('file3.txt');
    });
  });

  describe('deleteFile', () => {
    it('ファイルを削除できる', async () => {
      // Arrange
      const userId = 'user-123';
      const filename = 'to-delete.txt';
      await storage.writeFile(userId, filename, 'content');

      // Act
      const deleted = await storage.deleteFile(userId, filename);

      // Assert
      expect(deleted).toBe(true);
      const content = await storage.readFile(userId, filename);
      expect(content).toBeNull();
    });

    it('他ユーザーのファイルを削除できない', async () => {
      // Arrange
      const user1 = 'user-1';
      const user2 = 'user-2';
      const filename = 'protected.txt';
      await storage.writeFile(user1, filename, 'content');

      // Act - user2がuser1のファイルを削除しようとする
      const deleted = await storage.deleteFile(user2, filename);

      // Assert
      expect(deleted).toBe(false);
      const content = await storage.readFile(user1, filename);
      expect(content).toBe('content');
    });
  });
});
