# CLAUDE.md — このプロジェクトでの作業ルール

## 設計ファースト原則

**実装の前に必ず設計を書く。**

新機能・仕様変更・アーキテクチャの変更を行う場合、以下の順序を守ること：

1. **設計書・哲学を `docs/*` に書く**（または既存ドキュメントを更新する）
2. ユーザーに確認を取る
3. 実装する

設計書には「何を作るか（What）」だけでなく、**「なぜその設計にするのか（Why）」** を必ず記述する。  
将来のコントリビューターや自分自身が、設計の意図を理解して一貫した改修ができるようにするため。

### ドキュメント一覧

| ファイル                                          | 役割                                                     |
| ------------------------------------------------- | -------------------------------------------------------- |
| `docs/vision/PHILOSOPHY.ja.md` | このプロジェクトの設計哲学・こだわり、設計哲学の日本語原文（英語版の源泉）|
| `docs/vision/PHILOSOPHY.md`    | 英語翻訳版（PHILOSOPHY.ja.mdを更新したら合わせて更新）|
| `docs/vision/PRD.md`                              | プロダクトのビジョン・要件定義                           |
| `docs/vision/CONTEXT_LAYERS.md`                   | L1〜L10 同心円モデルの定義（設計の根幹）                 |
| `docs/spec/SPEC.md`                               | 技術仕様（テーブル設計・アルゴリズム・APIなど）          |
| `docs/spec/openapi.yml`                           | OpenAPI 定義                                             |
| `docs/spec/TESTING_DESIGN.md`                     | テスト設計（Vitest / MSW / Playwright）                  |
| `docs/design/OUTPUT_DESIGN.md`                    | 出力（Markdownエクスポート）の設計哲学                   |
| `docs/design/INTERVIEW_POLICY.md`                 | インタビューの質問方針・体験設計                         |
| `docs/features/ONBOARDING_DESIGN.md`              | オンボーディングセッションの設計（コールドスタート解消） |
| `docs/features/IMPORT_DESIGN.md`                  | ドキュメントインポート機能の設計                         |
| `docs/features/CONTEXT_DASHBOARD_DESIGN.md`       | コンテキストダッシュボードの設計                         |
| `docs/features/L1_L10_IMPLEMENTATION_DESIGN.md`   | L1〜L10 全レイヤー対応の実装設計                         |
| `docs/features/VOICE_INPUT_DESIGN.md`             | 音声対話モードの設計                                     |
| `docs/features/MCP_DESIGN.md`                     | MCPサーバーの設計（Claude Code / Codex連携）             |
| `docs/features/DEMO_DEPLOYMENT_DESIGN.md`         | 公開デモ環境の設計（匿名マルチユーザー・データ揮発性）   |
| `docs/features/I18N_DESIGN.md`                    | 多言語対応の設計（JA/EN切り替え・react-i18next・質問翻訳）|
| `docs/output_template/`                           | 出力ファイルのテンプレート（L01〜L10 + life_chapters）   |

新しい機能領域には対応するドキュメントを追加する。

### ドキュメント整合性チェック

設計書・仕様書を更新したとき、または実装が完了したときは、以下の観点でドキュメント間の矛盾がないか確認する：

- ファイル名・パスの表記が全ドキュメントで統一されているか
- 出力ファイル構成の記述が一致しているか
- CLAUDE.md のドキュメント一覧に漏れがないか
- リンクが正しいパスを指しているか

### README同期ルール

**`README.md` と `README.ja.md` は常に同期させること。**

片方を変更したときは、必ずもう片方にも対応する変更を反映する：
- 新機能の説明を追加 → 両方に追加
- セットアップ手順を変更 → 両方に反映
- 構成やリンクを修正 → 両方に反映

どちらか片方だけ更新して放置しない。

### API変更時のルール

**`packages/server/src/routes/` 以下のファイルを変更するときは、必ず `docs/spec/openapi.yml` も確認・更新すること。**

具体的には：
- レスポンスのフィールド追加・削除・型変更 → `openapi.yml` の対応スキーマを更新
- 新しいエンドポイントの追加 → `openapi.yml` に `paths` エントリを追加
- エラーレスポンスの変更 → `openapi.yml` のエラースキーマを更新

実装と `openapi.yml` の乖離はテストで検出されるが、乖離を作らないことが原則。

## 開発フロー（TDD）

**設計書 → テスト → 実装 の順序を守る。**

1. `docs/*` に設計書を書き、ユーザーに確認を取る
2. 設計書に基づいてテストを先に書く（Red）
3. テストが通るように実装する（Green）
4. リファクタリング（Refactor）

**新しいAPIエンドポイントを追加するとき：**
1. `docs/spec/openapi.yml` にエンドポイントを定義
2. `packages/server/src/routes/*.test.ts` にテストを書く
3. `packages/server/src/routes/*.ts` に実装する

テストは `jest-openapi` の `toSatisfyApiSpec()` を使い、openapi.yml との整合性を自動検証する。

## コマンドの実行

シェルコマンドの実行はユーザーに任せる。  
実行が必要な場合はコマンドをテキストで提示すること。
