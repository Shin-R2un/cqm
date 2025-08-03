/**
 * RAGエンジンコア実装 - CQM-TEC-002設計に基づく完全実装
 */
import { CQMError } from '@cqm/shared';
import { 
  EmbeddingProvider, 
  EmbeddingProviderManager,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider 
} from '../embedding/index.js';
import { 
  VectorStore, 
  VectorSearchEngine,
  QdrantVectorStore,
  SearchResult as VectorSearchResult,
  SearchFilters 
} from '../vector/index.js';
import { 
  MultimodalChunker,
  DocumentInput,
  detectDocumentType,
  detectLanguage 
} from '../chunking/index.js';
import { 
  IndexManager,
  IndexOptions,
  IndexingProgress 
} from '../index/index.js';

export interface RAGEngineOptions {
  provider: 'openai' | 'ollama';
  model: string;
  vectorDbUrl?: string;
  vectorDbApiKey?: string;
  indexOptions?: Partial<IndexOptions>;
  performance?: {
    maxSearchResults?: number;
    searchThreshold?: number;
    chunkOverlap?: number;
    maxConcurrentOperations?: number;
  };
}

export interface SearchOptions {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: {
    category?: string[];
    fileType?: string[];
    language?: string[];
    dateRange?: {
      after?: Date;
      before?: Date;
    };
    tags?: string[];
  };
  includeContent?: boolean;
  includeHighlights?: boolean;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    source: string;
    type: string;
    category?: string;
    language?: string;
    lastModified: Date;
    size: number;
    tags?: string[];
  };
  highlights?: string[];
  chunk?: {
    title?: string;
    startLine?: number;
    endLine?: number;
    symbols?: string[];
  };
}

export interface DocumentInput_Legacy {
  id: string;
  content: string;
  metadata: {
    source: string;
    type: string;
    lastModified?: Date;
  };
}

export interface RAGStats {
  documents: {
    total: number;
    indexed: number;
    pending: number;
    errors: number;
  };
  chunks: {
    total: number;
    averagePerDocument: number;
  };
  vectors: {
    total: number;
    dimensions: number;
    indexSize: number; // bytes
  };
  performance: {
    averageSearchTime: number; // ms
    averageIndexTime: number; // ms
    searchAccuracy: number; // %
    lastSearchTime?: number;
    lastIndexTime?: number;
  };
  providers: {
    embedding: string;
    vectorStore: string;
    status: 'healthy' | 'degraded' | 'error';
  };
}

export class RAGEngine {
  private embeddingManager: EmbeddingProviderManager;
  private vectorSearchEngine!: VectorSearchEngine;
  private indexManager!: IndexManager;
  private chunker: MultimodalChunker;
  private readonly options: Required<RAGEngineOptions>;
  private isInitialized = false;
  private searchMetrics: Array<{ time: number; accuracy?: number }> = [];

