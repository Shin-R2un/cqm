/**
 * CLI ユーティリティ関数
 */
import chalk from 'chalk';

export function logSuccess(message: string): void {
  console.log(chalk.green(`✅ ${message}`));
}

export function logError(message: string): void {
  console.error(chalk.red(`❌ ${message}`));
}

export function logWarning(message: string): void {
  console.warn(chalk.yellow(`⚠️  ${message}`));
}

export function logInfo(message: string): void {
  console.log(chalk.blue(`ℹ️  ${message}`));
}

export function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}