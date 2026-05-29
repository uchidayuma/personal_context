# Demo Deployment Design

## 目的

「Dockerなしで2分で試せる」公開デモ環境を提供し、OSS拡散の摩擦を下げる。  
データは画面を閉じると消えることを明示した上で、匿名で利用可能にする。

---

## 基本方針

- **認証なし** — サインアップ不要。即座に使い始められる
- **データは揮発性** — タブを閉じると消える（sessionStorage + サーバー側TTL）
- **APIキーは運営側が負担** — ただしターン数制限でコストを管理
- **セルフホスト版とコード共有** — `DEMO_MODE` 環境変数で挙動を切り替えるだけ

---

## ユーザー識別の仕組み

### フロントエンド

```typescript
// アプリ起動時に sessionStorage から userId を取得 or 新規生成
function getDemoUserId(): string {
  let id = sessionStorage.getItem('demo_user_id')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('demo_user_id', id)
  }
  return id
}
```

- `sessionStorage` はタブを閉じると自動で消える → クライアント側の削除処理は不要
- 全APIリクエストに `X-User-Id: <uuid>` ヘッダーを付与

### サーバーサイド

```typescript
// middleware: X-User-Id ヘッダーがあれば使う、なければ DEFAULT_USER_ID
app.use('*', async (c, next) => {
  const userId = c.req.header('X-User-Id') ?? DEFAULT_USER_ID
  c.set('userId', userId)
  c.set('db', db)
  await next()
})
```

変更はミドルウェア1行のみ。エンジン層は既存のまま動く。

---

## データ削除

### TTLベースのサーバー側クリーンアップ

デモ環境では `DEMO_MODE=true` のとき、1時間おきに古いユーザーデータを削除する。

- 対象: `sessions.createdAt` が2時間以上前のユーザーの全データ
- 削除対象テーブル: `sessions`, `messages`, `structured_facts`, `user_questions`, `users`
- `DEFAULT_USER_ID`（セルフホスト用）は削除しない

```typescript
// DEMO_MODE=true のときのみ起動
if (process.env.DEMO_MODE === 'true') {
  setInterval(cleanupExpiredDemoUsers, 60 * 60 * 1000) // 1時間おき
}
```

---

## ターン数制限（コスト管理）

デモ環境では1セッションあたり最大 **3ターン** に制限する。

- `DEMO_MODE=true` かつ `remainingTurns <= 0` のとき、セッション終了メッセージを返す
- 「続きはセルフホスト版で」というCTAをUIに表示する
- APIキーは運営側が負担。ユーザーにAPIキー入力を求めない（UXの摩擦を排除し、かつユーザーの資産を守る）

## レート制限（1日1セッション）

**なぜsessionStorage UUIDで識別しないのか**:  
sessionStorageはタブを閉じると消えるため、開くたびに新しいUUIDが生成される。同一ユーザーの識別に使えない。

**解決策: IPアドレスベースのレート制限**

```
データ識別: sessionStorage UUID（タブ閉じで消える → プライバシー保護）
レート制限: クライアントIPで1日1セッション作成まで
```

- `POST /api/sessions` 時にIPを確認し、当日すでにセッションが存在する場合は `429` を返す
- DB に `demo_rate_limit` テーブル: `{ ip, date, sessionCount }`
- 日付が変わると自動リセット（TTLクリーンアップと同じジョブで処理）

---

## デモ専用UI

`DEMO_MODE=true` のとき、画面上部にバナーを表示する:

```
このデモはタブを閉じるとデータが消えます。
続けて使うには → セルフホスト版のセットアップ
```

---

## デプロイ先: Railway

Railway を選ぶ理由:
- Docker Compose をほぼそのまま使える
- 無料枠: $5/月クレジット（小規模デモなら十分）
- 環境変数の管理が簡単

必要な環境変数:
```
DEMO_MODE=true
LLM_PROVIDER=anthropic  # or openai
ANTHROPIC_API_KEY=...
NODE_ENV=production
```

---

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `packages/server/src/index.ts` | X-User-Id ヘッダーを userId として使うミドルウェア |
| `packages/server/src/db/cleanup.ts` | TTLベースのデモユーザー削除ジョブ（新規） |
| `packages/web/src/lib/userId.ts` | sessionStorage UUID生成ユーティリティ（新規） |
| `packages/web/src/App.tsx` | デモバナー表示 + 全fetchに X-User-Id ヘッダー付与 |
| `railway.toml` | Railway デプロイ設定（新規） |
| `docs/spec/openapi.yml` | X-User-Id ヘッダーをセキュリティスキームに追加 |

---

## やらないこと

- ユーザー登録・ログイン（不要）
- クレジットカード・課金（無料デモのまま）
- データの永続化オプション（セルフホスト版の役割）
- WebSocket / リアルタイム同期
