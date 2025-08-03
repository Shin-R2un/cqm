/**
 * 埋め込みプロバイダーのテストスイート
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaEmbeddingProvider, EmbeddingProviderManager } from '../src/embedding/index.js';
import { CQMError } from '@cqm/shared';

describe('OllamaEmbeddingProvider', () => {
  let provider: OllamaEmbeddingProvider;

  beforeEach(() => {
    provider = new OllamaEmbeddingProvider('nomic-embed-text');
  });

  describe('初期化', () => {
    it('正しいモデル名で初期化される', () => {
      expect(provider.getModel()).toBe('nomic-embed-text');
    });

    it('正しい次元数を返す', () => {
      expect(provider.getDimensions()).toBe(768);
    });

    it('サポートされているモデルを認識する', () => {
      const supportedProvider = new OllamaEmbeddingProvider('mxbai-embed-large');
      expect(supportedProvider.getDimensions()).toBe(1024);
    });

    it('サポートされていないモデルでエラーを投げる', () => {
      expect(() => {
        new OllamaEmbeddingProvider('unsupported-model' as any);
      }).toThrow(CQMError);
    });
  });

  describe('embeddings生成', () => {
    it('正常なテキストで埋め込みを生成する', async () => {
      // Ollamaクライアントをモック
      const mockOllama = {
        embeddings: vi.fn().mockResolvedValue({
          embedding: new Array(768).fill(0.1)
        })
      };
      
      // プライベートプロパティにアクセスするためのキャスト
      (provider as any).client = mockOllama;

      const result = await provider.generateEmbedding('test text');
      
      expect(result).toHaveLength(768);
      expect(result.every(val => typeof val === 'number')).toBe(true);
      expect(mockOllama.embeddings).toHaveBeenCalledWith({
        model: 'nomic-embed-text',
        prompt: 'test text'
      });
    });

    it('空のテキストでエラーを投げる', async () => {
      await expect(provider.generateEmbedding('')).rejects.toThrow(CQMError);
    });

    it('バッチ埋め込み生成が正常に動作する', async () => {
      const mockOllama = {
        embeddings: vi.fn()
          .mockResolvedValueOnce({ embedding: new Array(768).fill(0.1) })
          .mockResolvedValueOnce({ embedding: new Array(768).fill(0.2) })
      };
      
      (provider as any).client = mockOllama;

      const result = await provider.generateBatchEmbeddings(['text1', 'text2']);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(768);
      expect(result[1]).toHaveLength(768);
    });

    it('ネットワークエラー時に適切にリトライする', async () => {
      const mockOllama = {
        embeddings: vi.fn()
          .mockRejectedValueOnce(new Error('ECONNREFUSED'))
          .mockRejectedValueOnce(new Error('ECONNREFUSED'))
          .mockResolvedValueOnce({ embedding: new Array(768).fill(0.1) })
      };
      
      (provider as any).client = mockOllama;

      const result = await provider.generateEmbedding('test text');
      expect(result).toHaveLength(768);
      expect(mockOllama.embeddings).toHaveBeenCalledTimes(3);
    });

    it('最大リトライ回数に達した場合エラーを投げる', async () => {
      const mockOllama = {
        embeddings: vi.fn().mockRejectedValue(new Error('Persistent error'))
      };
      
      (provider as any).client = mockOllama;

      await expect(provider.generateEmbedding('test text')).rejects.toThrow(CQMError);
      expect(mockOllama.embeddings).toHaveBeenCalledTimes(3); // デフォルト最大リトライ回数
    });
  });

  describe('モデル管理', () => {
    it('モデルの利用可能性チェック', async () => {
      const mockOllama = {
        list: vi.fn().mockResolvedValue({
          models: [
            { name: 'nomic-embed-text:latest' },
            { name: 'other-model:latest' }
          ]
        })
      };
      
      (provider as any).client = mockOllama;

      const isAvailable = await provider.isModelAvailable();
      expect(isAvailable).toBe(true);
    });

    it('モデルが利用できない場合はfalseを返す', async () => {
      const mockOllama = {
        list: vi.fn().mockResolvedValue({
          models: [
            { name: 'other-model:latest' }
          ]
        })
      };
      
      (provider as any).client = mockOllama;

      const isAvailable = await provider.isModelAvailable();
      expect(isAvailable).toBe(false);
    });
  });
});

describe('EmbeddingProviderManager', () => {
  let manager: EmbeddingProviderManager;

  beforeEach(() => {
    manager = new EmbeddingProviderManager();
  });

  describe('プロバイダー管理', () => {
    it('プロバイダーの登録と取得', async () => {
      const provider = new OllamaEmbeddingProvider('nomic-embed-text');
      manager.register('ollama', provider);

      const retrieved = await manager.getProvider('ollama');
      expect(retrieved).toBe(provider);
    });

    it('存在しないプロバイダーでエラーを投げる', async () => {
      await expect(manager.getProvider('nonexistent')).rejects.toThrow(CQMError);
    });

    it('プライマリプロバイダーの設定', () => {
      const provider = new OllamaEmbeddingProvider('nomic-embed-text');
      manager.register('ollama', provider);
      manager.setPrimary('ollama');

      expect(manager.getPrimary()).toBe('ollama');
    });

    it('利用可能なプロバイダーのリスト取得', async () => {
      const ollamaProvider = new OllamaEmbeddingProvider('nomic-embed-text');
      
      // モック設定
      (ollamaProvider as any).client = {
        list: vi.fn().mockResolvedValue({
          models: [{ name: 'nomic-embed-text:latest' }]
        })
      };

      manager.register('ollama', ollamaProvider);

      const available = await manager.getAvailableProviders();
      expect(available).toContain('ollama');
    });

    it('プロバイダーが利用できない場合はリストに含まれない', async () => {
      const ollamaProvider = new OllamaEmbeddingProvider('nomic-embed-text');
      
      // モック設定（モデルが見つからない）
      (ollamaProvider as any).client = {
        list: vi.fn().mockResolvedValue({
          models: []
        })
      };

      manager.register('ollama', ollamaProvider);

      const available = await manager.getAvailableProviders();
      expect(available).not.toContain('ollama');
    });
  });
});