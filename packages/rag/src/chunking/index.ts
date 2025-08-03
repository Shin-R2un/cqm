/**
 * マルチモーダルチャンク処理 - CQM-TEC-002設計に基づく実装
 */
import { readFileSync } from 'fs';
// import { parse as parseYaml } from 'yaml';
import { CQMError } from '@cqm/shared';
import * as ts from 'typescript';

export interface ChunkStrategy {
  type: 'function' | 'class' | 'interface' | 'section' | 'paragraph' | 'issue' | 'comment';
  maxTokens: number;
  overlap: number;
  preserveContext: boolean;
}

export interface ChunkResult {
  chunks: DocumentChunk[];
  metadata: ChunkingMetadata;
}

export interface DocumentChunk {
  id: string;
  content: string;
  type: ChunkStrategy['type'];
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  index: number;
  title?: string;
  startLine?: number;
  endLine?: number;
  symbols?: string[];
  context?: string;
  tags?: string[];
  parentId?: string;
  language?: string;
}

export interface ChunkingMetadata {
  strategy: ChunkStrategy;
  totalChunks: number;
  sourceType: string;
  processingTime: number;
  warnings: string[];
}

export interface DocumentInput {
  content: string;
  filePath?: string;
  language?: string;
  type: 'typescript' | 'javascript' | 'markdown' | 'github-issue' | 'github-pr' | 'text';
}

export class MultimodalChunker {
  private readonly strategies: Map<string, ChunkStrategy> = new Map([
    ['typescript', { type: 'function', maxTokens: 512, overlap: 50, preserveContext: true }],
    ['javascript', { type: 'function', maxTokens: 512, overlap: 50, preserveContext: true }],
    ['markdown', { type: 'section', maxTokens: 1024, overlap: 100, preserveContext: true }],
    ['github-issue', { type: 'issue', maxTokens: 2048, overlap: 0, preserveContext: false }],
    ['github-pr', { type: 'comment', maxTokens: 1024, overlap: 0, preserveContext: false }],
    ['text', { type: 'paragraph', maxTokens: 512, overlap: 50, preserveContext: false }]
  ]);