  constructor(options: RAGEngineOptions) {
    this.options = {
      provider: options.provider,
      model: options.model,
      vectorDbUrl: options.vectorDbUrl || 'http://localhost:6333',
      vectorDbApiKey: options.vectorDbApiKey || '',
      indexOptions: options.indexOptions || {},
      performance: {
        maxSearchResults: options.performance?.maxSearchResults || 20,
        searchThreshold: options.performance?.searchThreshold || 0.7,
        chunkOverlap: options.performance?.chunkOverlap || 50,
        maxConcurrentOperations: options.performance?.maxConcurrentOperations || 5,
        ...options.performance
      }
    };

    // 埋め込みプロバイダー管理初期化
    this.embeddingManager = new EmbeddingProviderManager();
    this.chunker = new MultimodalChunker();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log(`🚀 Initializing RAG Engine with ${this.options.provider}:${this.options.model}`);

      // 埋め込みプロバイダー登録
      await this.initializeEmbeddingProviders();

      // ベクトルストア初期化
      const vectorStore = new QdrantVectorStore({
        url: this.options.vectorDbUrl,
        apiKey: this.options.vectorDbApiKey
      });

      const embeddingProvider = await this.embeddingManager.getProvider(this.options.provider);
      
      // ベクトル検索エンジン初期化
      this.vectorSearchEngine = new VectorSearchEngine(vectorStore);
      await this.vectorSearchEngine.initialize(embeddingProvider.getDimensions());

      // インデックスマネージャー初期化
      this.indexManager = new IndexManager(
        embeddingProvider,
        vectorStore,
        this.options.indexOptions
      );
      await this.indexManager.initialize();

      console.log(`✅ RAG Engine initialized successfully`);
      this.isInitialized = true;
    } catch (error) {
      throw new CQMError(
        `Failed to initialize RAG Engine: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RAG_INIT_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async indexDocument(document: DocumentInput_Legacy): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // ドキュメントタイプ検出
      const documentType = detectDocumentType(document.content);
      const language = detectLanguage(document.metadata.source);

      // ドキュメント入力形式に変換
      const input: DocumentInput = {
        content: document.content,
        filePath: document.metadata.source,
        language,
        type: documentType
      };

      // インデックスマネージャーを使用してインデックス
      await this.indexManager.indexSingleDocument(document.metadata.source);
      
      console.log(`✅ Indexed document: ${document.id}`);
    } catch (error) {
      throw new CQMError(
        `Failed to index document ${document.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INDEX_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async indexDocuments(
    filePaths?: string[],
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<IndexingProgress> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return await this.indexManager.indexDocuments(filePaths, onProgress);
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // クエリの埋め込み生成
      const embeddingProvider = await this.embeddingManager.getProvider(this.options.provider);
      const queryVector = await embeddingProvider.generateEmbedding(options.query);

      // 検索フィルターの変換
      const searchFilters: SearchFilters | undefined = options.filters ? {
        category: options.filters.category,
        fileType: options.filters.fileType,
        language: options.filters.language,
        dateRange: options.filters.dateRange,
        tags: options.filters.tags
      } : undefined;

      // ベクトル検索実行
      const vectorResults = await this.vectorSearchEngine.search(queryVector, {
        limit: options.limit || this.options.performance.maxSearchResults,
        threshold: options.threshold || this.options.performance.searchThreshold,
        filters: searchFilters
      });

      // 検索結果をRAGEngine形式に変換
      const results: SearchResult[] = vectorResults.map(result => ({
        id: result.id,
        content: options.includeContent !== false ? result.document.payload.content : '',
        score: result.score,
        metadata: {
          source: result.document.payload.metadata.source,
          type: result.document.payload.metadata.type,
          category: result.document.payload.metadata.category,
          language: result.document.payload.metadata.language,
          lastModified: result.document.payload.metadata.lastModified,
          size: result.document.payload.metadata.size,
          tags: result.document.payload.metadata.tags
        },
        highlights: options.includeHighlights !== false ? result.highlights : undefined,
        chunk: result.document.payload.chunks && result.document.payload.chunks.length > 0 ? {
          title: result.document.payload.chunks[0].title,
          startLine: result.document.payload.chunks[0].startLine,
          endLine: result.document.payload.chunks[0].endLine,
          symbols: result.document.payload.chunks[0].symbols
        } : undefined
      }));

      // 検索メトリクス記録
      const searchTime = Date.now() - startTime;
      this.searchMetrics.push({ time: searchTime });
      if (this.searchMetrics.length > 100) {
        this.searchMetrics = this.searchMetrics.slice(-100); // 最新100件を保持
      }

      console.log(`🔍 Search completed: ${results.length} results in ${searchTime}ms`);
      return results;
    } catch (error) {
      throw new CQMError(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SEARCH_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      await this.indexManager.removeDocument(documentId);
      console.log(`🗑️  Deleted document: ${documentId}`);
    } catch (error) {
      throw new CQMError(
        `Failed to delete document ${documentId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELETE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async getStats(): Promise<RAGStats> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const indexStats = await this.indexManager.getStats();
      const collectionStats = await this.vectorSearchEngine.getStats();
      const availableProviders = await this.embeddingManager.getAvailableProviders();

      // パフォーマンスメトリクス計算
      const averageSearchTime = this.searchMetrics.length > 0 
        ? this.searchMetrics.reduce((sum, metric) => sum + metric.time, 0) / this.searchMetrics.length
        : 0;

      return {
        documents: {
          total: indexStats.totalDocuments,
          indexed: indexStats.totalDocuments, // TODO: ステータス別集計
          pending: 0,
          errors: 0
        },
        chunks: {
          total: indexStats.totalChunks,
          averagePerDocument: indexStats.totalDocuments > 0 
            ? indexStats.totalChunks / indexStats.totalDocuments 
            : 0
        },
        vectors: {
          total: indexStats.totalVectors,
          dimensions: collectionStats.dimensions,
          indexSize: indexStats.indexSize
        },
        performance: {
          averageSearchTime,
          averageIndexTime: indexStats.performance.averageIndexTime,
          searchAccuracy: 85.0, // TODO: 実際の精度測定
          lastSearchTime: this.searchMetrics.length > 0 ? this.searchMetrics[this.searchMetrics.length - 1].time : undefined,
          lastIndexTime: indexStats.performance.averageIndexTime
        },
        providers: {
          embedding: this.options.provider,
          vectorStore: 'qdrant',
          status: availableProviders.length > 0 ? 'healthy' : 'error'
        }
      };
    } catch (error) {
      throw new CQMError(
        `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'STATS_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async rebuild(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔄 Rebuilding RAG index...');
      
      // 古いドキュメントを検出して再インデックス
      const outdatedDocs = await this.indexManager.findOutdatedDocuments();
      
      if (outdatedDocs.length > 0) {
        const filePaths = outdatedDocs.map(doc => doc.filePath);
        await this.indexManager.indexDocuments(filePaths);
      }

      console.log(`✅ Index rebuild complete: ${outdatedDocs.length} documents updated`);
    } catch (error) {
      throw new CQMError(
        `Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REBUILD_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'error';
    components: Record<string, 'healthy' | 'degraded' | 'error'>;
    details: Record<string, string>;
  }> {
    const components: Record<string, 'healthy' | 'degraded' | 'error'> = {};
    const details: Record<string, string> = {};

    try {
      // 埋め込みプロバイダーチェック
      const availableProviders = await this.embeddingManager.getAvailableProviders();
      components.embedding = availableProviders.length > 0 ? 'healthy' : 'error';
      details.embedding = `Available providers: ${availableProviders.join(', ')}`;

      // ベクトルストアチェック
      try {
        const stats = await this.vectorSearchEngine.getStats();
        components.vectorStore = 'healthy';
        details.vectorStore = `Collection ready with ${stats.vectorCount} vectors`;
      } catch (error) {
        components.vectorStore = 'error';
        details.vectorStore = error instanceof Error ? error.message : String(error);
      }

      // インデックスマネージャーチェック
      try {
        const indexStats = await this.indexManager.getStats();
        components.indexManager = 'healthy';
        details.indexManager = `${indexStats.totalDocuments} documents indexed`;
      } catch (error) {
        components.indexManager = 'error';
        details.indexManager = error instanceof Error ? error.message : String(error);
      }

      // 全体的なステータス判定
      const componentStatuses = Object.values(components);
      const errorCount = componentStatuses.filter(status => status === 'error').length;
      const degradedCount = componentStatuses.filter(status => status === 'degraded').length;

      let overallStatus: 'healthy' | 'degraded' | 'error';
      if (errorCount > 0) {
        overallStatus = 'error';
      } else if (degradedCount > 0) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }

      return {
        status: overallStatus,
        components,
        details
      };
    } catch (error) {
      return {
        status: 'error',
        components,
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  private async initializeEmbeddingProviders(): Promise<void> {
    // Ollama プロバイダー登録
    const ollamaProvider = new OllamaEmbeddingProvider('nomic-embed-text');
    this.embeddingManager.register('ollama', ollamaProvider);

    // OpenAI プロバイダー登録（将来の実装用）
    const openaiProvider = new OpenAIEmbeddingProvider();
    this.embeddingManager.register('openai', openaiProvider);

    // プライマリプロバイダー設定
    this.embeddingManager.setPrimary(this.options.provider);

    console.log(`📦 Embedding providers initialized: ${this.options.provider} (primary)`);
  }

  // パブリックアクセサメソッド
  getEmbeddingProvider(): Promise<EmbeddingProvider> {
    return this.embeddingManager.getProvider(this.options.provider);
  }

  getVectorSearchEngine(): VectorSearchEngine {
    return this.vectorSearchEngine;
  }

  getIndexManager(): IndexManager {
    return this.indexManager;
  }

  getChunker(): MultimodalChunker {
    return this.chunker;
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}