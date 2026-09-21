import { Box, Text } from 'ink'
import { useStore } from '../core/store'

function shorten(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 15)}...${value.slice(-12)}`
}

export function StatusBar() {
  const mode = useStore(state => state.mode)
  const cmd = useStore(state => state.cmd)
  const status = useStore(state => state.status)
  const pid = useStore(state => state.pid)
  const exitCode = useStore(state => state.exitCode)
  const entries = useStore(state => state.entries)
  const showStderr = useStore(state => state.showStderr)
  const offset = useStore(state => state.offset)

  return (
    <Box justifyContent="space-between" width="100%">
      <Box gap={1}>
        <Text bold color="#7aa2f7">json-rpc-debug-tui</Text>
        <Text bold color={mode === 'input' ? '#7aa2f7' : '#e0af68'}>[{mode === 'input' ? 'INPUT' : 'VIEW '}]</Text>
        {status === 'running' ? <Text color="#9ece6a">●</Text> : status === 'exited' ? <Text color="#f7768e">x {exitCode ?? ''}</Text> : <Text color="#e0af68">○</Text>}
        <Text color="#565f89">{shorten(cmd.join(' '), 48)}{pid ? ` (${pid})` : ''}</Text>
      </Box>
      <Box gap={1}>
        <Text color="#565f89">{entries.length} msg</Text>
        <Text color={showStderr ? '#565f89' : '#3b4261'}>stderr {showStderr ? 'on' : 'off'}</Text>
        <Text color={offset === 0 ? '#9ece6a' : '#e0af68'}>{offset === 0 ? '● follow' : `up ${offset}`}</Text>
      </Box>
    </Box>
  )
}
