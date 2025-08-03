/**
 * RAGエンジン設定管理
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export interface EmbeddingModelInfo {
  dimensions: number;
  description: string;
  downloadUrl?: string;
}

export interface RAGConfig {
  embedding: {
    provider: 'ollama' | 'openai';
    defaultModel: string;
    models: Record<string, EmbeddingModelInfo>;
    retries: {
      maxAttempts: number;
      baseDelay: number;
    };
  };
  vector: {
    url: string;
    apiKey?: string;
    batchSize: number;
    searchDefaults: {
      limit: number;
      threshold: number;
    };
  };
  chunking: {
    strategies: Record<string, ChunkingStrategy>;
    defaults: {
      maxTokens: number;
      overlap: number;
    };
  };
  indexing: {
    basePaths: string[];
    includePatterns: string[];
    excludePatterns: string[];
    maxFileSize: number;
    enableIncremental: boolean;
    enableWatching: boolean;
  };
  performance: {
    maxSearchResults: number;
    searchThreshold: number;
    chunkOverlap: number;
    maxConcurrentOperations: number;
  };
}

export interface ChunkingStrategy {
  type: 'function' | 'class' | 'interface' | 'section' | 'paragraph' | 'issue' | 'comment';
  maxTokens: number;
  overlap: number;
  preserveContext: boolean;
}

export class RAGConfigManager {
  private config: RAGConfig;
  private static instance: RAGConfigManager;

  private constructor(configPath?: string) {
    this.config = this.loadConfig(configPath);
  }

  static getInstance(configPath?: string): RAGConfigManager {
    if (!RAGConfigManager.instance) {
      RAGConfigManager.instance = new RAGConfigManager(configPath);
    }
    return RAGConfigManager.instance;
  }

  private loadConfig(configPath?: string): RAGConfig {
    // デフォルト設定
    const defaultConfig: RAGConfig = {
      embedding: {
        provider: 'ollama',
        defaultModel: 'nomic-embed-text',
        models: {
          'nomic-embed-text': {
            dimensions: 768,
            description: 'General purpose embedding model optimized for search'
          },
          'mxbai-embed-large': {
            dimensions: 1024,
            description: 'High-dimensional model for precise semantic matching'
          },
          'all-minilm': {
            dimensions: 384,
            description: 'Lightweight model for fast processing'
          },
          'text-embedding-3-small': {
            dimensions: 1536,
            description: 'OpenAI embedding model (requires API key)'
          }
        },
        retries: {
          maxAttempts: 3,
          baseDelay: 1000
        }
      },
      vector: {
        url: process.env.QDRANT_URL || 'http://localhost:6333',
        apiKey: process.env.QDRANT_API_KEY,
        batchSize: 100,
        searchDefaults: {
          limit: 20,
          threshold: 0.7
        }
      },
      chunking: {
        strategies: {
          typescript: { type: 'function', maxTokens: 512, overlap: 50, preserveContext: true },
          javascript: { type: 'function', maxTokens: 512, overlap: 50, preserveContext: true },
          markdown: { type: 'section', maxTokens: 1024, overlap: 100, preserveContext: true },
          'github-issue': { type: 'issue', maxTokens: 2048, overlap: 0, preserveContext: false },
          'github-pr': { type: 'comment', maxTokens: 1024, overlap: 0, preserveContext: false },
          text: { type: 'paragraph', maxTokens: 512, overlap: 50, preserveContext: false }
        },
        defaults: {
          maxTokens: 512,
          overlap: 50
        }
      },
      indexing: {
        basePaths: ['.'],
        includePatterns: ['**/*.ts', '**/*.js', '**/*.md'],
        excludePatterns: ['node_modules/**', 'dist/**', '.git/**', '**/*.test.*', '**/*.spec.*'],
        maxFileSize: 1024 * 1024, // 1MB
        enableIncremental: true,
        enableWatching: false
      },
      performance: {
        maxSearchResults: 20,
        searchThreshold: 0.7,
        chunkOverlap: 50,
        maxConcurrentOperations: 5
      }
    };

    // 設定ファイルが指定されている場合は読み込む
    if (configPath) {
      try {
        const configFile = readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(configFile);
        return this.mergeConfigs(defaultConfig, userConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}, using defaults:`, error);
      }
    }

    // 環境変数から設定を上書き
    return this.applyEnvironmentOverrides(defaultConfig);
  }

  private mergeConfigs(defaultConfig: RAGConfig, userConfig: Partial<RAGConfig>): RAGConfig {
    return {
      embedding: {
        ...defaultConfig.embedding,
        ...userConfig.embedding,
        models: {
          ...defaultConfig.embedding.models,
          ...userConfig.embedding?.models
        },
        retries: {
          ...defaultConfig.embedding.retries,
          ...userConfig.embedding?.retries
        }
      },
      vector: {
        ...defaultConfig.vector,
        ...userConfig.vector,
        searchDefaults: {
          ...defaultConfig.vector.searchDefaults,
          ...userConfig.vector?.searchDefaults
        }
      },
      chunking: {
        ...defaultConfig.chunking,
        ...userConfig.chunking,
        strategies: {
          ...defaultConfig.chunking.strategies,
          ...userConfig.chunking?.strategies
        },
        defaults: {
          ...defaultConfig.chunking.defaults,
          ...userConfig.chunking?.defaults
        }
      },
      indexing: {
        ...defaultConfig.indexing,
        ...userConfig.indexing
      },
      performance: {
        ...defaultConfig.performance,
        ...userConfig.performance
      }
    };
  }

  private applyEnvironmentOverrides(config: RAGConfig): RAGConfig {
    // 環境変数からの設定上書き
    if (process.env.CQM_EMBEDDING_PROVIDER) {
      config.embedding.provider = process.env.CQM_EMBEDDING_PROVIDER as 'ollama' | 'openai';
    }

    if (process.env.CQM_EMBEDDING_MODEL) {
      config.embedding.defaultModel = process.env.CQM_EMBEDDING_MODEL;
    }

    if (process.env.CQM_VECTOR_BATCH_SIZE) {
      config.vector.batchSize = parseInt(process.env.CQM_VECTOR_BATCH_SIZE, 10);
    }

    if (process.env.CQM_MAX_FILE_SIZE) {
      config.indexing.maxFileSize = parseInt(process.env.CQM_MAX_FILE_SIZE, 10);
    }

    if (process.env.CQM_SEARCH_THRESHOLD) {
      const threshold = parseFloat(process.env.CQM_SEARCH_THRESHOLD);
      config.vector.searchDefaults.threshold = threshold;
      config.performance.searchThreshold = threshold;
    }

    if (process.env.CQM_MAX_SEARCH_RESULTS) {
      const limit = parseInt(process.env.CQM_MAX_SEARCH_RESULTS, 10);
      config.vector.searchDefaults.limit = limit;
      config.performance.maxSearchResults = limit;
    }

    return config;
  }

  getConfig(): RAGConfig {
    return { ...this.config };
  }

  getEmbeddingConfig() {
    return { ...this.config.embedding };
  }

  getVectorConfig() {
    return { ...this.config.vector };
  }

  getChunkingConfig() {
    return { ...this.config.chunking };
  }

  getIndexingConfig() {
    return { ...this.config.indexing };
  }

  getPerformanceConfig() {
    return { ...this.config.performance };
  }

  getModelInfo(modelName: string): EmbeddingModelInfo | undefined {
    return this.config.embedding.models[modelName];
  }

  getChunkingStrategy(documentType: string): ChunkingStrategy | undefined {
    return this.config.chunking.strategies[documentType];
  }

  updateConfig(updates: Partial<RAGConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  saveConfig(configPath: string): void {
    const fs = require('fs');
    fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 埋め込み設定の検証
    if (!this.config.embedding.models[this.config.embedding.defaultModel]) {
      errors.push(`Default embedding model '${this.config.embedding.defaultModel}' not found in models configuration`);
    }

    // ベクトル設定の検証
    try {
      new URL(this.config.vector.url);
    } catch {
      errors.push(`Invalid vector database URL: ${this.config.vector.url}`);
    }

    // バッチサイズの検証
    if (this.config.vector.batchSize <= 0 || this.config.vector.batchSize > 1000) {
      errors.push(`Vector batch size must be between 1 and 1000, got: ${this.config.vector.batchSize}`);
    }

    // 閾値の検証
    if (this.config.vector.searchDefaults.threshold < 0 || this.config.vector.searchDefaults.threshold > 1) {
      errors.push(`Search threshold must be between 0 and 1, got: ${this.config.vector.searchDefaults.threshold}`);
    }

    // ファイルサイズの検証
    if (this.config.indexing.maxFileSize <= 0) {
      errors.push(`Max file size must be positive, got: ${this.config.indexing.maxFileSize}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 便利な関数
export function getDefaultConfig(): RAGConfig {
  return RAGConfigManager.getInstance().getConfig();
}

export function loadConfigFromFile(configPath: string): RAGConfig {
  return RAGConfigManager.getInstance(configPath).getConfig();
}

export function getEnvironmentConfig(): RAGConfig {
  return RAGConfigManager.getInstance().getConfig();
}