# OpenCode Multi-Tenant API

OpenCode SDKを使用したマルチユーザー対応のAIエージェントAPIサーバー。ユーザーごとにセッションとファイルを安全に分離して管理します。

## 機能

- **JWT認証**: セキュアなトークンベース認証
- **セッション管理**: ユーザーごとのAIセッションを分離管理
- **ファイル管理**: ユーザー別ディレクトリでファイルを安全に分離
- **OpenCode SDK統合**: 複数のLLMプロバイダー対応（Claude、GPT-4、Gemini等）
- **REST API**: Honoベースの高速APIエンドポイント
- **Docker対応**: ワンコマンドでデプロイ可能

## セットアップ

### ローカル開発

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .envを編集してAPIキー等を設定

# 開発サーバー起動
npm run dev

# テスト実行
npm test

# 型チェック
npm run typecheck
```

### Dockerデプロイ

```bash
# docker-composeで起動
docker-compose up -d

# ビルドのみ
docker build -t opencode-multi-tenant .

# 手動実行
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secret \
  -e OPENCODE_API_KEY=your-api-key \
  -v opencode-data:/app/data \
  opencode-multi-tenant
```

## 環境変数

| 変数 | 説明 | デフォルト値 |
|------|------|-------------|
| `PORT` | サーポート番号 | `3000` |
| `JWT_SECRET` | JWT署名シークレット | `change-this-in-production` |
| `OPENCODE_API_KEY` | OpenCode APIキー | 必須 |
| `STORAGE_DIR` | ファイル保存ディレクトリ | `./data` |
| `NODE_ENV` | 実行環境 | `production` |

## APIエンドポイント

### 認証

#### POST /auth/login
JWTトークンを発行します。

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "password": "password"}'
```

レスポンス:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### セッション管理

#### POST /sessions
新しいセッションを作成します。

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### GET /sessions/:id
セッションを取得します。

```bash
curl http://localhost:3000/sessions/session-0 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### DELETE /sessions/:id
セッションを削除します。

```bash
curl -X DELETE http://localhost:3000/sessions/session-0 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### ヘルスチェック

#### GET /health
サーバーの状態を確認します。

```bash
curl http://localhost:3000/health
```

レスポンス:
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T01:22:00.000Z",
  "uptime": 123.456
}
```

## セキュリティ

- **ユーザー分離**: 全てのデータはユーザーIDで分離されており、他ユーザーのデータにアクセスすることはできません
- **JWT認証**: 全ての保護エンドポイントでJWTトークンが必要です
- **ファイルサニタイズ**: パストラバーサル攻撃を防止するため、ファイル名とユーザーIDをサニタイズしています
- **Docker隔離**: コンテナ内で実行されるため、ホストシステムから分離されています

## テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:coverage
```

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。バグ報告や機能リクエストはIssueにてお願いします。
