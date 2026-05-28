---
name: code-review
description: |
    GitHubのIssueやPR、またはローカルのgit diffを解析し、専門的なコードレビューを実行します。
    単なるコード品質の確認だけでなく、Issueの要件と実装内容を突き合わせ、要件を満たしているか（要件充足性）を厳格に検証します。
    SOLID原則、セキュリティ、パフォーマンス、プロジェクト固有の規約に基づいた指摘を行います。
---

# Code Review Expert

専門的なコードレビューを実施します。GitHub issue/PR と連携して要件充足を検証し、SOLID 原則、セキュリティ、パフォーマンス、エラーハンドリング、境界条件をチェックし、プロジェクト固有のコンベンションにも準拠しているか確認します。

## 入力パターン

このスキルは以下の 3 パターンの入力に対応する:

### パターン A: issue URL + PR URL

```
/code-review
issue: https://github.com/owner/repo/issues/123
pr: https://github.com/owner/repo/pull/456
```

### パターン B: issue URL + ローカル diff

```
/code-review
issue: https://github.com/owner/repo/issues/123
```

→ PR URL がない場合はローカルの `git diff` を使用

### パターン C: 要件テキスト直接入力 + PR URL またはローカル diff

```
/code-review
要件: ユーザーのプロフィール画像をアップロードできるようにする。最大5MB、jpg/png対応。
pr: https://github.com/owner/repo/pull/456
```

→ 要件テキストが直接渡された場合はそれを使用

**入力が何も指定されていない場合**: ユーザーに「issue URL または要件テキスト」と「PR URL またはローカル diff」のどちらを使うか確認する。

## ワークフロー

### Step 0: 入力の解析と要件の取得

**issue URL が渡された場合:**

1. `gh issue view <number> --repo <owner/repo>` で issue の内容を取得
2. issue のタイトル、本文、ラベル、コメントから要件を抽出
3. Acceptance Criteria（受け入れ条件）があれば特に注目する

**要件テキストが直接渡された場合:**

1. テキストをそのまま要件として使用

**取得した要件を以下の形式で整理:**

-   機能要件（何を実現すべきか）
-   非機能要件（パフォーマンス、セキュリティ等の制約）
-   受け入れ条件（具体的な完了基準）
-   スコープ外（明示的に除外されているもの）

### Step 1: 変更内容の取得

**PR URL が渡された場合:**

1. `gh pr view <number> --repo <owner/repo>` で PR の概要を取得
2. `gh pr diff <number> --repo <owner/repo>` で diff を取得
3. PR の description、コメント、レビューコメントも確認

**PR URL がない場合:**

1. `git diff --staged` でステージ済みの変更を確認
2. ステージ済みがなければ `git diff` で未ステージの変更を確認
3. 変更されたファイルをリストアップ

### Step 2: プロジェクトコンテキストの確認

1. `references/project-context.md` を読み込む
2. プロジェクト固有のコンベンションを把握する
3. 変更対象ファイルと類似した既存ファイルを 2-3 個探して読む
4. 既存のパターンを理解する

### Step 3: 要件充足チェック

issue または要件テキストから抽出した要件と、実際の変更内容を突き合わせる:

-   **実装済み**: 要件を満たしているもの
-   **未実装**: 要件に含まれるが実装されていないもの
-   **部分実装**: 一部のみ実装されているもの
-   **スコープ外の変更**: 要件にないが追加されているもの

各項目について、具体的にどのファイルのどの部分が該当するか示す。

### Step 4: プロジェクト適合性チェック

以下の観点で既存コードと比較:

-   ファイル命名規則に従っているか
-   インポート順序は既存と一致しているか
-   エラーハンドリングパターンは既存と一致しているか
-   既存の類似ファイルと同じパターンを使っているか

具体的に「既存の ○○.php と同じパターンを使うべき」と指摘する。

### Step 5: SOLID + Architecture

`references/solid-checklist.md` を参照してチェック:

-   Single Responsibility Principle 違反
-   Open/Closed Principle 違反
-   Liskov Substitution Principle 違反
-   Interface Segregation Principle 違反
-   Dependency Inversion Principle 違反

### Step 6: Removal Candidates

`references/removal-plan.md` を参照:

-   デッドコード・未使用コードを特定
-   安全な削除計画を提案

### Step 7: Security Scan

`references/security-checklist.md` を参照:

-   XSS、インジェクション、SSRF、競合状態
-   認証・認可の抜け穴
-   シークレット漏洩

### Step 8: Code Quality

`references/code-quality-checklist.md` を参照:

-   エラーハンドリング（swallowed exceptions、async errors）
-   パフォーマンス（N+1 クエリ、キャッシュ欠落）
-   境界条件（null 処理、空コレクション、off-by-one）

### Step 9: Output

以下の形式で結果を出力:

## コードレビュー結果

### 要件充足状況

| 要件                       | ステータス                   | 備考           |
| -------------------------- | ---------------------------- | -------------- |
| [issue から抽出した要件 1] | 実装済み / 未実装 / 部分実装 | [具体的な説明] |
| [issue から抽出した要件 2] | 実装済み / 未実装 / 部分実装 | [具体的な説明] |

**スコープ外の変更**: [要件にないが追加されている変更があれば記載]
