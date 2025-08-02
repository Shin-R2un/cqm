import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    timeout: 30000,
    testTimeout: 30000
  },
  resolve: {
    alias: {
      '@cqm/shared': resolve(__dirname, 'packages/shared/src'),
      '@cqm/server': resolve(__dirname, 'packages/server/src'),
      '@cqm/rag': resolve(__dirname, 'packages/rag/src'),
      '@cqm/cli': resolve(__dirname, 'packages/cli/src')
    }
  }
});