  async processDocument(input: DocumentInput): Promise<ChunkResult> {
    const startTime = Date.now();
    const strategy = this.strategies.get(input.type) || this.strategies.get('text')!;
    const warnings: string[] = [];

    try {
      let chunks: DocumentChunk[];

      switch (input.type) {
        case 'typescript':
        case 'javascript':
          chunks = await this.chunkTypeScriptCode(input, strategy, warnings);
          break;
        case 'markdown':
          chunks = await this.chunkMarkdown(input, strategy, warnings);
          break;
        case 'github-issue':
          chunks = await this.chunkGitHubIssue(input, strategy, warnings);
          break;
        case 'github-pr':
          chunks = await this.chunkGitHubPR(input, strategy, warnings);
          break;
        default:
          chunks = await this.chunkText(input, strategy, warnings);
      }

      return {
        chunks,
        metadata: {
          strategy,
          totalChunks: chunks.length,
          sourceType: input.type,
          processingTime: Date.now() - startTime,
          warnings
        }
      };
    } catch (error) {
      throw new CQMError(
        `Failed to chunk document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CHUNKING_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async chunkTypeScriptCode(
    input: DocumentInput, 
    strategy: ChunkStrategy, 
    warnings: string[]
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    try {
      const sourceFile = ts.createSourceFile(
        input.filePath || 'temp.ts',
        input.content,
        ts.ScriptTarget.Latest,
        true
      );

      let chunkIndex = 0;

      // 関数とクラスを抽出
      const visit = (node: ts.Node) => {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
          const chunk = this.extractFunctionChunk(node, sourceFile, chunkIndex++, input.content);
          if (chunk) chunks.push(chunk);
        } else if (ts.isClassDeclaration(node)) {
          const chunk = this.extractClassChunk(node, sourceFile, chunkIndex++, input.content);
          if (chunk) chunks.push(chunk);
        } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
          const chunk = this.extractTypeChunk(node, sourceFile, chunkIndex++, input.content);
          if (chunk) chunks.push(chunk);
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      // インポート文をコンテキストとして保持
      const imports = this.extractImports(sourceFile, input.content);
      chunks.forEach(chunk => {
        if (chunk.metadata.context === undefined) {
          chunk.metadata.context = imports;
        }
      });

    } catch (error) {
      warnings.push(`TypeScript parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // フォールバックとして行ベースのチャンクに分割
      return this.chunkText(input, strategy, warnings);
    }

    return chunks;
  }

  private extractFunctionChunk(
    node: ts.FunctionDeclaration | ts.MethodDeclaration,
    sourceFile: ts.SourceFile,
    index: number,
    fullContent: string
  ): DocumentChunk | null {
    const start = node.getFullStart();
    const end = node.getEnd();
    const content = fullContent.substring(start, end);
    
    const startPos = sourceFile.getLineAndCharacterOfPosition(start);
    const endPos = sourceFile.getLineAndCharacterOfPosition(end);
    
    const name = node.name?.getText(sourceFile) || `anonymous-${index}`;
    
    return {
      id: `func-${index}-${name}`,
      content: content.trim(),
      type: 'function',
      metadata: {
        index,
        title: name,
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        symbols: [name],
        language: 'typescript'
      }
    };
  }

  private extractClassChunk(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile,
    index: number,
    fullContent: string
  ): DocumentChunk | null {
    const start = node.getFullStart();
    const end = node.getEnd();
    const content = fullContent.substring(start, end);
    
    const startPos = sourceFile.getLineAndCharacterOfPosition(start);
    const endPos = sourceFile.getLineAndCharacterOfPosition(end);
    
    const name = node.name?.getText(sourceFile) || `anonymous-class-${index}`;
    
    // クラス内のメソッド名を抽出
    const symbols = [name];
    node.members.forEach(member => {
      if (ts.isMethodDeclaration(member) && member.name) {
        symbols.push(member.name.getText(sourceFile));
      }
    });

    return {
      id: `class-${index}-${name}`,
      content: content.trim(),
      type: 'class',
      metadata: {
        index,
        title: name,
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        symbols,
        language: 'typescript'
      }
    };
  }

  private extractTypeChunk(
    node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile,
    index: number,
    fullContent: string
  ): DocumentChunk | null {
    const start = node.getFullStart();
    const end = node.getEnd();
    const content = fullContent.substring(start, end);
    
    const startPos = sourceFile.getLineAndCharacterOfPosition(start);
    const endPos = sourceFile.getLineAndCharacterOfPosition(end);
    
    const name = node.name.getText(sourceFile);
    
    return {
      id: `type-${index}-${name}`,
      content: content.trim(),
      type: 'interface',
      metadata: {
        index,
        title: name,
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        symbols: [name],
        language: 'typescript'
      }
    };
  }

  private extractImports(sourceFile: ts.SourceFile, fullContent: string): string {
    const imports: string[] = [];
    
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const start = node.getFullStart();
        const end = node.getEnd();
        imports.push(fullContent.substring(start, end).trim());
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports.join('\n');
  }

  private async chunkMarkdown(
    input: DocumentInput, 
    strategy: ChunkStrategy, 
    warnings: string[]
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const lines = input.content.split('\n');
    
    let currentSection: {
      level: number;
      title: string;
      content: string[];
      startLine: number;
    } | null = null;
    
    let chunkIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // 前のセクションを保存
        if (currentSection) {
          const chunk = this.createMarkdownChunk(currentSection, chunkIndex++, i);
          if (chunk) chunks.push(chunk);
        }
        
        // 新しいセクション開始
        currentSection = {
          level: headerMatch[1].length,
          title: headerMatch[2],
          content: [line],
          startLine: i + 1
        };
      } else {
        // 現在のセクションにコンテンツを追加
        if (currentSection) {
          currentSection.content.push(line);
        } else {
          // ヘッダーなしのコンテンツ（フロントマターなど）
          if (!currentSection) {
            currentSection = {
              level: 0,
              title: 'Document Header',
              content: [line],
              startLine: i + 1
            };
          }
        }
      }
    }

    // 最後のセクションを保存
    if (currentSection) {
      const chunk = this.createMarkdownChunk(currentSection, chunkIndex, lines.length);
      if (chunk) chunks.push(chunk);
    }

