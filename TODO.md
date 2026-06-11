# TODO - Cloud Deployment (PostgreSQL + Multi-User Auth)

## ✅ 完了した作業

### Phase 1: PostgreSQL Migration
- [x] SQLiteサポートを削除（PostgreSQL専用に）
- [x] スキーマをPostgreSQL型に変更
  - [x] `timestamp` 型の導入（SQLiteのtext型から変更）
  - [x] `boolean` 型の導入（SQLiteのinteger 0/1から変更）
  - [x] 新カラム追加: `clerkId`, `userType`, `email` in `users`
  - [x] 新テーブル追加: `sessionQuota`, `anonymousRateLimit`
- [x] `docker-compose.yml` にPostgreSQLサービス追加
- [x] `types.ts` をPostgreSQL型に更新（`PostgresJsDatabase`）
- [x] `drizzle.config.ts` をPostgreSQL用に更新
- [x] `client.ts` をPostgreSQL専用に書き換え
- [x] `simulateDb` 機能削除（シンプル化）
- [x] PostgreSQLマイグレーション生成・実行
- [x] SQLite → PostgreSQL データ移行スクリプト作成（`scripts/migrate-sqlite-to-postgres.ts`）
- [x] データ移行実行（98 facts, 29 timeline events, 9 vignettes 等）
- [x] SQLite特有関数の修正
  - [x] `datetime()` → PostgreSQL INTERVAL 構文に変更（`questionSelector.ts`）
  - [x] `PRAGMA wal_checkpoint` 削除（`index.ts`）
- [x] インタビュープロンプト改善
  - [x] 1質問ルール強化（「疑問符は1つの返答に最大1つまで」）

## 🚧 次のステップ

### Phase 2: Clerk Authentication（多人数対応・認証機能）

#### 2.1 Clerk セットアップ
- [ ] Clerkアカウント作成（https://clerk.com）
- [ ] アプリケーション作成・API キー取得
- [ ] 環境変数設定
  - `CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`

#### 2.2 Server Side（Hono）
- [ ] 依存パッケージ追加
  - `@hono/clerk-auth`
  - `@clerk/clerk-sdk-node`
- [ ] Middlewareの実装
  - [ ] `packages/server/src/index.ts` の middleware 更新
    - Clerk JWT検証
    - 認証済みユーザー → clerkId から userId 取得・生成
    - 匿名ユーザー → X-User-Id ヘッダーで識別（既存ロジック維持）
  - [ ] `getOrCreateUserFromClerk()` 関数実装
    - Clerk ユーザー情報から DB レコード作成・取得
    - email, clerkId を保存
- [ ] Rate Limiting 実装
  - [x] Free ユーザー: 3 sessions/day チェック（`sessionQuota` テーブル使用）
  - [x] Anonymous ユーザー: 3 sessions/day チェック（`anonymousRateLimit` テーブル使用）
- [ ] Cleanup Job 追加
  - [ ] Anonymous ユーザー削除（20分 TTL）
  - [ ] Session quota 削除（7日以上古いレコード）

#### 2.3 Client Side（React）
- [ ] 依存パッケージ追加
  - `@clerk/clerk-react`
- [ ] `packages/web/src/main.tsx` 更新
  - [ ] `<ClerkProvider>` でアプリをラップ
  - [ ] `publishableKey` 設定
- [ ] `packages/web/src/App.tsx` 更新
  - [ ] `<SignIn />`, `<SignUp />`, `<UserButton />` コンポーネント追加
  - [ ] 認証状態に応じたUI切り替え
- [ ] Rate Limit エラーハンドリング
  - [ ] 429 エラー時のUI表示（「本日の上限に達しました」）

#### 2.4 Email Verification
- [ ] Clerk Dashboard でメール認証必須に設定
- [ ] Middleware で `auth.user.emailVerified` チェック
- [ ] 未検証ユーザーへのエラーメッセージ実装

### Phase 3: fly.io Deployment

#### 3.1 fly.io セットアップ
- [ ] fly.io アカウント作成
- [ ] fly CLI インストール・ログイン
- [ ] PostgreSQL クラスタ作成
  ```bash
  fly postgres create --name personal-context-db --region nrt --initial-cluster-size 1
  ```
- [ ] アプリ作成・PostgreSQL接続
  ```bash
  fly apps create personal-context
  fly postgres attach personal-context-db --app personal-context
  ```

#### 3.2 デプロイ設定
- [ ] `fly.toml` 作成（既に設計済み）
- [ ] Secrets 設定
  ```bash
  fly secrets set CLERK_PUBLISHABLE_KEY=...
  fly secrets set CLERK_SECRET_KEY=...
  fly secrets set LLM_PROVIDER=...
  fly secrets set OPENAI_API_KEY=... # or other LLM provider
  ```
- [ ] Google Cloud TTS 設定（オプショナル）
  - [ ] GCP サービスアカウントキーを Secrets に設定

#### 3.3 初回デプロイ
- [ ] `fly deploy`
- [ ] マイグレーション実行確認
- [ ] 動作確認
  - [ ] Anonymous user フロー
  - [ ] Sign up → Email verification → Session 作成
  - [ ] Rate limit テスト

### Phase 4: Testing & Documentation

#### 4.1 テスト
- [ ] ローカル（PostgreSQL）動作確認
- [ ] Anonymous ユーザーフロー
- [ ] Registered ユーザーフロー（Clerk連携）
- [ ] Rate limit 動作確認
- [ ] Cleanup job 動作確認

#### 4.2 ドキュメント更新
- [ ] README.md 更新
  - [ ] PostgreSQL セットアップ手順追加
  - [ ] Clerk セットアップ手順追加
  - [ ] fly.io デプロイ手順追加
- [ ] README.ja.md 更新（README.md と同期）
- [ ] `.env.example` 更新
  - [ ] `DATABASE_URL` 追加
  - [ ] `CLERK_*` 環境変数追加

## 📝 メモ

### 設計判断
- **SQLite 削除**: ローカルでも PostgreSQL を使用（シンプル化）
- **simulateDb 削除**: テストはトランザクションロールバックで対応（将来実装）
- **匿名→登録移行なし**: 匿名ユーザーは20分で消える、登録ユーザーは新規スタート

### 環境変数
```bash
# PostgreSQL
DATABASE_URL=postgresql://personal_context:personal_context@localhost:5432/personal_context

# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Optional: Google Cloud TTS
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-tts-key.json
```

### マイグレーション
既存データの移行は `pnpm migrate:sqlite-to-postgres` で実行済み。

### 参考ドキュメント
- 設計書: `docs/features/CLOUD_DEPLOYMENT_DESIGN.md`
- Clerk Docs: https://clerk.com/docs
- fly.io Docs: https://fly.io/docs
