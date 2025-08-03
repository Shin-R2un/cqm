# @cqm/rag - RAG Engine Implementation

CQM（CQ Models! - Contextual Query Manager）の RAG（Retrieval-Augmented Generation）エンジン実装です。

## 🚀 Features

- **マルチプロバイダー埋め込み**: Ollama（ローカル）と OpenAI（クラウド）サポート
- **ベクトル検索**: Qdrant 統合による高速・高精度検索
- **マルチモーダルチャンク処理**: TypeScript AST、Markdown、GitHub Issues/PR対応
- **インクリメンタル インデックス**: SHA256 ハッシュベースの変更検出
- **パフォーマンス最適化**: <100ms 検索応答、90% 精度目標
- **ヘルスモニタリング**: リアルタイム状態監視と診断機能

## 📦 Installation

```bash
npm install @cqm/rag
```

## 🔧 Quick Start

### 基本的な使用方法

```typescript
import { RAGEngine } from '@cqm/rag';

// 1. RAGエンジンの初期化
const ragEngine = new RAGEngine({
  provider: 'ollama',
  model: 'nomic-embed-text',
  vectorDbUrl: 'http://localhost:6333'
});

// 2. エンジンの起動
await ragEngine.initialize();

// 3. ドキュメントのインデックス化
await ragEngine.indexDocuments([
  './src/**/*.ts',
  './docs/**/*.md'
]);

// 4. 検索の実行
const results = await ragEngine.search({
  query: 'How to implement vector search?',
  limit: 10,
  filters: {
    language: ['typescript'],
    category: ['source']
  }
});

console.log(`Found ${results.length} results`);
results.forEach(result => {
  console.log(`${result.metadata.source}: ${result.score}`);
});
```

### 設定ファイルを使用した場合

```typescript
import { loadConfigFromFile, RAGEngine } from '@cqm/rag';

// 設定ファイルの読み込み
const config = loadConfigFromFile('./cqm-rag.json');

// 設定を使用してエンジンを初期化
const ragEngine = new RAGEngine({
  provider: config.embedding.provider,
  model: config.embedding.defaultModel,
  vectorDbUrl: config.vector.url,
  indexOptions: config.indexing,
  performance: config.performance
});
```

## ⚙️ Configuration

### 環境変数

```bash
# Qdrant 設定
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your-api-key

# 埋め込みプロバイダー設定
CQM_EMBEDDING_PROVIDER=ollama
CQM_EMBEDDING_MODEL=nomic-embed-text

# パフォーマンス設定
CQM_VECTOR_BATCH_SIZE=100
CQM_MAX_FILE_SIZE=1048576
CQM_SEARCH_THRESHOLD=0.7
CQM_MAX_SEARCH_RESULTS=20
```

### 設定ファイル例

```json
{
  "embedding": {
    "provider": "ollama",
    "defaultModel": "nomic-embed-text",
    "retries": {
      "maxAttempts": 3,
      "baseDelay": 1000
    }
  },
  "vector": {
    "url": "http://localhost:6333",
    "batchSize": 100,
    "searchDefaults": {
      "limit": 20,
      "threshold": 0.7
    }
  },
  "indexing": {
    "basePaths": ["."],
    "includePatterns": ["**/*.ts", "**/*.js", "**/*.md"],
    "excludePatterns": ["node_modules/**", "dist/**", ".git/**"],
    "maxFileSize": 1048576,
    "enableIncremental": true
  }
}
```

## 🔍 Advanced Usage

### カスタムチャンク戦略

```typescript
import { MultimodalChunker } from '@cqm/rag';

const chunker = new MultimodalChunker();

// カスタム戦略の定義
chunker.setStrategy('python', {
  type: 'function',
  maxTokens: 1024,
  overlap: 100,
  preserveContext: true
});

// ドキュメント処理
const result = await chunker.processDocument({
  content: pythonCode,
  filePath: 'script.py',
  language: 'python',
  type: 'python'
});
```

### 高度な検索フィルタリング

```typescript
const results = await ragEngine.search({
  query: 'authentication implementation',
  limit: 15,
  threshold: 0.8,
  filters: {
    category: ['source', 'documentation'],
    fileType: ['.ts', '.md'],
    language: ['typescript', 'markdown'],
    dateRange: {
      after: new Date('2024-01-01'),
      before: new Date('2024-12-31')
    },
    tags: ['security', 'auth']
  },
  includeContent: true,
  includeHighlights: true
});
```

