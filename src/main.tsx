#!/usr/bin/env bun
import { render } from 'ink'
import { appendFileSync } from 'node:fs'
import { App } from './App'
import { CommandPrompt } from './components/CommandPrompt'
import type { ControllerOptions } from './core/controller'

type CliOptions = Omit<ControllerOptions, 'cmd'> & { shell: boolean }

function help(): void {
  process.stdout.write(`json-rpc-debug-tui - generic NDJSON JSON-RPC debugger\n\nUsage:\n  json-rpc-debug-tui [options] <command...>\n\nExamples:\n  json-rpc-debug-tui opencode acp\n  json-rpc-debug-tui npx -y @google/gemini-cli --experimental-acp\n  json-rpc-debug-tui --cwd ~/project opencode acp\n\nOptions:\n  --cwd <path>       Working directory for the child process\n  --env KEY=VALUE    Add an environment variable (repeatable)\n  --log <file>       Append all wire messages to a file\n  --shell            Run the command through /bin/sh -c\n  -h, --help         Show this help\n\nWhen no command is provided, json-rpc-debug-tui asks for one inside the TUI.\n`)
}

function parseArgs(argv: string[]): { options: CliOptions; command: string[] } {
  const options: CliOptions = { env: {}, shell: false }
  const command: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--') {
      command.push(...argv.slice(index + 1))
      break
    }
    if (arg === '-h' || arg === '--help') {
      help()
      process.exit(0)
    }
    if (arg === '--cwd') {
      options.cwd = argv[++index]
      continue
    }
    if (arg === '--env') {
      const pair = argv[++index] ?? ''
      const separator = pair.indexOf('=')
      if (separator > 0) options.env![pair.slice(0, separator)] = pair.slice(separator + 1)
      continue
    }
    if (arg === '--log') {
      options.logFile = argv[++index]
      continue
    }
    if (arg === '--shell') {
      options.shell = true
      continue
    }
    command.push(arg)
  }
  return { options, command }
}

function splitPromptCommand(value: string): string[] {
  return value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(part => part.replace(/^(["'])(.*)\1$/, '$2')) ?? []
}

function renderFullscreen(node: Parameters<typeof render>[0], exitOnCtrlC: boolean): ReturnType<typeof render> {
  const enterAlternateScreen = '\u001b[?1049h\u001b[2J\u001b[H'
  const leaveAlternateScreen = '\u001b[?1049l\u001b[0m'
  process.stdout.write(enterAlternateScreen)

  let restored = false
  const restore = () => {
    if (restored) return
    restored = true
    process.stdout.write(leaveAlternateScreen)
  }

  process.once('exit', restore)
  try {
    const instance = render(node, { exitOnCtrlC })
    void instance.waitUntilExit().finally(() => {
      process.removeListener('exit', restore)
      restore()
    })
    return instance
  } catch (error) {
    process.removeListener('exit', restore)
    restore()
    throw error
  }
}

function start(options: CliOptions, command: string[]): void {
  const finalCommand = options.shell ? ['/bin/sh', '-c', command.join(' ')] : command
  if (options.logFile) {
    try { appendFileSync(options.logFile, '') } catch { /* controller reports wire errors through the TUI */ }
  }
  try {
    renderFullscreen(<App options={{ ...options, cmd: finalCommand }} />, false)
  } catch (error) {
    process.stderr.write(`json-rpc-debug-tui requires an interactive terminal: ${String(error)}\n`)
    process.exitCode = 1
  }
}

const parsed = parseArgs(process.argv.slice(2))
if (parsed.command.length) start(parsed.options, parsed.command)
else {
  try {
    let prompt: ReturnType<typeof render>
    prompt = renderFullscreen(<CommandPrompt onDone={value => {
      prompt.unmount()
      void prompt.waitUntilExit().then(() => {
        start(parsed.options, parsed.options.shell ? [value] : splitPromptCommand(value))
      })
    }} />, true)
  } catch (error) {
    process.stderr.write(`json-rpc-debug-tui requires an interactive terminal: ${String(error)}\n`)
    process.exitCode = 1
  }
}
