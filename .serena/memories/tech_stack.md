# CQM 技術スタック

## 実行環境
- **Node.js**: 20.x LTS 以上
- **npm**: 10.2.0 以上
- **TypeScript**: 5.3+

## 開発フレームワーク
- **Monorepo**: Turborepo
- **パッケージマネージャー**: npm workspaces
- **モジュール解決**: ESNext + bundler

## コア技術
- **MCP**: @modelcontextprotocol/sdk
- **ベクトルDB**: Qdrant (default)
- **埋め込み**: OpenAI text-embedding-3-small + Ollama対応
- **メタデータDB**: SQLite 3 + Drizzle ORM

## 開発ツール
- **テスト**: Vitest + v8 coverage
- **リント/フォーマット**: Biome
- **型チェック**: TypeScript strict mode
- **トランスパイル**: ESBuild

## パッケージ構成
```
packages/
├── core/           # MCPサーバーコア
├── server/         # MCPサーバー実装
├── rag/           # RAGエンジン
├── rag-engine/    # レガシーRAGエンジン
├── shared/        # 共通型・ユーティリティ
├── cli/           # cqm CLI
└── plugins/       # 公式プラグイン
```

## 外部統合
- **Docker**: Qdrant実行環境
- **GitHub**: Issues/Projects API
- **Obsidian**: Vault監視・解析
- **各種AI**: Claude, GPT, Gemini等