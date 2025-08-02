/**
 * ConnectionManager テストスイート
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../src/connection/index.js';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager(5); // 最大5接続
  });

  describe('接続管理', () => {
    it('新しい接続を追加できる', () => {
      const sessionId = connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio', // テスト用ダミー
        clientInfo: {
          userAgent: 'test-client',
          origin: 'test-origin'
        }
      });

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(connectionManager.getActiveConnectionCount()).toBe(1);
    });

    it('セッション情報を正しく取得できる', () => {
      const sessionId = connectionManager.addConnection({
        type: 'stdio',
        transport: 'stdio',
        clientInfo: {
          userAgent: 'test-client'
        }
      });

      const session = connectionManager.getSession(sessionId);
      
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
      expect(session?.type).toBe('stdio');
      expect(session?.clientInfo.userAgent).toBe('test-client');
      expect(session?.isInitialized).toBe(false);
    });

    it('接続を削除できる', () => {
      const sessionId = connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: {}
      });

      expect(connectionManager.getActiveConnectionCount()).toBe(1);
      
      connectionManager.removeConnection(sessionId);
      
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
      expect(connectionManager.getSession(sessionId)).toBeUndefined();
    });

    it('最大接続数を超える場合エラーが発生する', () => {
      // 最大接続数まで接続を追加
      for (let i = 0; i < 5; i++) {
        connectionManager.addConnection({
          type: 'websocket',
          transport: 'stdio',
          clientInfo: {}
        });
      }

      expect(connectionManager.getActiveConnectionCount()).toBe(5);

      // 6番目の接続でエラー
      expect(() => {
        connectionManager.addConnection({
          type: 'websocket',
          transport: 'stdio',
          clientInfo: {}
        });
      }).toThrow('Maximum connections reached');
    });
  });

  describe('セッション管理', () => {
    it('セッションのアクティビティを更新できる', () => {
      const sessionId = connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: {}
      });

      const initialSession = connectionManager.getSession(sessionId);
      const initialActivity = initialSession?.lastActivity;

      // 少し待ってからアクティビティを更新
      setTimeout(() => {
        connectionManager.updateActivity(sessionId);
        
        const updatedSession = connectionManager.getSession(sessionId);
        expect(updatedSession?.lastActivity).not.toEqual(initialActivity);
      }, 10);
    });

    it('セッションを初期化できる', () => {
      const sessionId = connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: {}
      });

      const capabilities = { tools: true, resources: false };
      connectionManager.initializeSession(sessionId, capabilities);

      const session = connectionManager.getSession(sessionId);
      expect(session?.isInitialized).toBe(true);
      expect(session?.capabilities).toEqual(capabilities);
    });

    it('アクティブセッション一覧を取得できる', () => {
      const sessionId1 = connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: { userAgent: 'client-1' }
      });

      const sessionId2 = connectionManager.addConnection({
        type: 'stdio',
        transport: 'stdio',
        clientInfo: { userAgent: 'client-2' }
      });

      const sessions = connectionManager.getActiveSessions();
      expect(sessions).toHaveLength(2);
      
      const sessionIds = sessions.map(s => s.id);
      expect(sessionIds).toContain(sessionId1);
      expect(sessionIds).toContain(sessionId2);
    });
  });

  describe('統計とクリーンアップ', () => {
    it('接続統計を正しく取得できる', () => {
      connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: {}
      });

      connectionManager.addConnection({
        type: 'stdio',
        transport: 'stdio',
        clientInfo: {}
      });

      connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: {}
      });

      const stats = connectionManager.getConnectionStats();
      
      expect(stats.total).toBe(3);
      expect(stats.byType.websocket).toBe(2);
      expect(stats.byType.stdio).toBe(1);
      expect(stats.avgSessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('非アクティブセッションをクリーンアップできる', () => {
      const sessionId = connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: {}
      });

      // セッションの最終アクティビティを古い時間に設定
      const session = connectionManager.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date(Date.now() - 600000); // 10分前
      }

      const cleanedCount = connectionManager.cleanupInactiveSessions(300000); // 5分
      
      expect(cleanedCount).toBe(1);
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
    });

    it('全接続をクローズできる', () => {
      connectionManager.addConnection({
        type: 'websocket',
        transport: 'stdio',
        clientInfo: {}
      });

      connectionManager.addConnection({
        type: 'stdio',
        transport: 'stdio',
        clientInfo: {}
      });

      expect(connectionManager.getActiveConnectionCount()).toBe(2);
      
      connectionManager.closeAllConnections();
      
      expect(connectionManager.getActiveConnectionCount()).toBe(0);
    });
  });
});