/**
 * MCP transport layer
 */
export interface MCPTransport {
  send(message: any): void;
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
  disconnect?(): void;
}

export class StdioTransport implements MCPTransport {
  private messageBuffer = '';
  public onMessage?: (message: any) => void;
  public onError?: (error: Error) => void;

  constructor() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', this.handleInput.bind(this));
  }

  private handleInput(chunk: string): void {
    this.messageBuffer += chunk;
    
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        this.processMessage(line);
      }
    }
  }

  private processMessage(line: string): void {
    try {
      const message = JSON.parse(line);
      this.onMessage?.(message);
    } catch (error) {
      this.onError?.(new Error(`Invalid JSON: ${line}`));
    }
  }

  send(message: any): void {
    const serialized = JSON.stringify(message);
    process.stdout.write(serialized + '\n');
  }
}