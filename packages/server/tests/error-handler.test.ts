/**
 * ErrorHandler テストスイート
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorHandler } from '../src/error/index.js';
import { CQMError } from '@cqm/shared';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('エラーハンドリング', () => {
    it('CQMErrorで正しいMCPレスポンスを生成する', () => {
      const error = new CQMError('Test error', 'CONFIG_ERROR');
      const context = { sessionId: 'test-session', method: 'test', requestId: 'req-1' };
      
      const response = errorHandler.handleError(error, context);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-1');
      expect(response.error).toBeDefined();
      expect(response.error!.message).toBe('Test error');
      expect(response.error!.data.type).toBe('CONFIG_ERROR');
    });

    it('一般的なErrorで正しいMCPレスポンスを生成する', () => {
      const error = new Error('General error');
      const context = { sessionId: 'test-session', method: 'test', requestId: 'req-2' };
      
      const response = errorHandler.handleError(error, context);
      
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-2');
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32603);
      expect(response.error!.message).toBe('General error');
    });

    it('不明なエラーをサニタイズする', () => {
      const error = { sensitive: 'secret-key', message: 'Safe message' };
      const context = { sessionId: 'test-session', method: 'test', requestId: 'req-3' };
      
      const response = errorHandler.handleError(error, context);
      
      expect(response.error!.message).toBe('{"sensitive":"secret-key","message":"Safe message"}');
      expect(response.error!.code).toBe(-32603);
    });
  });

  describe('エラー統計とログ', () => {
    it('エラー統計を正しく収集する', () => {
      const error1 = new CQMError('Error 1', 'CONFIG_ERROR');
      const error2 = new Error('Error 2');
      const error3 = new CQMError('Error 3', 'CONFIG_ERROR');
      
      errorHandler.handleError(error1, { sessionId: 'session1', method: 'method1' });
      errorHandler.handleError(error2, { sessionId: 'session2', method: 'method2' });
      errorHandler.handleError(error3, { sessionId: 'session1', method: 'method1' });
      
      const stats = errorHandler.getErrorStats();
      
      expect(stats.total).toBe(3);
      expect(stats.bySeverity.high).toBe(2); // CONFIG_ERRORはHIGH
      expect(stats.bySeverity.low).toBe(1); // 一般エラーはLOW
    });

    it('エラー履歴を保持する（最大件数）', () => {
      // 10個のエラーを生成
      for (let i = 0; i < 10; i++) {
        const error = new Error(`Error ${i}`);
        errorHandler.handleError(error, { sessionId: 'test', method: 'test' });
      }
      
      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(10);
      
      // 最近のエラーリストを取得
      const recentErrors = errorHandler.getRecentErrors(5);
      expect(recentErrors.length).toBe(5);
      expect(recentErrors[4].error.message).toBe('Error 9'); // 最新のエラー
    });

    it('エラーログをクリアできる', () => {
      const error = new Error('Test error');
      errorHandler.handleError(error, { sessionId: 'test', method: 'test' });
      
      let stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      
      errorHandler.clearErrorLog();
      
      stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(0);
    });
  });
});