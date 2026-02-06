import { ApiApp } from './api/app.js';
import { UserStorage } from './storage/user-storage.js';

// 環境変数の取得
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const STORAGE_DIR = process.env.STORAGE_DIR || './data';
const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY || '';

// 必須環境変数のチェック
if (!OPENCODE_API_KEY) {
  console.warn('WARNING: OPENCODE_API_KEY is not set. OpenCode integration will not work.');
}

// アプリケーションの初期化
const app = new ApiApp({
  jwtSecret: JWT_SECRET,
  storageDir: STORAGE_DIR,
});

// ヘルスチェックエンドポイントの追加
app.app.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// サーバー起動
console.log(`Starting OpenCode Multi-Tenant API on port ${PORT}`);
console.log(`Storage directory: ${STORAGE_DIR}`);

export default {
  port: PORT,
  fetch: app.fetch,
};
