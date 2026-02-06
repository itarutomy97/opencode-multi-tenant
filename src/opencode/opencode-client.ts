// @ts-ignore - OpenCode SDK may not have proper types
import Opencode from '@opencode-ai/sdk';

export interface OpenCodeSession {
  id: string;
  userId: string;
  model: string;
  createdAt: number;
}

export interface OpenCodeConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface PromptResponse {
  text: string;
}

/**
 * OpenCode SDKをラップしたマルチユーザーサービス
 * ユーザーごとにOpenCodeセッションを安全に分離して管理する
 */
export class OpenCodeService {
  private client: Opencode;
  private sessions: Map<string, OpenCodeSession> = new Map();
  private sessionCounter = 0;

  constructor(config: OpenCodeConfig) {
    this.client = new Opencode({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  }

  /**
   * 新しいOpenCodeセッションを作成する
   */
  async createSession(userId: string, model: string = 'gpt-4o'): Promise<OpenCodeSession> {
    // OpenCode SDKでセッション作成
    const sdkSession = await this.client.session.create({ model });

    const session: OpenCodeSession = {
      id: sdkSession.id || `opencode-${this.sessionCounter++}`,
      userId,
      model: sdkSession.model || model,
      createdAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * プロンプトを送信する
   */
  async sendPrompt(sessionId: string, userId: string, prompt: string): Promise<PromptResponse> {
    const session = this.sessions.get(sessionId);

    if (!session || session.userId !== userId) {
      throw new Error(session ? 'Session not found or access denied' : 'Session not found');
    }

    // OpenCode SDKでプロンプト送信
    const response = await this.client.session.prompt(sessionId, prompt);
    return {
      text: response.text || response.content || '',
    };
  }

  /**
   * セッションを取得する
   */
  async getSession(sessionId: string, userId: string): Promise<OpenCodeSession | undefined> {
    const session = this.sessions.get(sessionId);

    // 所有者のみアクセス可能
    if (session && session.userId === userId) {
      return session;
    }

    return undefined;
  }

  /**
   * セッションを削除する
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session || session.userId !== userId) {
      return false;
    }

    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * ユーザーの全セッションを取得する
   */
  listUserSessions(userId: string): OpenCodeSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }
}
