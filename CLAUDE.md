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
| `docs/vision/PHILOSOPHY.md`                       | このプロジェクトの設計哲学・こだわり                     |
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
| `docs/output_template/`                           | 出力ファイルのテンプレート（L01〜L10 + life_chapters）   |

新しい機能領域には対応するドキュメントを追加する。

### ドキュメント整合性チェック

設計書・仕様書を更新したとき、または実装が完了したときは、以下の観点でドキュメント間の矛盾がないか確認する：

- ファイル名・パスの表記が全ドキュメントで統一されているか
- 出力ファイル構成の記述が一致しているか
- CLAUDE.md のドキュメント一覧に漏れがないか
- リンクが正しいパスを指しているか

## コマンドの実行

シェルコマンドの実行はユーザーに任せる。  
実行が必要な場合はコマンドをテキストで提示すること。
