/**
 * 接続管理
 */
export interface ClientSession {
  id: string;
  connectedAt: Date;
  lastActivity: Date;
}

export class ConnectionManager {
  private sessions = new Map<string, ClientSession>();
  private readonly maxConnections: number;

  constructor(maxConnections = 10) {
    this.maxConnections = maxConnections;
  }

  addSession(sessionId: string): void {
    if (this.sessions.size >= this.maxConnections) {
      throw new Error('Maximum connections reached');
    }

    this.sessions.set(sessionId, {
      id: sessionId,
      connectedAt: new Date(),
      lastActivity: new Date(),
    });
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSession(sessionId: string): ClientSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}