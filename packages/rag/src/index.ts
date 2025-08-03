/**
 * @cqm/rag - RAGエンジン実装
 * 
 * CQMのRAG（Retrieval-Augmented Generation）エンジン
 * マルチプロバイダー埋め込み、ベクトル検索、
 * インデックス管理を提供
 */

// 埋め込み関連
export * from './embedding/index.js';

// ベクトル検索関連（ChunkMetadataの競合を避けるため個別export）
export type {
  VectorStore,
  VectorDocument,
  DocumentPayload,
  DocumentMetadata,
  SearchQuery,
  SearchFilters,
  SearchResult as VectorSearchResult,
  CollectionInfo,
  VectorStoreOptions,
  VectorDatabase
} from './vector/index.js';

export {
  VectorSearchEngine,
  QdrantVectorStore,
  QdrantVectorDatabase
} from './vector/index.js';

// チャンク処理関連
export * from './chunking/index.js';

// インデックス管理関連
export * from './index/index.js';

// キャッシュ関連
export * from './cache/index.js';

// RAGエンジンコア
export type { 
  RAGEngineOptions,
  SearchOptions as RAGSearchOptions,
  SearchResult as RAGSearchResult,
  DocumentInput_Legacy,
  RAGStats
} from './engine/index.js';

export { RAGEngine } from './engine/index.js';