import { mkdir, writeFile, readFile, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * ユーザー別ファイルストレージ
 * 各ユーザーのファイルを安全に分離して管理する
 */
export class UserStorage {
  constructor(private readonly baseDir: string) {}

  /**
   * ユーザーディレクトリパスを取得する
   */
  private getUserDir(userId: string): string {
    // ユーザーIDをサニタイズ（パストラバーサル防止）
    const sanitizedId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return join(this.baseDir, sanitizedId);
  }

  /**
   * ユーザーディレクトリを確保する
   */
  async ensureUserDir(userId: string): Promise<void> {
    const userDir = this.getUserDir(userId);
    if (!existsSync(userDir)) {
      await mkdir(userDir, { recursive: true });
    }
  }

  /**
   * ファイルを書き込む
   */
  async writeFile(userId: string, filename: string, content: string): Promise<void> {
    await this.ensureUserDir(userId);
    const filePath = join(this.getUserDir(userId), this.sanitizeFilename(filename));
    await writeFile(filePath, content, 'utf-8');
  }

  /**
   * ファイルを読み込む
   * @returns ファイル内容またはnull（存在しない場合）
   */
  async readFile(userId: string, filename: string): Promise<string | null> {
    const filePath = join(this.getUserDir(userId), this.sanitizeFilename(filename));

    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch {
      return null;
    }
  }

  /**
   * ユーザーのファイル一覧を取得する
   */
  async listFiles(userId: string): Promise<string[]> {
    const userDir = this.getUserDir(userId);

    if (!existsSync(userDir)) {
      return [];
    }

    try {
      return await readdir(userDir);
    } catch {
      return [];
    }
  }

  /**
   * ファイルを削除する
   * @returns 削除成功ならtrue、失敗ならfalse
   */
  async deleteFile(userId: string, filename: string): Promise<boolean> {
    const filePath = join(this.getUserDir(userId), this.sanitizeFilename(filename));

    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ファイル名をサニタイズ（パストラバーサル防止）
   */
  private sanitizeFilename(filename: string): string {
    // パス関連の文字を除去
    return filename.replace(/[\/\\]/g, '_').replace(/\.\./g, '');
  }
}
