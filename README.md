# CQ Models! 🎯

> "CQ CQ CQ, calling all models!" - 統一されたコンテキストで、すべてのAIモデルが連携する世界へ

**CQM** (CQ Models! - Contextual Query Manager) は、複数のAIモデル（Claude, GPT, Gemini等）に統一的にコンテキストを提供する開発支援システムです。アマチュア無線の「CQ（各局呼び出し）」のメタファーを使用し、どのAIツールからでも同じ開発コンテキストにアクセスできます。

## ✨ 特徴

- **🔄 統一コンテキスト**: どのAIモデルでも同じ開発コンテキストを参照
- **📚 知識の永続化**: 開発履歴とパターンの蓄積
- **🔀 シームレスな切り替え**: AIツール間での自由な移動
- **🔒 プライバシー重視**: ローカル実行による完全な制御
- **🧩 プラグイン架構**: 拡張可能なプラグインシステム

## 🏗️ アーキテクチャ

```
CQ Models! System
├── Core Components
│   ├── MCP Server (接続管理)
│   ├── RAG Engine (検索エンジン)
│   └── Plugin Loader (拡張機構)
├── Storage Layer
│   ├── Qdrant (ベクトルDB)
│   ├── SQLite (メタデータ)
│   └── File System (設定・ログ)
└── Plugins
    ├── FileSystem Plugin
    ├── GitHub Plugin
    └── Community Plugins
```

## 🚀 クイックスタート

### 前提条件

- Node.js 20.x LTS
- Docker (Qdrant用)
- メモリ 4GB以上

### インストール

```bash
# CQMをインストール
npm install -g @cqm/cli

# Qdrantを起動
docker run -p 6333:6333 qdrant/qdrant

# CQMサーバーを開始
cqm start

# 状態確認
cqm status
```

### 基本的な使い方

```bash
# プロジェクトコンテキストを取得
cqm search "現在の実装状況"

# インデックスの管理
cqm index list
cqm index rebuild

# プラグイン管理
cqm plugin list
cqm plugin enable github
```

## 📁 プロジェクト構成

```
cqm/
├── packages/
│   ├── core/           # MCPサーバーコア
│   ├── rag-engine/     # RAGエンジン
│   ├── cli/            # cqm CLI
│   └── plugins/        # 公式プラグイン
├── docs/              # 設計文書 (Obsidian Vault)
├── examples/          # 設定例
└── docker/            # Docker設定
```

## 🔌 対応AIツール

### 現在対応済み
- **Cursor**: エディタ統合
- **Claude Desktop**: MCP経由
- **汎用MCPクライアント**: 標準プロトコル

### 計画中
- **VS Code Extension**: エディタ拡張
- **ChatGPT Plugin**: OpenAI統合
- **Gemini Integration**: Google AI統合

## 📚 ドキュメント

- **[要件定義書](docs/01_Requirements/CQM-REQ-001-v1.1_要件定義書.md)**: プロジェクト仕様
- **[文書管理ガイドライン](docs/12_Policies/CQM-POL-001_文書管理ガイドライン.md)**: 開発文書体系
- **[設計タスクリスト](docs/09_Tasks/CQM-TSK-001_設計文書作成タスクリスト.md)**: 実装計画

## 🛠️ 開発状況

| フェーズ | 状況 | 期間 |
|---------|------|------|
| **Phase 0**: Ultra-Minimal MVP | 🔄 進行中 | 2週間 |
| **Phase 1**: プラグインシステム | ⏳ 計画中 | 3週間 |
| **Phase 2**: エコシステム構築 | ⏳ 計画中 | 4週間 |

### 今週のマイルストーン
- [ ] コアMCPサーバー実装
- [ ] 基本RAGエンジン
- [ ] FileSystemプラグイン
- [ ] Cursor統合テスト

## 🤝 コントリビューション

現在は初期開発段階です。コントリビューションを歓迎します！

### 開発環境のセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/Shin-R2un/cqm.git
cd cqm

# 依存関係をインストール
npm install

# 開発サーバーを起動
npm run dev
```

### コントリビューションガイドライン

1. **Issue** を作成して作業内容を明確化
2. **Feature Branch** を作成
3. **Pull Request** でレビュー依頼
4. **文書更新** も併せて実施

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) をご覧ください。

## 🆘 サポート

- **Issues**: [GitHub Issues](https://github.com/Shin-R2un/cqm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Shin-R2un/cqm/discussions)
- **Wiki**: [プロジェクトWiki](https://github.com/Shin-R2un/cqm/wiki)

---

*"Your context, on air for all AI" - CQ Models! Development Team*