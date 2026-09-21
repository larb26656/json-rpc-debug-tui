import { Box, useApp, useInput } from 'ink'
import { useEffect, useRef } from 'react'
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
    <Box flexDirection="column" height="100%" width="100%">
      <StatusBar />
      <EventStream />
      <InputBox onSend={send} />
      <HelpLine />
    </Box>
  )
}
