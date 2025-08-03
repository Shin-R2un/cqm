/**
 * チャンク処理のテストスイート
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  MultimodalChunker, 
  DocumentInput, 
  detectDocumentType,
  detectLanguage,
  estimateTokenCount 
} from '../src/chunking/index.js';

describe('MultimodalChunker', () => {
  let chunker: MultimodalChunker;

  beforeEach(() => {
    chunker = new MultimodalChunker();
  });

  describe('TypeScriptコード処理', () => {
    it('関数定義を正しくチャンクに分割する', async () => {
      const input: DocumentInput = {
        content: `
export function testFunction(param: string): number {
  return param.length;
}

class TestClass {
  method() {
    return 'test';
  }
}
        `,
        filePath: 'test.ts',
        language: 'typescript',
        type: 'typescript'
      };

      const result = await chunker.processDocument(input);

      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].type).toBe('function');
      expect(result.chunks[0].metadata.title).toBe('testFunction');
      expect(result.chunks[1].type).toBe('class');
      expect(result.chunks[1].metadata.title).toBe('TestClass');
    });

    it('インターフェース定義を抽出する', async () => {
      const input: DocumentInput = {
        content: `
interface TestInterface {
  name: string;
  age: number;
}

type TestType = {
  id: string;
};
        `,
        filePath: 'test.ts',
        language: 'typescript',
        type: 'typescript'
      };

      const result = await chunker.processDocument(input);

      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].type).toBe('interface');
      expect(result.chunks[0].metadata.title).toBe('TestInterface');
      expect(result.chunks[1].type).toBe('interface');
      expect(result.chunks[1].metadata.title).toBe('TestType');
    });

    it('不正なTypeScriptコードでフォールバックする', async () => {
      const input: DocumentInput = {
        content: 'invalid typescript code {{{',
        filePath: 'test.ts',
        language: 'typescript',
        type: 'typescript'
      };

      const result = await chunker.processDocument(input);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].type).toBe('paragraph');
      expect(result.metadata.warnings).toContain(expect.stringContaining('TypeScript parsing failed'));
    });
  });

  describe('Markdown処理', () => {
    it('ヘッダー階層に基づいてセクションを分割する', async () => {
      const input: DocumentInput = {
        content: `# Main Title

This is the introduction.

## Section 1

Content of section 1.

### Subsection 1.1

Detailed content.

## Section 2

Content of section 2.
        `,
        filePath: 'test.md',
        language: 'markdown',
        type: 'markdown'
      };

      const result = await chunker.processDocument(input);

      expect(result.chunks).toHaveLength(4);
      expect(result.chunks[0].metadata.title).toBe('Main Title');
      expect(result.chunks[1].metadata.title).toBe('Section 1');
      expect(result.chunks[2].metadata.title).toBe('Subsection 1.1');
      expect(result.chunks[3].metadata.title).toBe('Section 2');
    });

    it('ヘッダーのないコンテンツを処理する', async () => {
      const input: DocumentInput = {
        content: 'Just plain text without headers.',
        filePath: 'test.md',
        language: 'markdown',
        type: 'markdown'
      };

      const result = await chunker.processDocument(input);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.title).toBe('Document Header');
    });
  });

  describe('GitHub Issues処理', () => {
    it('Issue JSONを正しく解析する', async () => {
      const issueData = {
        number: 123,
        title: 'Test Issue',
        body: 'This is the issue description.',
        labels: [
          { name: 'bug' },
          { name: 'high-priority' }
        ],
        comments: [
          {
            user: { login: 'user1' },
            body: 'This is a comment.'
          }
        ]
      };

      const input: DocumentInput = {
        content: JSON.stringify(issueData),
        filePath: 'issue.json',
        type: 'github-issue'
      };

      const result = await chunker.processDocument(input);

      expect(result.chunks).toHaveLength(2); // Issue本体 + 1コメント
      expect(result.chunks[0].type).toBe('issue');
      expect(result.chunks[0].metadata.title).toBe('Test Issue');
      expect(result.chunks[0].metadata.tags).toContain('bug');
      expect(result.chunks[1].type).toBe('comment');
      expect(result.chunks[1].metadata.title).toBe('Comment by user1');
    });

    it('不正なJSON形式でフォールバックする', async () => {
      const input: DocumentInput = {
        content: 'invalid json content',
        filePath: 'issue.json',
        type: 'github-issue'
      };

      const result = await chunker.processDocument(input);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].type).toBe('paragraph');
      expect(result.metadata.warnings).toContain(expect.stringContaining('GitHub Issue parsing failed'));
    });
  });

  describe('戦略管理', () => {
    it('ドキュメントタイプごとの戦略を取得する', () => {
      const tsStrategy = chunker.getStrategy('typescript');
      expect(tsStrategy?.type).toBe('function');
      expect(tsStrategy?.maxTokens).toBe(512);

      const mdStrategy = chunker.getStrategy('markdown');
      expect(mdStrategy?.type).toBe('section');
      expect(mdStrategy?.maxTokens).toBe(1024);
    });

    it('カスタム戦略を設定する', () => {
      const customStrategy = {
        type: 'paragraph' as const,
        maxTokens: 256,
        overlap: 25,
        preserveContext: false
      };

      chunker.setStrategy('custom', customStrategy);
      
      const retrieved = chunker.getStrategy('custom');
      expect(retrieved).toEqual(customStrategy);
    });

    it('すべての戦略を取得する', () => {
      const strategies = chunker.getAllStrategies();
      
      expect(strategies.has('typescript')).toBe(true);
      expect(strategies.has('markdown')).toBe(true);
      expect(strategies.has('github-issue')).toBe(true);
      expect(strategies.has('text')).toBe(true);
    });
  });
});

describe('ユーティリティ関数', () => {
  describe('detectDocumentType', () => {
    it('ファイル拡張子からタイプを検出する', () => {
      expect(detectDocumentType('', 'test.ts')).toBe('typescript');
      expect(detectDocumentType('', 'test.js')).toBe('javascript');
      expect(detectDocumentType('', 'test.md')).toBe('markdown');
    });

    it('コンテンツからタイプを検出する', () => {
      expect(detectDocumentType('# Markdown Header')).toBe('markdown');
      expect(detectDocumentType('function test() {}')).toBe('javascript');
      expect(detectDocumentType('interface Test {}')).toBe('typescript');
    });

    it('GitHub IssueのJSONを検出する', () => {
      const issueJson = JSON.stringify({ number: 1, title: 'Test' });
      expect(detectDocumentType(issueJson)).toBe('github-issue');
    });

    it('GitHub PRのJSONを検出する', () => {
      const prJson = JSON.stringify({ pull_request: true, number: 1 });
      expect(detectDocumentType(prJson)).toBe('github-pr');
    });

    it('不明なコンテンツではtextを返す', () => {
      expect(detectDocumentType('plain text content')).toBe('text');
    });
  });

  describe('detectLanguage', () => {
    it('ファイル拡張子から言語を検出する', () => {
      expect(detectLanguage('test.ts')).toBe('typescript');
      expect(detectLanguage('test.tsx')).toBe('typescript');
      expect(detectLanguage('test.js')).toBe('javascript');
      expect(detectLanguage('test.jsx')).toBe('javascript');
      expect(detectLanguage('test.md')).toBe('markdown');
      expect(detectLanguage('test.txt')).toBe('text');
    });

    it('拡張子がない場合はtextを返す', () => {
      expect(detectLanguage('README')).toBe('text');
    });

    it('未知の拡張子ではtextを返す', () => {
      expect(detectLanguage('test.unknown')).toBe('text');
    });
  });

  describe('estimateTokenCount', () => {
    it('テキストのトークン数を概算する', () => {
      expect(estimateTokenCount('hello world')).toBe(3); // 11文字 / 4 = 2.75 -> 3
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('a')).toBe(1);
    });

    it('長いテキストでも正しく計算する', () => {
      const longText = 'a'.repeat(400);
      expect(estimateTokenCount(longText)).toBe(100); // 400 / 4 = 100
    });
  });
});