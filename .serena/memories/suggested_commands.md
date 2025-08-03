# CQM 推奨コマンド一覧

## セットアップ・起動
```bash
# 初回セットアップ
npm install
npm run setup

# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build
```

## 開発コマンド
```bash
# 全パッケージ開発モード
npm run dev

# 特定パッケージ開発
cd packages/server && npm run dev
cd packages/rag && npm run dev
cd packages/cli && npm run dev
```

## テスト関連
```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ付きテスト
npm run test:coverage

# 特定パッケージテスト
cd packages/server && npm test
```

## 品質チェック
```bash
# リント実行
npm run lint

# 型チェック
npm run type-check

# 全品質チェック（リント+型チェック+テスト）
npm run lint && npm run type-check && npm test
```

## クリーンアップ
```bash
# ビルド成果物削除
npm run clean

# node_modules完全削除
npm run clean && rm -rf node_modules && npm install
```

## Git操作（推奨フロー）
```bash
# 機能ブランチ作成
git checkout -b feature/issue-123-description

# Conventional Commits
git commit -m "feat(core): add new plugin system"
git commit -m "fix(rag): resolve memory leak in indexing"
git commit -m "docs(api): update MCP tools documentation"
```

## システムユーティリティ（Linux）
- **ファイル操作**: `ls -la`, `find . -name "*.ts"`, `grep -r "pattern"`
- **プロセス**: `ps aux | grep node`, `kill -9 PID`
- **ネットワーク**: `netstat -tulpn`, `curl -X GET localhost:3000`
- **システム**: `df -h`, `free -h`, `top`