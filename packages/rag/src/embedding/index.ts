/**
 * 埋め込み生成プロバイダー
 */
export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
  getMaxTokens(): number;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(private model: string = 'text-embedding-3-small') {}

  async generateEmbedding(text: string): Promise<number[]> {
    // OpenAI API呼び出し（実装予定）
    console.log(`Generating OpenAI embedding for text length: ${text.length}`);
    return new Array(1536).fill(0).map(() => Math.random());
  }

  getDimensions(): number {
    return this.model === 'text-embedding-3-large' ? 3072 : 1536;
  }

  getMaxTokens(): number {
    return 8191;
  }
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(private model: string = 'nomic-embed-text') {}

  async generateEmbedding(text: string): Promise<number[]> {
    // Ollama API呼び出し（実装予定）
    console.log(`Generating Ollama embedding for text length: ${text.length}`);
    return new Array(768).fill(0).map(() => Math.random());
  }

  getDimensions(): number {
    switch (this.model) {
      case 'mxbai-embed-large':
        return 1024;
      case 'nomic-embed-text':
      default:
        return 768;
    }
  }

  getMaxTokens(): number {
    return this.model === 'mxbai-embed-large' ? 512 : 8192;
  }
}