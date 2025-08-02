/**
 * 埋め込み生成プロバイダー - CQM-TEC-002設計に基づく実装
 */
import { Ollama } from 'ollama';
import { CQMError } from '@cqm/shared';

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  getDimensions(): number;
  getMaxTokens(): number;
  isModelAvailable(): Promise<boolean>;
  getModelInfo(): EmbeddingModelInfo;
}

export interface EmbeddingModelInfo {
  name: string;
  dimensions: number;
  maxTokens: number;
  contextLength: number;
  description: string;
}

export interface EmbeddingProviderOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  batchSize?: number;
}

// Ollama モデル定義
export const OLLAMA_MODELS = {
  'nomic-embed-text': {
    name: 'nomic-embed-text',
    dimensions: 768,
    maxTokens: 8192,
    contextLength: 8192,
    description: 'Nomic Embed Text v1.5 - High quality text embeddings'
  },
  'mxbai-embed-large': {
    name: 'mxbai-embed-large',
    dimensions: 1024,
    maxTokens: 512,
    contextLength: 512,
    description: 'MixedBread AI Large Embeddings - Multilingual support'
  },
  'all-minilm': {
    name: 'all-minilm',
    dimensions: 384,
    maxTokens: 256,
    contextLength: 256,
    description: 'All-MiniLM-L6-v2 - Fast and lightweight embeddings'
  }
} as const;

export type OllamaModelName = keyof typeof OLLAMA_MODELS;

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private ollama: Ollama;
  private readonly model: string;
  private readonly modelInfo: EmbeddingModelInfo;
  private readonly options: Required<EmbeddingProviderOptions>;
  private isAvailable: boolean | null = null;

  constructor(
    model: OllamaModelName = 'nomic-embed-text',
    options: EmbeddingProviderOptions = {}
  ) {
    this.model = model;
    this.modelInfo = OLLAMA_MODELS[model];
    
    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:11434',
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      batchSize: options.batchSize || 10
    };

    this.ollama = new Ollama({
      host: this.options.baseUrl
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text.trim()) {
      throw new CQMError('Empty text provided for embedding', 'INVALID_INPUT');
    }

    // テキスト長チェック
    if (text.length > this.modelInfo.maxTokens * 4) { // 概算チェック
      console.warn(`Text length (${text.length}) may exceed model limit`);
    }

    try {
      const response = await this.retryOperation(async () => {
        return await this.ollama.embeddings({
          model: this.model,
          prompt: text
        });
      });

      if (!response.embedding || response.embedding.length === 0) {
        throw new CQMError('Empty embedding response from Ollama', 'EMBEDDING_ERROR');
      }

      if (response.embedding.length !== this.modelInfo.dimensions) {
        throw new CQMError(
          `Unexpected embedding dimensions: got ${response.embedding.length}, expected ${this.modelInfo.dimensions}`,
          'EMBEDDING_ERROR'
        );
      }

      return response.embedding;
    } catch (error) {
      if (error instanceof CQMError) {
        throw error;
      }
      
      throw new CQMError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EMBEDDING_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // バッチサイズに分割して処理
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += this.options.batchSize) {
      const batch = texts.slice(i, i + this.options.batchSize);
      
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // バッチ間の遅延（レート制限対策）
      if (i + this.options.batchSize < texts.length) {
        await this.delay(100);
      }
    }

    return results;
  }

  async isModelAvailable(): Promise<boolean> {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    try {
      const models = await this.ollama.list();
      const isInstalled = models.models.some(m => m.name.includes(this.model));
      
      if (!isInstalled) {
        console.warn(`Model ${this.model} not found. Attempting to pull...`);
        await this.pullModel();
      }
      
      // テスト埋め込み生成で動作確認
      await this.generateEmbedding('test');
      
      this.isAvailable = true;
      return true;
    } catch (error) {
      console.error(`Model ${this.model} not available:`, error);
      this.isAvailable = false;
      return false;
    }
  }

  private async pullModel(): Promise<void> {
    try {
      console.log(`Pulling model ${this.model}...`);
      
      const stream = await this.ollama.pull({
        model: this.model,
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.status) {
          process.stdout.write(`\r${chunk.status}`);
        }
      }
      
      console.log(`\n✅ Model ${this.model} pulled successfully`);
    } catch (error) {
      throw new CQMError(
        `Failed to pull model ${this.model}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'MODEL_PULL_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
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
          console.warn(`Embedding attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getDimensions(): number {
    return this.modelInfo.dimensions;
  }

  getMaxTokens(): number {
    return this.modelInfo.maxTokens;
  }

  getModelInfo(): EmbeddingModelInfo {
    return { ...this.modelInfo };
  }
}

// レガシー OpenAI プロバイダー（将来の実装用）
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(private model: string = 'text-embedding-3-small') {}

  async generateEmbedding(text: string): Promise<number[]> {
    // OpenAI API呼び出し（実装予定）
    console.log(`Generating OpenAI embedding for text length: ${text.length}`);
    return new Array(1536).fill(0).map(() => Math.random());
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }

  async isModelAvailable(): Promise<boolean> {
    return false; // 未実装
  }

  getDimensions(): number {
    return this.model === 'text-embedding-3-large' ? 3072 : 1536;
  }

  getMaxTokens(): number {
    return 8191;
  }

  getModelInfo(): EmbeddingModelInfo {
    return {
      name: this.model,
      dimensions: this.getDimensions(),
      maxTokens: this.getMaxTokens(),
      contextLength: this.getMaxTokens(),
      description: 'OpenAI Embeddings (not implemented)'
    };
  }
}

// プロバイダー管理
export class EmbeddingProviderManager {
  private providers = new Map<string, EmbeddingProvider>();
  private primaryProvider: string | null = null;

  register(name: string, provider: EmbeddingProvider): void {
    this.providers.set(name, provider);
    
    if (!this.primaryProvider) {
      this.primaryProvider = name;
    }
  }

  async getProvider(name?: string): Promise<EmbeddingProvider> {
    const providerName = name || this.primaryProvider;
    
    if (!providerName) {
      throw new CQMError('No embedding provider configured', 'PROVIDER_ERROR');
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new CQMError(`Provider ${providerName} not found`, 'PROVIDER_ERROR');
    }

    // プロバイダーの利用可能性チェック
    if (!(await provider.isModelAvailable())) {
      throw new CQMError(`Provider ${providerName} not available`, 'PROVIDER_ERROR');
    }

    return provider;
  }

  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, provider] of this.providers.entries()) {
      try {
        if (await provider.isModelAvailable()) {
          available.push(name);
        }
      } catch {
        // プロバイダーチェックに失敗した場合はスキップ
      }
    }
    
    return available;
  }

  setPrimary(name: string): void {
    if (!this.providers.has(name)) {
      throw new CQMError(`Provider ${name} not registered`, 'PROVIDER_ERROR');
    }
    
    this.primaryProvider = name;
  }
}