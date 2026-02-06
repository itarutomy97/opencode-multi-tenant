import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
}

/**
 * JWTトークンを生成する
 * @param userId ユーザーID
 * @param secret シークレットキー
 * @param expirationHours 有効期限（時間）。デフォルトは24時間。負の値で即座に期限切れ
 */
export function generateToken(
  userId: string,
  secret: string,
  expirationHours: number = 24
): string {
  const payload: TokenPayload = { userId };

  if (expirationHours < 0) {
    // 過去の有効期限を設定（テスト用）
    return jwt.sign(payload, secret, { expiresIn: '0s' });
  }

  return jwt.sign(payload, secret, { expiresIn: `${expirationHours}h` });
}

/**
 * JWTトークンをデコード・検証する
 * @param token JWTトークン
 * @param secret シークレットキー
 * @returns デコードされたペイロード
 * @throws 無効なトークンの場合
 */
export function decodeToken(token: string, secret: string): TokenPayload {
  const decoded = jwt.verify(token, secret) as TokenPayload;
  return decoded;
}
