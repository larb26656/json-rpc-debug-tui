import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { useEffect, useRef, useState } from 'react'
import { createController, type ControllerOptions } from './core/controller'
import { useStore } from './core/store'
import { EventStream } from './components/EventStream'
import { HelpLine } from './components/HelpLine'
import { InputBox } from './components/InputBox'
import { StatusBar } from './components/StatusBar'
import { parseJsonSafe } from './ui/json'

export function App({ options }: { options: ControllerOptions }) {
  const controller = useRef<ReturnType<typeof createController> | null>(null)
  const { exit } = useApp()
  const { stdout } = useStdout()
  const [size, setSize] = useState(() => ({ columns: stdout.columns || 80, rows: stdout.rows || 24 }))

  useEffect(() => {
    const resize = () => setSize({ columns: stdout.columns || 80, rows: stdout.rows || 24 })
    stdout.on('resize', resize)
    resize()
    return () => { stdout.off('resize', resize) }
  }, [stdout])

  useEffect(() => {
    const instance = createController(options)
    controller.current = instance
    if (options.logFile) useStore.getState().push({ key: 0, ts: Date.now(), kind: 'info', raw: `passive log -> ${options.logFile}` })
    instance.start()
    const flushTimer = setInterval(() => useStore.getState().flush(), 16)
    const cleanup = () => instance.kill()
    process.on('exit', cleanup)
    return () => {
      clearInterval(flushTimer)
      process.off('exit', cleanup)
      instance.kill()
    }
  }, [options])

  useInput((input, key) => {
    const state = useStore.getState()
    if (key.tab || input === '\t') return state.toggleMode()
    if (key.escape && state.mode === 'input') return state.setMode('view')
    if (key.ctrl && input === 'c') {
      if (state.mode === 'input' && state.lines.join('').length > 0) state.resetEditor()
      else {
        controller.current?.kill()
        exit()
      }
      return
    }
    if (key.ctrl && input === 'l') return state.clearEntries()
    if (key.ctrl && input === 'f') return state.toggleStderr()
    if (key.ctrl && input === 's') return controller.current?.exportNow()
    if (key.ctrl && input === 'r') return controller.current?.restart()
    const page = Math.max(3, Math.floor((state.vpH || 10) / 2))
    if (key.pageUp) return state.scrollBy(page)
    if (key.pageDown) return state.scrollBy(-page)
    if (state.mode !== 'view') return
    if (input === 'j' || key.downArrow) return state.scrollBy(-1)
    if (input === 'k' || key.upArrow) return state.scrollBy(1)
    if (key.ctrl && input === 'd') return state.scrollBy(-page)
    if (key.ctrl && input === 'u') return state.scrollBy(page)
    if (input === 'g') return state.scrollTop()
    if (input === 'G') return state.scrollBottom()
    if (input === 'f') return state.toggleStderr()
  })

  const send = (text: string) => {
    const parsed = parseJsonSafe(text)
    if (!parsed.ok) return
    const compact = JSON.stringify(parsed.value)
    controller.current?.send(compact)
    const state = useStore.getState()
    state.recordHistory(compact)
    state.resetEditor()
  }

  return (
    <Box flexDirection="column" height={size.rows} width={size.columns} overflow="hidden">
      {size.columns < 40 || size.rows < 9
        ? <Text wrap="truncate-end">Terminal too small; resize to at least 40 x 9.</Text>
        : <>
          <StatusBar />
          <EventStream columns={size.columns} rows={size.rows} />
          <InputBox onSend={send} maxHeight={size.rows - 4} width={size.columns} />
          <HelpLine />
        </>}
    </Box>
  )
}
