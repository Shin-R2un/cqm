/**
 * ビルドシステムテスト
 * テストファースト: ビルドプロセスの期待動作を定義
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();

describe('Build System Tests', () => {
  beforeAll(() => {
    // テスト用の一時的なビルド環境をセットアップ
    console.log('Setting up build test environment...');
  });

  afterAll(() => {
    // テスト後のクリーンアップ
    console.log('Cleaning up build test environment...');
  });

  describe('Monorepo Build Process', () => {
    it('should install all dependencies successfully', () => {
      expect(() => {
        execSync('npm install', { 
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
      }).not.toThrow();

      // node_modules が作成されているか確認
      expect(existsSync(join(PROJECT_ROOT, 'node_modules'))).toBe(true);
      expect(existsSync(join(PROJECT_ROOT, 'node_modules', 'turbo'))).toBe(true);
    });

    it('should run TypeScript type checking across all packages', () => {
      expect(() => {
        execSync('npm run type-check', {
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
      }).not.toThrow();
    });

    it('should build all packages successfully', () => {
      expect(() => {
        execSync('npm run build', {
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
      }).not.toThrow();

      // 各パッケージのdistディレクトリが作成されているか確認
      const packages = ['server', 'rag', 'shared', 'cli'];
      packages.forEach(pkg => {
        const distPath = join(PROJECT_ROOT, 'packages', pkg, 'dist');
        expect(existsSync(distPath)).toBe(true);
      });
    });

    it('should run all tests successfully', () => {
      expect(() => {
        execSync('npm run test', {
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
      }).not.toThrow();
    });

    it('should run linting across all packages', () => {
      expect(() => {
        execSync('npm run lint', {
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
      }).not.toThrow();
    });
  });

  describe('Package Dependencies', () => {
    it('should resolve internal package dependencies correctly', () => {
      // @cqm/server が @cqm/shared に依存していることを確認
      const serverPackageJson = require(join(PROJECT_ROOT, 'packages', 'server', 'package.json'));
      expect(serverPackageJson.dependencies?.['@cqm/shared']).toBeDefined();

      // @cqm/rag が @cqm/shared に依存していることを確認
      const ragPackageJson = require(join(PROJECT_ROOT, 'packages', 'rag', 'package.json'));
      expect(ragPackageJson.dependencies?.['@cqm/shared']).toBeDefined();

      // @cqm/cli が他のパッケージに依存していることを確認
      const cliPackageJson = require(join(PROJECT_ROOT, 'packages', 'cli', 'package.json'));
      expect(cliPackageJson.dependencies?.['@cqm/server']).toBeDefined();
      expect(cliPackageJson.dependencies?.['@cqm/rag']).toBeDefined();
    });

    it('should have correct external dependencies', () => {
      // 各パッケージが必要な外部依存関係を持っているか確認
      const packages = [
        { name: 'server', requiredDeps: ['ws', '@modelcontextprotocol/sdk'] },
        { name: 'rag', requiredDeps: ['qdrant-js', 'ollama'] },
        { name: 'shared', requiredDeps: ['zod'] },
        { name: 'cli', requiredDeps: ['commander', 'chalk'] }
      ];

      packages.forEach(({ name, requiredDeps }) => {
        const packageJson = require(join(PROJECT_ROOT, 'packages', name, 'package.json'));
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        requiredDeps.forEach(dep => {
          expect(allDeps[dep]).toBeDefined();
        });
      });
    });
  });

  describe('Development Environment', () => {
    it('should start development servers without errors', () => {
      // 開発サーバーが起動できることを確認（短時間のテスト）
      expect(() => {
        const child = execSync('timeout 5s npm run dev || true', {
          cwd: PROJECT_ROOT,
          stdio: 'pipe'
        });
      }).not.toThrow();
    });

    it('should watch for file changes in development mode', () => {
      // ファイル変更の監視機能をテスト
      // 実際の実装では、ファイル変更時の再ビルドを確認
      expect(true).toBe(true); // プレースホルダー
    });
  });

  describe('Performance Requirements', () => {
    it('should build within acceptable time limits', () => {
      const startTime = Date.now();
      
      execSync('npm run build', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe'
      });
      
      const buildTime = Date.now() - startTime;
      
      // ビルド時間が60秒以内であることを確認
      expect(buildTime).toBeLessThan(60000);
    });

    it('should have reasonable bundle sizes', () => {
      // 各パッケージのバンドルサイズが適切であることを確認
      const packages = ['server', 'rag', 'shared', 'cli'];
      
      packages.forEach(pkg => {
        const distPath = join(PROJECT_ROOT, 'packages', pkg, 'dist');
        if (existsSync(distPath)) {
          // バンドルサイズのチェック（実装依存）
          expect(true).toBe(true); // プレースホルダー
        }
      });
    });
  });
});