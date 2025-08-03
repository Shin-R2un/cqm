/**
 * インデックス管理システム - CQM-TEC-002設計に基づく実装
 */
import { readFile, stat, readdir } from 'fs/promises';
import { join, relative, extname } from 'path';
import { createHash } from 'crypto';
import { CQMError } from '@cqm/shared';
import { 
  VectorStore, 
  VectorDocument, 
  DocumentPayload,
  DocumentMetadata
} from '../vector/index.js';
import { EmbeddingProvider } from '../embedding/index.js';
import { ChunkMetadata } from '../chunking/index.js';
import { 
  MultimodalChunker, 
  DocumentInput, 
  ChunkResult,
  detectDocumentType,
  detectLanguage 
} from '../chunking/index.js';

export interface IndexOptions {
  basePaths: string[];
  includePatterns: string[];
  excludePatterns: string[];
  maxFileSize: number;
  enableIncremental: boolean;
  enableWatching: boolean;
}

export interface IndexMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  documentCount: number;
  chunkCount: number;
  vectorCount: number;
  indexSize: number;
  version: string;
  options: IndexOptions;
}

export interface DocumentIndex {
  id: string;
  filePath: string;
  contentHash: string;
  lastModified: Date;
  lastIndexed: Date;
  chunkCount: number;
  vectorIds: string[];
  metadata: DocumentMetadata;
  status: 'indexed' | 'pending' | 'error' | 'outdated';
  error?: string;
}

export interface IndexingProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  currentFile?: string;
  estimatedTime?: number;
  errors: IndexingError[];
}

export interface IndexingError {
  filePath: string;
  error: string;
  timestamp: Date;
}

export interface IndexStats {
  totalDocuments: number;
  totalChunks: number;
  totalVectors: number;
  indexSize: number;
  byFileType: Record<string, number>;
  byLanguage: Record<string, number>;
  byCategory: Record<string, number>;
  lastUpdate: Date;
  performance: {
    averageChunkTime: number;
    averageEmbeddingTime: number;
    averageIndexTime: number;
  };
}

export class IndexManager {
  private embeddingProvider: EmbeddingProvider;
  private vectorStore: VectorStore;
  private chunker: MultimodalChunker;
  private documentIndexes = new Map<string, DocumentIndex>();
  private indexMetadata: IndexMetadata;
  private isInitialized = false;

