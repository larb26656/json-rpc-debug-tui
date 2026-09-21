export {}

const decoder = new TextDecoder()
let buffer = ''
let sessionNumber = 0

const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`)
const log = (message: string) => process.stderr.write(`[mock-agent] ${message}\n`)

function handle(line: string): void {
  let message: any
  try {
    message = JSON.parse(line)
  } catch {
    log(`invalid JSON: ${line}`)
    return
  }
  log(`received ${message.method ?? 'response'}${message.id === undefined ? '' : ` #${message.id}`}`)
  switch (message.method) {
    case 'initialize':
      send({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: false }, authMethods: [] } })
      break
    case 'session/new':
      send({ jsonrpc: '2.0', id: message.id, result: { sessionId: `mock-${++sessionNumber}` } })
      break
    case 'session/prompt': {
      const sessionId = message.params?.sessionId ?? 'mock-unknown'
      let chunk = 0
      const timer = setInterval(() => {
        chunk++
        if (chunk <= 3) {
          send({ jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: { sessionUpdate: 'agent_message', content: { type: 'text', text: `stream chunk ${chunk} `.repeat(12) } } } })
          log(`progress ${chunk}/3`)
        } else {
          clearInterval(timer)
          send({ jsonrpc: '2.0', id: message.id, result: { stopReason: 'end_turn' } })
        }
      }, 180)
      break
    }
    case 'session/cancel':
      send({ jsonrpc: '2.0', id: message.id, result: {} })
      break
    default:
      if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `method not found: ${message.method}` } })
  }
}

for await (const chunk of process.stdin) {
  buffer += decoder.decode(chunk as Uint8Array, { stream: true })
  let newline = buffer.indexOf('\n')
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim()
    buffer = buffer.slice(newline + 1)
    if (line) handle(line)
    newline = buffer.indexOf('\n')
  }
}
