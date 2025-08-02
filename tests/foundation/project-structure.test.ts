/**
 * プロジェクト構造テスト
 * テストファースト: 期待する構造を定義してから実装
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();

describe('Project Structure Tests', () => {
  describe('Root Configuration Files', () => {
    it('should have package.json with correct workspace configuration', () => {
      const packageJsonPath = join(PROJECT_ROOT, 'package.json');
      expect(existsSync(packageJsonPath)).toBe(true);
      
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      
      // ワークスペース設定の確認
      expect(packageJson.workspaces).toEqual(['packages/*']);
      expect(packageJson.private).toBe(true);
      
      // 必須スクリプトの確認
      expect(packageJson.scripts).toMatchObject({
        build: 'turbo run build',
        test: 'turbo run test',
        dev: 'turbo run dev',
        lint: 'turbo run lint'
      });
      
      // Turborepo依存関係
      expect(packageJson.devDependencies.turbo).toBeDefined();
      expect(packageJson.devDependencies.typescript).toBeDefined();
      expect(packageJson.devDependencies.vitest).toBeDefined();
    });

    it('should have turbo.json with correct pipeline configuration', () => {
      const turboJsonPath = join(PROJECT_ROOT, 'turbo.json');
      expect(existsSync(turboJsonPath)).toBe(true);
      
      const turboJson = JSON.parse(readFileSync(turboJsonPath, 'utf-8'));
      
      // パイプライン設定の確認
      expect(turboJson.pipeline).toBeDefined();
      expect(turboJson.pipeline.build).toBeDefined();
      expect(turboJson.pipeline.test).toBeDefined();
      expect(turboJson.pipeline.dev).toBeDefined();
      
      // ビルド依存関係の確認
      expect(turboJson.pipeline.test.dependsOn).toContain('build');
    });

    it('should have TypeScript configuration', () => {
      const tsconfigPath = join(PROJECT_ROOT, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);
      
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      
      // 基本設定の確認
      expect(tsconfig.compilerOptions).toBeDefined();
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
      expect(tsconfig.compilerOptions.strict).toBe(true);
    });
  });

  describe('Package Structure', () => {
    const expectedPackages = [
      '@cqm/server',
      '@cqm/rag', 
      '@cqm/shared',
      '@cqm/cli'
    ];

    it('should have packages directory', () => {
      const packagesDir = join(PROJECT_ROOT, 'packages');
      expect(existsSync(packagesDir)).toBe(true);
    });

    expectedPackages.forEach(packageName => {
      const packageDir = packageName.replace('@cqm/', '');
      
      it(`should have ${packageName} package directory`, () => {
        const packagePath = join(PROJECT_ROOT, 'packages', packageDir);
        expect(existsSync(packagePath)).toBe(true);
      });

      it(`should have ${packageName} package.json`, () => {
        const packageJsonPath = join(PROJECT_ROOT, 'packages', packageDir, 'package.json');
        expect(existsSync(packageJsonPath)).toBe(true);
        
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        expect(packageJson.name).toBe(packageName);
        expect(packageJson.version).toBeDefined();
        expect(packageJson.scripts).toBeDefined();
      });

      it(`should have ${packageName} TypeScript configuration`, () => {
        const tsconfigPath = join(PROJECT_ROOT, 'packages', packageDir, 'tsconfig.json');
        expect(existsSync(tsconfigPath)).toBe(true);
      });

      it(`should have ${packageName} source directory`, () => {
        const srcPath = join(PROJECT_ROOT, 'packages', packageDir, 'src');
        expect(existsSync(srcPath)).toBe(true);
      });

      it(`should have ${packageName} tests directory`, () => {
        const testsPath = join(PROJECT_ROOT, 'packages', packageDir, 'tests');
        expect(existsSync(testsPath)).toBe(true);
      });
    });
  });

  describe('Development Environment', () => {
    it('should have ESLint configuration', () => {
      const eslintConfigPath = join(PROJECT_ROOT, '.eslintrc.json');
      expect(existsSync(eslintConfigPath)).toBe(true);
      
      const eslintConfig = JSON.parse(readFileSync(eslintConfigPath, 'utf-8'));
      expect(eslintConfig.extends).toContain('@typescript-eslint/recommended');
    });

    it('should have Prettier configuration', () => {
      const prettierConfigPath = join(PROJECT_ROOT, '.prettierrc');
      expect(existsSync(prettierConfigPath)).toBe(true);
    });

    it('should have appropriate .gitignore', () => {
      const gitignorePath = join(PROJECT_ROOT, '.gitignore');
      expect(existsSync(gitignorePath)).toBe(true);
      
      const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('node_modules');
      expect(gitignoreContent).toContain('dist');
      expect(gitignoreContent).toContain('.env');
    });

    it('should have VSCode settings', () => {
      const vscodeSettingsPath = join(PROJECT_ROOT, '.vscode', 'settings.json');
      expect(existsSync(vscodeSettingsPath)).toBe(true);
    });
  });
});