  constructor(
    embeddingProvider: EmbeddingProvider,
    vectorStore: VectorStore,
    options: Partial<IndexOptions> = {}
  ) {
    this.embeddingProvider = embeddingProvider;
    this.vectorStore = vectorStore;
    this.chunker = new MultimodalChunker();

    this.indexMetadata = {
      id: this.generateIndexId(),
      name: 'CQM Default Index',
      description: 'CQM Project Context Index',
      createdAt: new Date(),
      updatedAt: new Date(),
      documentCount: 0,
      chunkCount: 0,
      vectorCount: 0,
      indexSize: 0,
      version: '1.0.0',
      options: {
        basePaths: options.basePaths || ['.'],
        includePatterns: options.includePatterns || ['**/*.ts', '**/*.js', '**/*.md'],
        excludePatterns: options.excludePatterns || ['node_modules/**', 'dist/**', '.git/**'],
        maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB
        enableIncremental: options.enableIncremental ?? true,
        enableWatching: options.enableWatching ?? false
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // ベクトルストアを初期化
      await this.vectorStore.initialize();
      
      // 埋め込みプロバイダーの利用可能性チェック
      if (!(await this.embeddingProvider.isModelAvailable())) {
        throw new CQMError('Embedding provider not available', 'PROVIDER_ERROR');
      }

      // コレクション作成
      const dimensions = this.embeddingProvider.getDimensions();
      await this.vectorStore.createCollection(this.indexMetadata.id, dimensions);

      console.log(`✅ Index manager initialized with ${dimensions}d embeddings`);
      this.isInitialized = true;
    } catch (error) {
      throw new CQMError(
        `Failed to initialize index manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INDEX_INIT_ERROR',
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

    const startTime = Date.now();
    let targetFiles: string[];

    if (filePaths) {
      targetFiles = filePaths;
    } else {
      // 設定に基づいて対象ファイルを発見
      targetFiles = await this.discoverFiles();
    }

    const progress: IndexingProgress = {
      total: targetFiles.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const filePath of targetFiles) {
      progress.currentFile = filePath;
      progress.estimatedTime = this.estimateRemainingTime(progress, startTime);
      
      if (onProgress) {
        onProgress({ ...progress });
      }

      try {
        await this.indexSingleDocument(filePath);
        progress.successful++;
      } catch (error) {
        progress.failed++;
        progress.errors.push({
          filePath,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
        console.error(`Failed to index ${filePath}:`, error);
      }

      progress.processed++;
    }

    // メタデータ更新
    this.indexMetadata.updatedAt = new Date();
    this.indexMetadata.documentCount = this.documentIndexes.size;
    this.indexMetadata.chunkCount = Array.from(this.documentIndexes.values())
      .reduce((sum, doc) => sum + doc.chunkCount, 0);

    console.log(`📊 Indexing complete: ${progress.successful}/${progress.total} documents`);
    return progress;
  }

  async indexSingleDocument(filePath: string): Promise<DocumentIndex> {
    const startTime = Date.now();

    try {
      // ファイル情報取得
      const stats = await stat(filePath);
      if (stats.size > this.indexMetadata.options.maxFileSize) {
        throw new CQMError(`File too large: ${stats.size} bytes`, 'FILE_TOO_LARGE');
      }

      // ファイル内容読み込み
      const content = await readFile(filePath, 'utf-8');
      const contentHash = this.calculateHash(content);

      // インクリメンタル更新チェック
      const existingIndex = this.documentIndexes.get(filePath);
      if (this.indexMetadata.options.enableIncremental && existingIndex) {
        if (existingIndex.contentHash === contentHash) {
          console.log(`⏭️  Skipping unchanged file: ${filePath}`);
          return existingIndex;
        }
        // 既存のベクトルを削除
        await this.vectorStore.deleteVectors(this.indexMetadata.id, existingIndex.vectorIds);
      }

      // ドキュメントタイプ検出
      const documentType = detectDocumentType(content, filePath);
      const language = detectLanguage(filePath);

      // ドキュメント入力準備
      const documentInput: DocumentInput = {
        content,
        filePath,
        language,
        type: documentType
      };

      // チャンク処理
      const chunkResult = await this.chunker.processDocument(documentInput);
      
      // 埋め込み生成
      const embeddings = await this.embeddingProvider.generateBatchEmbeddings(
        chunkResult.chunks.map(chunk => chunk.content)
      );

      // ベクトルドキュメント作成
      const vectorDocuments: VectorDocument[] = chunkResult.chunks.map((chunk, index) => ({
        id: `${filePath}-${chunk.id}`,
        vector: embeddings[index],
        payload: {
          content: chunk.content,
          metadata: {
            source: filePath,
            type: documentType,
            category: this.categorizeFile(filePath),
            language,
            lastModified: stats.mtime,
            size: stats.size,
            tags: this.extractTags(content, filePath)
          },
          chunks: [{
            index: chunk.metadata.index,
            type: chunk.type as any,
            title: chunk.metadata.title,
            startLine: chunk.metadata.startLine,
            endLine: chunk.metadata.endLine,
            symbols: chunk.metadata.symbols
          }] as any
        }
      }));

      // ベクトルストアに保存
      await this.vectorStore.upsertVectors(this.indexMetadata.id, vectorDocuments);

      // ドキュメントインデックス作成
      const documentIndex: DocumentIndex = {
        id: this.generateDocumentId(filePath),
        filePath,
        contentHash,
        lastModified: stats.mtime,
        lastIndexed: new Date(),
        chunkCount: chunkResult.chunks.length,
        vectorIds: vectorDocuments.map(doc => doc.id),
        metadata: {
          source: filePath,
          type: documentType,
          category: this.categorizeFile(filePath),
          language,
          lastModified: stats.mtime,
          size: stats.size,
          tags: this.extractTags(content, filePath)
        },
        status: 'indexed'
      };

      this.documentIndexes.set(filePath, documentIndex);

      const indexTime = Date.now() - startTime;
      console.log(`✅ Indexed ${filePath} (${chunkResult.chunks.length} chunks, ${indexTime}ms)`);

      return documentIndex;
    } catch (error) {
      const documentIndex: DocumentIndex = {
        id: this.generateDocumentId(filePath),
        filePath,
        contentHash: '',
        lastModified: new Date(),
        lastIndexed: new Date(),
        chunkCount: 0,
        vectorIds: [],
        metadata: {
          source: filePath,
          type: 'text',
          lastModified: new Date(),
          size: 0
        },
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };

      this.documentIndexes.set(filePath, documentIndex);
      throw error;
    }
  }

  async removeDocument(filePath: string): Promise<void> {
    const documentIndex = this.documentIndexes.get(filePath);
    if (!documentIndex) {
      return;
    }

    try {
      // ベクトルストアから削除
      await this.vectorStore.deleteVectors(this.indexMetadata.id, documentIndex.vectorIds);
      
      // ローカルインデックスから削除
      this.documentIndexes.delete(filePath);
      
      console.log(`🗑️  Removed document: ${filePath}`);
    } catch (error) {
      throw new CQMError(
        `Failed to remove document ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REMOVE_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async getStats(): Promise<IndexStats> {
    const documents = Array.from(this.documentIndexes.values());
    const byFileType: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    documents.forEach(doc => {
      // ファイルタイプ別集計
      const ext = extname(doc.filePath).toLowerCase() || 'unknown';
      byFileType[ext] = (byFileType[ext] || 0) + 1;

      // 言語別集計
      const lang = doc.metadata.language || 'unknown';
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;

      // カテゴリ別集計
      const category = doc.metadata.category || 'unknown';
      byCategory[category] = (byCategory[category] || 0) + 1;
    });

    const collectionInfo = await this.vectorStore.getCollectionInfo(this.indexMetadata.id);

    return {
      totalDocuments: documents.length,
      totalChunks: documents.reduce((sum, doc) => sum + doc.chunkCount, 0),
      totalVectors: collectionInfo.vectorCount,
      indexSize: collectionInfo.vectorCount * collectionInfo.dimensions * 4, // float32 の概算
      byFileType,
      byLanguage,
      byCategory,
      lastUpdate: this.indexMetadata.updatedAt,
      performance: {
        averageChunkTime: 50, // ms (実際の実装では測定値を使用)
        averageEmbeddingTime: 100, // ms
        averageIndexTime: 150 // ms
      }
    };
  }

  async findOutdatedDocuments(): Promise<DocumentIndex[]> {
    const outdated: DocumentIndex[] = [];

    for (const [filePath, docIndex] of this.documentIndexes.entries()) {
      try {
        const stats = await stat(filePath);
        
        if (stats.mtime > docIndex.lastModified) {
          docIndex.status = 'outdated';
          outdated.push(docIndex);
        }
      } catch (error) {
        // ファイルが存在しない場合
        docIndex.status = 'error';
        docIndex.error = 'File not found';
        outdated.push(docIndex);
      }
    }

    return outdated;
  }

  getIndexMetadata(): IndexMetadata {
    return { ...this.indexMetadata };
  }

  getDocumentIndex(filePath: string): DocumentIndex | undefined {
    return this.documentIndexes.get(filePath);
  }

  getAllDocumentIndexes(): DocumentIndex[] {
    return Array.from(this.documentIndexes.values());
  }

  private async discoverFiles(): Promise<string[]> {
    const files: string[] = [];
    const options = this.indexMetadata.options;

    for (const basePath of options.basePaths) {
      try {
        const discovered = await this.walkDirectory(basePath, options.includePatterns, options.excludePatterns);
        files.push(...discovered);
      } catch (error) {
        console.warn(`Failed to discover files in ${basePath}:`, error);
      }
    }

    return files;
  }

  private async walkDirectory(
    dirPath: string, 
    includePatterns: string[], 
    excludePatterns: string[]
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        const relativePath = relative('.', fullPath);

        // 除外パターンチェック
        if (this.matchesPatterns(relativePath, excludePatterns)) {
          continue;
        }

        if (entry.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath, includePatterns, excludePatterns);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          // 含有パターンチェック
          if (this.matchesPatterns(relativePath, includePatterns)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Cannot read directory ${dirPath}:`, error);
    }

    return files;
  }

  private matchesPatterns(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      // 簡単なglob pattern マッチング実装
      const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
      
      return new RegExp(`^${regex}$`).test(filePath);
    });
  }

  private generateIndexId(): string {
    return `cqm-index-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDocumentId(filePath: string): string {
    return createHash('sha256').update(filePath).digest('hex').substr(0, 16);
  }

  private calculateHash(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  private categorizeFile(filePath: string): string {
    const normalized = filePath.toLowerCase();
    
    if (normalized.includes('test') || normalized.includes('spec')) {
      return 'test';
    }
    if (normalized.includes('doc') || normalized.includes('readme')) {
      return 'documentation';
    }
    if (normalized.includes('config') || normalized.includes('setting')) {
      return 'configuration';
    }
    if (normalized.includes('/src/') || normalized.includes('\\src\\')) {
      return 'source';
    }
    if (normalized.includes('example') || normalized.includes('demo')) {
      return 'example';
    }
    
    return 'general';
  }

  private extractTags(content: string, filePath: string): string[] {
    const tags: string[] = [];
    
    // ファイル拡張子をタグとして追加
    const ext = extname(filePath).toLowerCase().substr(1);
    if (ext) tags.push(ext);
    
    // TODO: より高度なタグ抽出ロジック
    // - コメント内のタグ
    // - frontmatterのタグ
    // - 特定キーワードの検出
    
    return tags;
  }

  private estimateRemainingTime(progress: IndexingProgress, startTime: number): number {
    if (progress.processed === 0) return 0;
    
    const elapsed = Date.now() - startTime;
    const avgTimePerFile = elapsed / progress.processed;
    const remaining = progress.total - progress.processed;
    
    return Math.round(remaining * avgTimePerFile / 1000); // seconds
  }
}

// レガシー互換性のためのインターフェース
export interface IndexManager_Legacy {
  addDocument(document: any): Promise<void>;
  removeDocument(documentId: string): Promise<void>;
  updateDocument(document: any): Promise<void>;
  rebuild(): Promise<void>;
  getIndexInfo(): Promise<IndexInfo>;
}

export interface IndexInfo {
  documentCount: number;
  lastUpdated: Date;
  version: string;
}

export class DefaultIndexManager implements IndexManager_Legacy {
  private documents = new Map<string, any>();

  async addDocument(document: any): Promise<void> {
    this.documents.set(document.id, document);
    console.log(`Added document to index: ${document.id}`);
  }

  async removeDocument(documentId: string): Promise<void> {
    this.documents.delete(documentId);
    console.log(`Removed document from index: ${documentId}`);
  }

  async updateDocument(document: any): Promise<void> {
    this.documents.set(document.id, document);
    console.log(`Updated document in index: ${document.id}`);
  }

  async rebuild(): Promise<void> {
    console.log('Rebuilding index...');
    // インデックス再構築処理（実装予定）
  }

  async getIndexInfo(): Promise<IndexInfo> {
    return {
      documentCount: this.documents.size,
      lastUpdated: new Date(),
      version: '1.0.0',
    };
  }
}