### パフォーマンス監視

```typescript
// 統計情報の取得
const stats = await ragEngine.getStats();
console.log(`Documents: ${stats.documents.total}`);
console.log(`Search accuracy: ${stats.performance.searchAccuracy}%`);
console.log(`Average search time: ${stats.performance.averageSearchTime}ms`);

// ヘルスチェック
const health = await ragEngine.healthCheck();
console.log(`Status: ${health.status}`);
console.log('Components:', health.components);
```

## 🧪 Testing

```bash
# テストの実行
npm test

# カバレッジレポート
npm run test:coverage

# 型チェック
npm run type-check
```

## 📊 Supported Formats

### ドキュメントタイプ

- **TypeScript/JavaScript**: 関数、クラス、インターフェース抽出
- **Markdown**: セクション階層解析、フロントマター対応
- **GitHub Issues**: Issue本体とコメントの分離処理
- **GitHub PRs**: PR本体とレビューコメントの処理
- **プレーンテキスト**: 段落ベース分割

### 埋め込みモデル

#### Ollama（ローカル）
- `nomic-embed-text` (768d) - 汎用検索最適化
- `mxbai-embed-large` (1024d) - 高精度セマンティック検索
- `all-minilm` (384d) - 軽量高速処理

#### OpenAI（クラウド）
- `text-embedding-3-small` (1536d) - 高品質埋め込み

## 🎯 Performance Targets

- **検索応答時間**: <100ms
- **検索精度**: 90%
- **テストカバレッジ**: 80%
- **同時接続**: 複数AIモデル対応

## 🔧 Architecture

```
RAGEngine
├── EmbeddingProviderManager
│   ├── OllamaEmbeddingProvider
│   └── OpenAIEmbeddingProvider
├── VectorSearchEngine
│   └── QdrantVectorStore
├── MultimodalChunker
│   ├── TypeScriptASTChunker
│   ├── MarkdownSectionChunker
│   └── GitHubContentChunker
├── IndexManager
│   ├── FileDiscovery
│   ├── IncrementalUpdates
│   └── ProgressTracking
└── HealthMonitoring
    ├── ComponentStatus
    └── PerformanceMetrics
```

## 🐛 Troubleshooting

### よくある問題

#### Ollama 接続エラー
```bash
# Ollama サーバーの起動確認
ollama serve

# モデルの手動インストール
ollama pull nomic-embed-text
```

#### Qdrant 接続エラー
```bash
# Docker でQdrant起動
docker run -p 6333:6333 qdrant/qdrant

# 接続確認
curl http://localhost:6333/health
```

#### メモリ不足エラー
```bash
# バッチサイズの調整
export CQM_VECTOR_BATCH_SIZE=50

# ファイルサイズ制限
export CQM_MAX_FILE_SIZE=524288  # 512KB
```

## 📝 API Reference

### RAGEngine

#### Constructor
```typescript
new RAGEngine(options: RAGEngineOptions)
```

#### Methods
- `initialize(): Promise<void>` - エンジンの初期化
- `indexDocuments(filePaths?: string[]): Promise<IndexingProgress>` - ドキュメントのインデックス化
- `search(options: SearchOptions): Promise<SearchResult[]>` - ベクトル検索の実行
- `getStats(): Promise<RAGStats>` - 統計情報の取得
- `healthCheck(): Promise<HealthStatus>` - ヘルスチェック

### MultimodalChunker

#### Methods
- `processDocument(input: DocumentInput): Promise<ChunkResult>` - ドキュメントのチャンク処理
- `setStrategy(type: string, strategy: ChunkStrategy): void` - チャンク戦略の設定

### VectorSearchEngine

#### Methods
- `search(vector: number[], options?: SearchOptions): Promise<SearchResult[]>` - ベクトル検索
- `getStats(): Promise<CollectionStats>` - コレクション統計

## 🤝 Contributing

1. Issue の作成で機能要求やバグ報告
2. Fork してブランチ作成
3. 実装とテスト追加
4. Pull Request 作成

## 📄 License

MIT License - 詳細は [LICENSE](../../LICENSE) を参照

## 🔗 Related

- [CQM Core](../core) - MCPサーバーコア実装
- [CQM Shared](../shared) - 共通型定義とユーティリティ
- [CQM CLI](../cli) - コマンドラインインターフェース