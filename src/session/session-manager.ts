export interface Session {
  id: string;
  userId: string;
  createdAt: number;
}

/**
 * マルチユーザーセッションマネージャー
 * ユーザーごとのセッションを安全に分離して管理する
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private idCounter = 0;

  /**
   * 新しいセッションを作成する
   * @param userId ユーザーID
   * @returns 作成されたセッション
   */
  createSession(userId: string): Session {
    const id = `session-${this.idCounter++}`;
    const session: Session = {
      id,
      userId,
      createdAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * セッションを取得する
   * @param sessionId セッションID
   * @param userId リクエストしたユーザーID（所有権確認用）
   * @returns セッションまたはundefined
   */
  getSession(sessionId: string, userId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    // セッションが存在し、所有者が一致する場合のみ返す
    if (session && session.userId === userId) {
      return session;
    }
    return undefined;
  }

  /**
   * セッションを削除する
   * @param sessionId セッションID
   * @param userId リクエストしたユーザーID（所有権確認用）
   */
  deleteSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    // 所有者のみ削除可能
    if (session && session.userId === userId) {
      this.sessions.delete(sessionId);
    }
  }
}
