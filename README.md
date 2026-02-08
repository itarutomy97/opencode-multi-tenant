# OpenCode Multi-Tenant API

OpenCode SDKを使用したマルチユーザー対応のAIエージェントAPIサーバー。Cloudflare Workers + Hono + Clerk 認証で構築されています。

## 機能

- **Clerk認証**: セキュアなWeb認証（Clerk JS SDK統合）
- **セッション管理**: ユーザーごとのAIセッションを分離管理
- **OpenCode SDK統合**: 複数のLLMプロバイダー対応
- **REST API**: Honoベースの高速APIエンドポイント
- **Cloudflare Workers**: サーバーレスデプロイ対応

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数設定

`.dev.vars` または `.env` に以下を設定：

```bash
# OpenCode API
OPENCODE_API_KEY=your-opencode-api-key

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

### 3. ローカル開発

```bash
# 開発サーバー起動（Cloudflare Workers）
npm run dev

# 別のポートで起動
npx wrangler dev --port 8788
```

### 4. Clerk トークンの取得

1. ブラウザで `http://localhost:8788/` にアクセス
2. "Sign In / Sign Up" ボタンをクリック
3. Clerkでサインイン
4. "Get My Token" ボタンをクリック
5. 表示されたトークンをクリックしてコピー

## APIエンドポイント

### ヘルスチェック

```bash
curl http://localhost:8788/health
```

### セッション管理（認証が必要）

```bash
# セッション作成
curl -X POST http://localhost:8788/api/sessions \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN"

# セッション一覧
curl http://localhost:8788/api/sessions \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN"

# セッション削除
curl -X DELETE http://localhost:8788/api/sessions/SESSION_ID \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN"
```

### プロンプト実行

```bash
curl -X POST http://localhost:8788/api/prompt \
  -H "Authorization: Bearer YOUR_CLERK_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, AI!"}'
```

## デプロイ

```bash
# Cloudflare Workers にデプロイ
npm run deploy
```

デプロイ後、`https://your-worker.workers.dev/` にアクセスしてトークンを取得できます。

## 環境変数

| 変数 | 説明 | 必須 |
|------|------|------|
| `OPENCODE_API_KEY` | OpenCode APIキー | ✅ |
| `CLERK_SECRET_KEY` | Clerk Secret Key | ✅ |
| `CLERK_PUBLISHABLE_KEY` | Clerk Publishable Key | ✅ |

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Web UI)                                              │
│  - サインイン                                                   │
│  - JWTトークン取得                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ JWTトークン
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Workers (Hono)                                     │
│  - /health : ヘルスチェック                                     │
│  - /api/sessions : セッション管理                               │
│  - /api/prompt : OpenCodeプロンプト実行                         │
│  - 認証ミドルウェア (Clerk JWT検証)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  OpenCode API    │
                    └──────────────────┘
```

## テスト

```bash
npm test
```

## ライセンス

MIT License
