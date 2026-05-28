# SOLID原則チェックリスト

## Single Responsibility Principle (SRP)

- [ ] 各クラス/関数は1つの責任のみを持つか
- [ ] "and"や"or"で説明が必要な場合は分割すべき

## Open/Closed Principle (OCP)

- [ ] 拡張に対して開いているか
- [ ] 変更に対して閉じているか
- [ ] 新機能追加時に既存コードを変更していないか

## Liskov Substitution Principle (LSP)

- [ ] 派生クラスは基底クラスと置き換え可能か
- [ ] オーバーライドで動作が予想外に変わっていないか

## Interface Segregation Principle (ISP)

- [ ] インターフェースは小さく焦点を絞っているか
- [ ] 使わないメソッドを実装していないか

## Dependency Inversion Principle (DIP)

- [ ] 高レベルモジュールが低レベルモジュールに依存していないか
- [ ] 抽象に依存しているか
