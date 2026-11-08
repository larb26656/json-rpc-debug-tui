import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { RpcConnection } from './connection'
import { allocEntryKey, useStore, type Entry } from './store'

export interface ControllerOptions {
  cmd: string[]
  cwd?: string
  env?: Record<string, string>
  logFile?: string
}

const now = () => Date.now()

export function createController(options: ControllerOptions) {
  let connection: RpcConnection | null = null
  let generation = 0
  useStore.setState({ cmd: options.cmd, cwd: options.cwd, logFile: options.logFile ?? null })

  const push = (entry: any) => {
    useStore.getState().push({ ...entry, key: allocEntryKey(), ts: now() } as Entry)
  }
  let logError: string | null = null
  if (options.logFile) {
    try {
      mkdirSync(dirname(options.logFile), { recursive: true })
      appendFileSync(options.logFile, '')
      push({ kind: 'info', raw: `passive log -> ${options.logFile}` })
    } catch (error) {
      logError = String(error)
      push({ kind: 'info', raw: `log failed (${options.logFile}): ${logError}` })
    }
  }

  const log = (dir: string, raw: string) => {
    if (!options.logFile) return
    try {
      let value: unknown
      try { value = JSON.parse(raw) } catch { value = { text: raw } }
      appendFileSync(options.logFile, `${JSON.stringify({ ts: now(), dir, raw: value })}\n`)
      logError = null
    } catch (error) {
      const message = String(error)
      if (message !== logError) push({ kind: 'info', raw: `log failed (${options.logFile}): ${message}` })
      logError = message
    }
  }

  const start = () => {
    const currentGeneration = ++generation
    push({ kind: 'info', raw: `spawn: ${options.cmd.join(' ')}` })
    try {
      connection = new RpcConnection(options.cmd, { cwd: options.cwd, env: options.env }, {
        onSpawn: pid => useStore.setState({ status: 'running', pid, exitCode: null }),
        onRx: raw => {
          log('rx', raw)
          const receivedAt = now()
          let message: any
          try {
            message = JSON.parse(raw)
          } catch {
            push({ kind: 'rx', raw })
            return
          }

          let reqMethod: string | undefined
          let latency: number | undefined
          if (message && typeof message === 'object' && message.id !== undefined && ('result' in message || 'error' in message)) {
            const entries = useStore.getState().entries
            for (let index = entries.length - 1; index >= 0; index--) {
              const sent = entries[index]
              if (sent.kind === 'tx' && String(sent.metaId) === String(message.id)) {
                latency = receivedAt - sent.ts
                reqMethod = sent.method
                sent.latency = latency
                break
              }
            }
          }
          push({ kind: 'rx', raw, ...(reqMethod ? { reqMethod } : {}), ...(latency !== undefined ? { latency } : {}) })
        },
        onStderr: raw => {
          log('stderr', raw)
          push({ kind: 'stderr', raw })
        },
        onExit: code => {
          if (currentGeneration !== generation) return
          useStore.setState({ status: 'exited', exitCode: code, pid: null })
          push({ kind: 'info', raw: `agent exited (${code ?? 'signal'})` })
        },
      })
    } catch (error) {
      useStore.setState({ status: 'exited', exitCode: -1, pid: null })
      push({ kind: 'info', raw: `spawn failed: ${String(error)}` })
    }
  }

  const send = (compactJson: string): boolean => {
    const state = useStore.getState()
    if (state.status !== 'running' || !connection) {
      push({ kind: 'info', raw: 'agent not running - press ctrl+r to restart' })
      return false
    }
    let method: string | undefined
    let metaId: string | number | undefined
    try {
      const message = JSON.parse(compactJson)
      if (message && typeof message === 'object') {
        method = typeof message.method === 'string' ? message.method : undefined
        if (typeof message.id === 'string' || typeof message.id === 'number') metaId = message.id
      }
    } catch {
      return false
    }
    log('tx', compactJson)
    push({ kind: 'tx', raw: compactJson, method, metaId })
    return connection.send(compactJson)
  }

  const restart = () => {
    push({ kind: 'info', raw: 'restarting agent...' })
    connection?.kill()
    connection = null
    start()
  }

  const exportNow = () => {
    const date = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    const filename = `json-rpc-debug-tui-export-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.ndjson`
    const rows = useStore.getState().entries.map(entry => JSON.stringify({ ts: entry.ts, kind: entry.kind, raw: entry.raw }))
    try {
      writeFileSync(filename, `${rows.join('\n')}\n`)
      push({ kind: 'info', raw: `exported ${rows.length} entries -> ${filename}` })
    } catch (error) {
      push({ kind: 'info', raw: `export failed: ${String(error)}` })
    }
  }

  return {
    start,
    send,
    restart,
    exportNow,
    kill: () => connection?.kill(),
  }
}
