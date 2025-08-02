/**
 * ベクトル検索エンジン - CQM-TEC-002設計に基づくQdrant統合実装
 */
import { QdrantClient } from '@qdrant/js-client-rest';
import { CQMError } from '@cqm/shared';

export interface VectorDocument {
  id: string;
  vector: number[];
  payload: DocumentPayload;
}

export interface DocumentPayload {
  content: string;
  metadata: DocumentMetadata;
  chunks?: ChunkMetadata[];
}

export interface DocumentMetadata {
  source: string;
  type: string;
  category?: string;
  language?: string;
  lastModified: Date;
  size: number;
  tags?: string[];
}

export interface ChunkMetadata {
  index: number;
  type: 'function' | 'class' | 'interface' | 'section' | 'paragraph';
  title?: string;
  startLine?: number;
  endLine?: number;
  symbols?: string[];
}

export interface SearchQuery {
  vector: number[];
  limit?: number;
  threshold?: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  category?: string[];
  fileType?: string[];
  language?: string[];
  dateRange?: {
    after?: Date;
    before?: Date;
  };
  tags?: string[];
  size?: {
    min?: number;
    max?: number;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  document: VectorDocument;
  highlights?: string[];
}

export interface CollectionInfo {
  name: string;
  vectorCount: number;
  dimensions: number;
  indexedAt: Date;
  status: 'ready' | 'indexing' | 'error';
}

export interface VectorStoreOptions {
  url?: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  batchSize?: number;
}

export interface VectorStore {
  initialize(): Promise<void>;
  createCollection(name: string, dimensions: number): Promise<void>;
  deleteCollection(name: string): Promise<void>;
  upsertVectors(collection: string, vectors: VectorDocument[]): Promise<void>;
  search(collection: string, query: SearchQuery): Promise<SearchResult[]>;
  deleteVectors(collection: string, ids: string[]): Promise<void>;
  getCollectionInfo(collection: string): Promise<CollectionInfo>;
  listCollections(): Promise<CollectionInfo[]>;
}

export class QdrantVectorStore implements VectorStore {
  private client: QdrantClient;
  private readonly options: Required<VectorStoreOptions>;
  private isInitialized = false;

