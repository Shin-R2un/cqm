/**
 * 接続管理 - WebSocket & Stdio対応の強化版
 */
import { WebSocket } from 'ws';
import { generateId } from '@cqm/shared';

export interface ClientInfo {
  userAgent?: string;
  origin?: string;
  platform?: string;
  version?: string;
}

export interface Connection {
  type: 'websocket' | 'stdio';
  transport: WebSocket | 'stdio';
  clientInfo: ClientInfo;
}

export interface ClientSession {
  id: string;
  type: 'websocket' | 'stdio';
  transport: WebSocket | 'stdio';
  clientInfo: ClientInfo;
  connectedAt: Date;
  lastActivity: Date;
  isInitialized: boolean;
  capabilities?: any;
}

export class ConnectionManager {
  private sessions = new Map<string, ClientSession>();
  private readonly maxConnections: number;

  constructor(maxConnections = 10) {
    this.maxConnections = maxConnections;
  }

  addConnection(connection: Connection): string {
    if (this.sessions.size >= this.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    const sessionId = generateId();
    
    this.sessions.set(sessionId, {
      id: sessionId,
      type: connection.type,
      transport: connection.transport,
      clientInfo: connection.clientInfo,
      connectedAt: new Date(),
      lastActivity: new Date(),
      isInitialized: false
    });

    return sessionId;
  }

  removeConnection(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      // WebSocket接続の場合はクローズ
      if (session.type === 'websocket' && session.transport !== 'stdio') {
        const ws = session.transport as WebSocket;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
      
      this.sessions.delete(sessionId);
    }
  }

  getSession(sessionId: string): ClientSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  initializeSession(sessionId: string, capabilities?: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isInitialized = true;
      session.capabilities = capabilities;
    }
  }

  getActiveConnectionCount(): number {
    return this.sessions.size;
  }

  getActiveSessions(): ClientSession[] {
    return Array.from(this.sessions.values());
  }

  closeAllConnections(): void {
    for (const session of this.sessions.values()) {
      if (session.type === 'websocket' && session.transport !== 'stdio') {
        const ws = session.transport as WebSocket;
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    }
    
    this.sessions.clear();
  }

  // セッション統計
  getConnectionStats(): {
    total: number;
    byType: Record<string, number>;
    avgSessionDuration: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();
    
    const byType: Record<string, number> = {};
    let totalDuration = 0;
    
    for (const session of sessions) {
      byType[session.type] = (byType[session.type] || 0) + 1;
      totalDuration += now.getTime() - session.connectedAt.getTime();
    }
    
    return {
      total: sessions.length,
      byType,
      avgSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0
    };
  }

  // 非アクティブセッションのクリーンアップ
  cleanupInactiveSessions(maxInactiveTime = 300000): number { // 5分
    const now = new Date();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      
      if (inactiveTime > maxInactiveTime) {
        this.removeConnection(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}