    return chunks;
  }

  private createMarkdownChunk(
    section: { level: number; title: string; content: string[]; startLine: number },
    index: number,
    endLine: number
  ): DocumentChunk | null {
    const content = section.content.join('\n').trim();
    if (!content) return null;

    return {
      id: `section-${index}-${section.title.toLowerCase().replace(/\s+/g, '-')}`,
      content,
      type: 'section',
      metadata: {
        index,
        title: section.title,
        startLine: section.startLine,
        endLine,
        language: 'markdown'
      }
    };
  }

  private async chunkGitHubIssue(
    input: DocumentInput, 
    strategy: ChunkStrategy, 
    warnings: string[]
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    try {
      // GitHub Issue のJSONフォーマットを想定
      const issue = JSON.parse(input.content);
      
      // メインのIssue内容
      chunks.push({
        id: `issue-${issue.number || 'unknown'}`,
        content: `# ${issue.title}\n\n${issue.body || ''}`,
        type: 'issue',
        metadata: {
          index: 0,
          title: issue.title,
          symbols: [`#${issue.number}`],
          tags: issue.labels?.map((label: any) => label.name) || []
        }
      });

      // コメントをチャンクに分割
      if (issue.comments && Array.isArray(issue.comments)) {
        issue.comments.forEach((comment: any, index: number) => {
          chunks.push({
            id: `comment-${issue.number}-${index}`,
            content: comment.body || '',
            type: 'comment',
            metadata: {
              index: index + 1,
              title: `Comment by ${comment.user?.login || 'unknown'}`,
              parentId: `issue-${issue.number}`
            }
          });
        });
      }
      
    } catch (error) {
      warnings.push(`GitHub Issue parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // フォールバックとしてテキストチャンクに分割
      return this.chunkText(input, strategy, warnings);
    }

    return chunks;
  }

  private async chunkGitHubPR(
    input: DocumentInput, 
    strategy: ChunkStrategy, 
    warnings: string[]
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    
    try {
      // GitHub PR のJSONフォーマットを想定
      const pr = JSON.parse(input.content);
      
      // メインのPR内容
      chunks.push({
        id: `pr-${pr.number || 'unknown'}`,
        content: `# ${pr.title}\n\n${pr.body || ''}`,
        type: 'issue', // PRもIssueタイプとして扱う
        metadata: {
          index: 0,
          title: pr.title,
          symbols: [`#${pr.number}`],
          tags: pr.labels?.map((label: any) => label.name) || []
        }
      });

      // レビューコメントをチャンクに分割
      if (pr.review_comments && Array.isArray(pr.review_comments)) {
        pr.review_comments.forEach((comment: any, index: number) => {
          chunks.push({
            id: `review-${pr.number}-${index}`,
            content: comment.body || '',
            type: 'comment',
            metadata: {
              index: index + 1,
              title: `Review by ${comment.user?.login || 'unknown'}`,
              parentId: `pr-${pr.number}`
            }
          });
        });
      }
      
    } catch (error) {
      warnings.push(`GitHub PR parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // フォールバックとしてテキストチャンクに分割
      return this.chunkText(input, strategy, warnings);
    }

    return chunks;
  }

  private async chunkText(
    input: DocumentInput, 
    strategy: ChunkStrategy, 
    warnings: string[]
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    const paragraphs = input.content.split(/\n\s*\n/).filter(p => p.trim());
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim()) {
        chunks.push({
          id: `text-${index}`,
          content: paragraph.trim(),
          type: 'paragraph',
          metadata: {
            index,
            title: `Paragraph ${index + 1}`
          }
        });
      }
    });

    return chunks;
  }

  setStrategy(documentType: string, strategy: ChunkStrategy): void {
    this.strategies.set(documentType, strategy);
  }

  getStrategy(documentType: string): ChunkStrategy | undefined {
    return this.strategies.get(documentType);
  }

  getAllStrategies(): Map<string, ChunkStrategy> {
    return new Map(this.strategies);
  }
}

// ユーティリティ関数
export function estimateTokenCount(text: string): number {
  // GPT-4 tokenizer を近似した単純な実装
  return Math.ceil(text.length / 4);
}

export function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'md': 'markdown',
    'txt': 'text',
    'json': 'text',
    'yaml': 'text',
    'yml': 'text'
  };

  return languageMap[ext] || 'text';
}

export function detectDocumentType(content: string, filePath?: string): DocumentInput['type'] {
  // ファイル拡張子による判定
  if (filePath) {
    const language = detectLanguage(filePath);
    if (language === 'typescript' || language === 'javascript') {
      return language as DocumentInput['type'];
    }
    if (language === 'markdown') {
      return 'markdown';
    }
  }

  // コンテンツによる判定
  try {
    const parsed = JSON.parse(content);
    if (parsed.pull_request) {
      return 'github-pr';
    }
    if (parsed.number && parsed.title) {
      return 'github-issue';
    }
  } catch {
    // JSON parseが失敗した場合は続行
  }

  // Markdownヘッダーの存在チェック
  if (content.includes('#') && /^#{1,6}\s+.+$/m.test(content)) {
    return 'markdown';
  }

  // TypeScript/JavaScript コードの検出
  if (content.includes('function') || content.includes('class') || content.includes('import')) {
    if (content.includes('interface') || content.includes(': ')) {
      return 'typescript';
    }
    return 'javascript';
  }

  return 'text';
}