  constructor(options: VectorStoreOptions = {}) {
    this.options = {
      url: options.url || 'http://localhost:6333',
      apiKey: options.apiKey || '',
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 100
    };

    this.client = new QdrantClient({
      url: this.options.url,
      apiKey: this.options.apiKey || undefined
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Qdrantサーバーの接続確認  
      await this.client.getCollections();
      console.log('✅ Connected to Qdrant server');
      
      this.isInitialized = true;
    } catch (error) {
      throw new CQMError(
        `Failed to connect to Qdrant server at ${this.options.url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async createCollection(name: string, dimensions: number): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await this.client.createCollection(name, {
          vectors: {
            size: dimensions,
            distance: 'Cosine' // コサイン類似度を使用
          },
          optimizers_config: {
            default_segment_number: 2,
            max_segment_size: 20000,
            memmap_threshold: 20000,
            indexing_threshold: 20000
          },
          replication_factor: 1,
          write_consistency_factor: 1
        });
      });

      console.log(`✅ Created collection: ${name} (${dimensions}d)`);
    } catch (error) {
      if (error instanceof Error && error.message?.includes('already exists')) {
        console.log(`📋 Collection ${name} already exists`);
        return;
      }
      
      throw new CQMError(
        `Failed to create collection ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async deleteCollection(name: string): Promise<void> {
    try {
      await this.retryOperation(async () => {
        await this.client.deleteCollection(name);
      });
      
      console.log(`🗑️  Deleted collection: ${name}`);
    } catch (error) {
      throw new CQMError(
        `Failed to delete collection ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async upsertVectors(collection: string, vectors: VectorDocument[]): Promise<void> {
    if (vectors.length === 0) {
      return;
    }

    try {
      // バッチサイズに分割して処理
      for (let i = 0; i < vectors.length; i += this.options.batchSize) {
        const batch = vectors.slice(i, i + this.options.batchSize);
        
        await this.retryOperation(async () => {
          const points = batch.map(doc => ({
            id: doc.id,
            vector: doc.vector,
            payload: {
              content: doc.payload.content,
              source: doc.payload.metadata.source,
              type: doc.payload.metadata.type,
              category: doc.payload.metadata.category,
              language: doc.payload.metadata.language,
              lastModified: doc.payload.metadata.lastModified.toISOString(),
              size: doc.payload.metadata.size,
              tags: doc.payload.metadata.tags || [],
              chunks: doc.payload.chunks || []
            }
          }));

          await this.client.upsert(collection, {
            wait: true,
            points
          });
        });

        console.log(`📊 Upserted batch ${Math.floor(i / this.options.batchSize) + 1}/${Math.ceil(vectors.length / this.options.batchSize)} (${batch.length} vectors)`);
      }
    } catch (error) {
      throw new CQMError(
        `Failed to upsert vectors to collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async search(collection: string, query: SearchQuery): Promise<SearchResult[]> {
    try {
      const searchParams: any = {
        vector: query.vector,
        limit: query.limit || 20,
        score_threshold: query.threshold || 0.7,
        with_payload: true,
        with_vector: false
      };

      // フィルターの構築
      if (query.filters) {
        searchParams.filter = this.buildQdrantFilter(query.filters);
      }

      const response = await this.retryOperation(async () => {
        return await this.client.search(collection, searchParams);
      });

      return response.map(result => ({
        id: String(result.id),
        score: result.score || 0,
        document: {
          id: String(result.id),
          vector: [],
          payload: {
            content: String(result.payload?.content || ''),
            metadata: {
              source: String(result.payload?.source || ''),
              type: String(result.payload?.type || ''),
              category: String(result.payload?.category || ''),
              language: String(result.payload?.language || ''),
              lastModified: new Date(String(result.payload?.lastModified || Date.now())),
              size: Number(result.payload?.size || 0),
              tags: Array.isArray(result.payload?.tags) ? result.payload.tags : []
            },
            chunks: Array.isArray(result.payload?.chunks) ? result.payload.chunks : []
          }
        },
        highlights: this.generateHighlights(String(result.payload?.content || ''), query.vector)
      }));
    } catch (error) {
      throw new CQMError(
        `Failed to search in collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }

    try {
      await this.retryOperation(async () => {
        await this.client.delete(collection, {
          wait: true,
          points: ids
        });
      });

      console.log(`🗑️  Deleted ${ids.length} vectors from collection: ${collection}`);
    } catch (error) {
      throw new CQMError(
        `Failed to delete vectors from collection ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async getCollectionInfo(collection: string): Promise<CollectionInfo> {
    try {
      const info = await this.retryOperation(async () => {
        return await this.client.getCollection(collection);
      });

      return {
        name: collection,
        vectorCount: info.points_count || 0,
        dimensions: typeof info.config?.params?.vectors === 'object' && 'size' in info.config.params.vectors 
          ? (info.config.params.vectors as any).size || 0 
          : 0,
        indexedAt: new Date(), // Qdrantは作成日時を直接提供しないため現在時刻を使用
        status: info.status === 'green' ? 'ready' : 'error'
      };
    } catch (error) {
      throw new CQMError(
        `Failed to get collection info for ${collection}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async listCollections(): Promise<CollectionInfo[]> {
    try {
      const response = await this.retryOperation(async () => {
        return await this.client.getCollections();
      });

      const collections = await Promise.allSettled(
        response.collections.map(collection => 
          this.getCollectionInfo(collection.name)
        )
      );

      return collections
        .filter((result): result is PromiseFulfilledResult<CollectionInfo> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);
    } catch (error) {
      throw new CQMError(
        `Failed to list collections: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'VECTOR_STORE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private buildQdrantFilter(filters: SearchFilters): any {
    const must: any[] = [];

    if (filters.category && filters.category.length > 0) {
      must.push({
        key: 'category',
        match: { any: filters.category }
      });
    }

    if (filters.fileType && filters.fileType.length > 0) {
      must.push({
        key: 'type',
        match: { any: filters.fileType }
      });
    }

    if (filters.language && filters.language.length > 0) {
      must.push({
        key: 'language',
        match: { any: filters.language }
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      must.push({
        key: 'tags',
        match: { any: filters.tags }
      });
    }

    if (filters.dateRange) {
      const range: any = {};
      
      if (filters.dateRange.after) {
        range.gte = filters.dateRange.after.toISOString();
      }
      
      if (filters.dateRange.before) {
        range.lte = filters.dateRange.before.toISOString();
      }
      
      if (Object.keys(range).length > 0) {
        must.push({
          key: 'lastModified',
          range
        });
      }
    }

    if (filters.size) {
      const range: any = {};
      
      if (filters.size.min !== undefined) {
        range.gte = filters.size.min;
      }
      
      if (filters.size.max !== undefined) {
        range.lte = filters.size.max;
      }
      
      if (Object.keys(range).length > 0) {
        must.push({
          key: 'size',
          range
        });
      }
    }

    return must.length > 0 ? { must } : undefined;
  }

  private generateHighlights(content: string, queryVector: number[]): string[] {
    // 簡単なハイライト生成（実際の実装では埋め込みベースの類似性を使用）
    const words = content.split(/\s+/).filter(word => word.length > 3);
    return words.slice(0, 3); // 最初の3つの単語をハイライトとして返す
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.options.maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(`Vector store operation attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 検索エンジンファサード
export class VectorSearchEngine {
  private store: VectorStore;
  private defaultCollection: string;

  constructor(store: VectorStore, defaultCollection = 'cqm-default') {
    this.store = store;
    this.defaultCollection = defaultCollection;
  }

  async initialize(dimensions: number): Promise<void> {
    await this.store.initialize();
    await this.store.createCollection(this.defaultCollection, dimensions);
  }

  async addDocuments(documents: VectorDocument[], collection?: string): Promise<void> {
    await this.store.upsertVectors(collection || this.defaultCollection, documents);
  }

  async search(
    queryVector: number[], 
    options: {
      limit?: number;
      threshold?: number;
      filters?: SearchFilters;
      collection?: string;
    } = {}
  ): Promise<SearchResult[]> {
    const query: SearchQuery = {
      vector: queryVector,
      limit: options.limit || 20,
      threshold: options.threshold || 0.7,
      filters: options.filters
    };

    return await this.store.search(options.collection || this.defaultCollection, query);
  }

  async removeDocuments(ids: string[], collection?: string): Promise<void> {
    await this.store.deleteVectors(collection || this.defaultCollection, ids);
  }

  async getStats(collection?: string): Promise<CollectionInfo> {
    return await this.store.getCollectionInfo(collection || this.defaultCollection);
  }

  async listCollections(): Promise<CollectionInfo[]> {
    return await this.store.listCollections();
  }
}

// レガシー互換性のため
export interface VectorDatabase {
  upsert(id: string, vector: number[], metadata: any): Promise<void>;
  search(vector: number[], topK: number): Promise<SearchResult[]>;
  delete(id: string): Promise<void>;
  getStats(): Promise<{ count: number; size: number }>;
}

export class QdrantVectorDatabase implements VectorDatabase {
  private store: QdrantVectorStore;
  private collection: string;

  constructor(url: string = 'http://localhost:6333', collection = 'legacy') {
    this.store = new QdrantVectorStore({ url });
    this.collection = collection;
  }

  async upsert(id: string, vector: number[], metadata: any): Promise<void> {
    await this.store.initialize();
    await this.store.createCollection(this.collection, vector.length);
    
    const document: VectorDocument = {
      id,
      vector,
      payload: {
        content: metadata.content || '',
        metadata: {
          source: metadata.source || '',
          type: metadata.type || 'unknown',
          lastModified: new Date(),
          size: metadata.size || 0
        }
      }
    };

    await this.store.upsertVectors(this.collection, [document]);
  }

  async search(vector: number[], topK: number): Promise<SearchResult[]> {
    const query: SearchQuery = {
      vector,
      limit: topK,
      threshold: 0.0
    };

    return await this.store.search(this.collection, query);
  }

  async delete(id: string): Promise<void> {
    await this.store.deleteVectors(this.collection, [id]);
  }

  async getStats(): Promise<{ count: number; size: number }> {
    try {
      const info = await this.store.getCollectionInfo(this.collection);
      return {
        count: info.vectorCount,
        size: info.vectorCount * info.dimensions
      };
    } catch {
      return { count: 0, size: 0 };
    }
  }
}