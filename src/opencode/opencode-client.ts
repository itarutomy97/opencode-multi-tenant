import type { SessionDurableObjectState } from '../durable-objects/session-durable-object.js';

export interface OpenCodeSession {
  id: string;
  userId: string;
  createdAt: number;
}

export interface OpenCodeConfig {
  apiKey: string;
}

export interface PromptResponse {
  text: string;
}

/**
 * OpenCode Zen APIと通信するクライアント
 * ユーザーごとにリクエストを分離して管理する
 *
 * Durable Objectsを使用してセッションを永続化
 */
export class OpenCodeService {
  private apiKey: string;
  private sessionDurableObject: SessionDurableObjectState;
  // OpenCode Zenのエンドポイントとデフォルトモデル（無料モデルを使用）
  private readonly apiEndpoint = 'https://opencode.ai/zen/v1/chat/completions';
  private readonly defaultModel = 'glm-4.7-free'; // 無料のGLMモデル

  constructor(config: OpenCodeConfig, sessionDurableObject: SessionDurableObjectState) {
    this.apiKey = config.apiKey;
    this.sessionDurableObject = sessionDurableObject;
  }

  /**
   * 新しいセッションを作成する
   */
  async createSession(userId: string): Promise<OpenCodeSession> {
    return await this.sessionDurableObject.createSession(userId);
  }

  /**
   * プロンプトを送信する（OpenCode Zen API）
   */
  async sendPrompt(sessionId: string, userId: string, prompt: string): Promise<PromptResponse> {
    const session = await this.sessionDurableObject.getSession(sessionId, userId);

    if (!session) {
      throw new Error('Session not found or access denied');
    }

    // ユーザーのメッセージを追加
    await this.sessionDurableObject.addMessage(sessionId, userId, { role: 'user', content: prompt });

    // 会話履歴を取得
    const conversationHistory = await this.sessionDurableObject.getConversationHistory(sessionId, userId);

    // OpenCode Zen APIを呼び出す
    const response = await this.callOpenCodeAPI(conversationHistory);

    // アシスタントのメッセージを追加
    await this.sessionDurableObject.addMessage(sessionId, userId, { role: 'assistant', content: response });

    return { text: response };
  }

  /**
   * OpenCode Zen APIを呼び出す
   */
  private async callOpenCodeAPI(messages: Array<{role: string, content: string}>): Promise<string> {
    try {
      const requestBody = {
        model: this.defaultModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false
      };

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenCode API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // レスポンスからテキストを抽出
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
      }

      throw new Error('Invalid response format from OpenCode API');
    } catch (error) {
      // エラーハンドリング: API呼び出し失敗時はフォールバック
      console.error('OpenCode API call failed:', error);

      // フォールバック: エラーメッセージを返す
      if (error instanceof Error) {
        return `[エラー] API呼び出しに失敗しました: ${error.message}`;
      }
      return '[エラー] 不明なエラーが発生しました';
    }
  }

  /**
   * セッションを取得する
   */
  async getSession(sessionId: string, userId: string): Promise<OpenCodeSession | undefined> {
    return await this.sessionDurableObject.getSession(sessionId, userId) || undefined;
  }

  /**
   * セッションを削除する
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    return await this.sessionDurableObject.deleteSession(sessionId, userId);
  }

  /**
   * ユーザーの全セッションを取得する
   */
  async listUserSessions(userId: string): Promise<OpenCodeSession[]> {
    return await this.sessionDurableObject.listUserSessions(userId);
  }

  /**
   * セッションの会話履歴を取得する
   */
  async getConversationHistory(sessionId: string, userId: string): Promise<Array<{role: string, content: string}>> {
    return await this.sessionDurableObject.getConversationHistory(sessionId, userId);
  }
}
