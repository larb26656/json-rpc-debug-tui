export function createLineSplitter() {
  let buffer = ''
  return {
    feed(chunk: string): string[] {
      buffer += chunk
      const lines: string[] = []
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        let line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        if (line.endsWith('\r')) line = line.slice(0, -1)
        if (line) lines.push(line)
        newline = buffer.indexOf('\n')
      }
      return lines
    },
    rest(): string {
      const line = buffer
      buffer = ''
      return line.endsWith('\r') ? line.slice(0, -1) : line
    },
  }
}
