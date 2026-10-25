export interface ConsoleSession {
  nodeId: string;
  onData(cb: (chunk: Buffer) => void): void;
  write(chunk: Buffer): void;
  resize?(cols: number, rows: number): void;
  close(): void;
}
