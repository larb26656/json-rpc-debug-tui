import { createLineSplitter } from './splitter'

export interface ConnectionHandlers {
  onSpawn: (pid: number) => void
  onRx: (line: string) => void
  onStderr: (line: string) => void
  onExit: (code: number | null) => void
}

export class RpcConnection {
  private readonly process: any

  constructor(command: string[], options: { cwd?: string; env?: Record<string, string> }, handlers: ConnectionHandlers) {
    this.process = Bun.spawn({
      cmd: command,
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    handlers.onSpawn(this.process.pid)
    void this.read(this.process.stdout, handlers.onRx)
    void this.read(this.process.stderr, handlers.onStderr)
    void this.process.exited.then((code: number | null) => handlers.onExit(code))
  }

  private async read(stream: AsyncIterable<Uint8Array>, callback: (line: string) => void): Promise<void> {
    const decoder = new TextDecoder()
    const splitter = createLineSplitter()
    try {
      for await (const chunk of stream) {
        for (const line of splitter.feed(decoder.decode(chunk, { stream: true }))) callback(line)
      }
      const rest = splitter.rest()
      if (rest) callback(rest)
    } catch {
      // Process termination can close a stream while it is being read.
    }
  }

  send(line: string): boolean {
    try {
      this.process.stdin.write(`${line}\n`)
      this.process.stdin.flush()
      return true
    } catch {
      return false
    }
  }

  kill(): void {
    try {
      this.process.kill()
    } catch {
      // The process may already have exited.
    }
  }
}
