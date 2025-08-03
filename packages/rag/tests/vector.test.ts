/**
 * ベクトル検索エンジンのテストスイート
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  QdrantVectorStore,
  VectorSearchEngine,
  VectorDocument,
  SearchQuery 
} from '../src/vector/index.js';
import { CQMError } from '@cqm/shared';

describe('QdrantVectorStore', () => {
  let vectorStore: QdrantVectorStore;

  beforeEach(() => {
    vectorStore = new QdrantVectorStore({
      url: 'http://localhost:6333',
      apiKey: 'test-key'
    });
  });

  describe('初期化', () => {
    it('正しい設定で初期化される', () => {
      expect(vectorStore.isInitialized()).toBe(false);
    });

    it('接続確認でOKな場合に初期化が完了する', async () => {
      const mockClient = {
        getCollections: vi.fn().mockResolvedValue({ collections: [] })
      };
      
      (vectorStore as any).client = mockClient;

      await vectorStore.initialize();
      expect(vectorStore.isInitialized()).toBe(true);
    });

    it('接続エラー時に適切なエラーを投げる', async () => {
      const mockClient = {
        getCollections: vi.fn().mockRejectedValue(new Error('Connection failed'))
      };
      
      (vectorStore as any).client = mockClient;

      await expect(vectorStore.initialize()).rejects.toThrow(CQMError);
    });
  });

  describe('コレクション管理', () => {
    beforeEach(async () => {
      const mockClient = {
        getCollections: vi.fn().mockResolvedValue({ collections: [] }),
        createCollection: vi.fn().mockResolvedValue({}),
        deleteCollection: vi.fn().mockResolvedValue({}),
        getCollection: vi.fn().mockResolvedValue({
          points_count: 100,
          status: 'green',
          config: {
            params: {
              vectors: { size: 768 }
            }
          }
        })
      };
      
      (vectorStore as any).client = mockClient;
      await vectorStore.initialize();
    });

    it('新しいコレクションを作成する', async () => {
      await vectorStore.createCollection('test-collection', 768);
      
      const mockClient = (vectorStore as any).client;
      expect(mockClient.createCollection).toHaveBeenCalledWith('test-collection', {
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      });
    });

    it('既存のコレクションを削除する', async () => {
      await vectorStore.deleteCollection('test-collection');
      
      const mockClient = (vectorStore as any).client;
      expect(mockClient.deleteCollection).toHaveBeenCalledWith('test-collection');
    });

    it('コレクション情報を取得する', async () => {
      const info = await vectorStore.getCollectionInfo('test-collection');
      
      expect(info.name).toBe('test-collection');
      expect(info.vectorCount).toBe(100);
      expect(info.status).toBe('ready');
      expect(info.dimensions).toBe(768);
    });

    it('コレクション一覧を取得する', async () => {
      const mockClient = (vectorStore as any).client;
      mockClient.getCollections.mockResolvedValue({
        collections: [
          { name: 'collection1' },
          { name: 'collection2' }
        ]
      });

      const collections = await vectorStore.listCollections();
      expect(collections).toEqual(['collection1', 'collection2']);
    });
  });

  describe('ベクトル操作', () => {
    beforeEach(async () => {
      const mockClient = {
        getCollections: vi.fn().mockResolvedValue({ collections: [] }),
        upsert: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({})
      };
      
      (vectorStore as any).client = mockClient;
      await vectorStore.initialize();
    });

    it('ベクトルドキュメントをアップサートする', async () => {
      const documents: VectorDocument[] = [
        {
          id: 'doc1',
          vector: [0.1, 0.2, 0.3],
          payload: {
            content: 'test content',
            metadata: {
              source: 'test.ts',
              type: 'typescript',
              lastModified: new Date(),
              size: 1000
            },
            chunks: []
          }
        }
      ];

      await vectorStore.upsertVectors('test-collection', documents);
      
      const mockClient = (vectorStore as any).client;
      expect(mockClient.upsert).toHaveBeenCalledWith('test-collection', {
        wait: true,
        points: documents.map(doc => ({
          id: doc.id,
          vector: doc.vector,
          payload: doc.payload
        }))
      });
    });

    it('ベクトル検索を実行する', async () => {
      const mockSearchResults = [
        {
          id: 'doc1',
          score: 0.95,
          payload: {
            content: 'test content',
            source: 'test.ts',
            type: 'typescript'
          }
        }
      ];

      const mockClient = (vectorStore as any).client;
      mockClient.search.mockResolvedValue(mockSearchResults);

      const query: SearchQuery = {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        threshold: 0.7
      };

      const results = await vectorStore.search('test-collection', query);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc1');
      expect(results[0].score).toBe(0.95);
      expect(results[0].document.payload.content).toBe('test content');
    });

    it('フィルター付きの検索を実行する', async () => {
      const mockClient = (vectorStore as any).client;
      mockClient.search.mockResolvedValue([]);

      const query: SearchQuery = {
        vector: [0.1, 0.2, 0.3],
        limit: 5,
        filters: {
          language: ['typescript'],
          category: ['source']
        }
      };

      await vectorStore.search('test-collection', query);
      
      expect(mockClient.search).toHaveBeenCalledWith('test-collection', {
        vector: query.vector,
        limit: query.limit,
        score_threshold: undefined,
        filter: {
          must: [
            {
              key: 'language',
              match: { any: ['typescript'] }
            },
            {
              key: 'category',
              match: { any: ['source'] }
            }
          ]
        }
      });
    });

    it('ベクトルを削除する', async () => {
      await vectorStore.deleteVectors('test-collection', ['doc1', 'doc2']);
      
      const mockClient = (vectorStore as any).client;
      expect(mockClient.delete).toHaveBeenCalledWith('test-collection', {
        wait: true,
        points: ['doc1', 'doc2']
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('初期化前の操作でエラーを投げる', async () => {
      await expect(vectorStore.createCollection('test', 768)).rejects.toThrow(CQMError);
    });

    it('ネットワークエラー時にリトライする', async () => {
      const mockClient = {
        getCollections: vi.fn().mockResolvedValue({ collections: [] }),
        upsert: vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({})
      };
      
      (vectorStore as any).client = mockClient;
      await vectorStore.initialize();

      const documents: VectorDocument[] = [{
        id: 'doc1',
        vector: [0.1],
        payload: {
          content: 'test',
          metadata: { source: 'test', type: 'text', lastModified: new Date(), size: 4 },
          chunks: []
        }
      }];

      await vectorStore.upsertVectors('test-collection', documents);
      expect(mockClient.upsert).toHaveBeenCalledTimes(3);
    });
  });
});

describe('VectorSearchEngine', () => {
  let searchEngine: VectorSearchEngine;
  let mockVectorStore: any;

  beforeEach(() => {
    mockVectorStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      createCollection: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      getCollectionInfo: vi.fn().mockResolvedValue({
        name: 'test',
        vectorCount: 100,
        dimensions: 768,
        indexedAt: new Date(),
        status: 'ready'
      })
    };

    searchEngine = new VectorSearchEngine(mockVectorStore);
  });

  describe('初期化', () => {
    it('指定された次元数で初期化する', async () => {
      await searchEngine.initialize(768);
      
      expect(mockVectorStore.initialize).toHaveBeenCalled();
      expect(searchEngine.isInitialized()).toBe(true);
    });

    it('デフォルトコレクションを作成する', async () => {
      await searchEngine.initialize(768);
      
      expect(mockVectorStore.createCollection).toHaveBeenCalledWith('default', 768);
    });
  });

  describe('検索', () => {
    beforeEach(async () => {
      await searchEngine.initialize(768);
    });

    it('ベクトル検索を実行する', async () => {
      const mockResults = [
        {
          id: 'doc1',
          score: 0.95,
          document: {
            id: 'doc1',
            vector: [0.1, 0.2],
            payload: {
              content: 'test content',
              metadata: { source: 'test.ts', type: 'typescript', lastModified: new Date(), size: 1000 },
              chunks: []
            }
          },
          highlights: ['test']
        }
      ];

      mockVectorStore.search.mockResolvedValue(mockResults);

      const results = await searchEngine.search([0.1, 0.2, 0.3], {
        limit: 5,
        threshold: 0.7
      });

      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0.95);
    });

    it('コレクション名を指定して検索する', async () => {
      await searchEngine.search([0.1, 0.2, 0.3], {
        collection: 'custom-collection',
        limit: 10
      });

      expect(mockVectorStore.search).toHaveBeenCalledWith(
        'custom-collection',
        expect.objectContaining({
          vector: [0.1, 0.2, 0.3],
          limit: 10
        })
      );
    });

    it('統計情報を取得する', async () => {
      const stats = await searchEngine.getStats();
      
      expect(stats.vectorCount).toBe(100);
      expect(stats.dimensions).toBe(768);
      expect(stats.status).toBe('ready');
    });
  });

  describe('エラーハンドリング', () => {
    it('初期化前の検索でエラーを投げる', async () => {
      await expect(searchEngine.search([0.1, 0.2, 0.3])).rejects.toThrow(CQMError);
    });

    it('無効なベクトル次元でエラーを投げる', async () => {
      await searchEngine.initialize(768);
      
      await expect(searchEngine.search([0.1])).rejects.toThrow(CQMError);
    });
  });
});