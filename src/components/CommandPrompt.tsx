import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

export function CommandPrompt({ onDone }: { onDone: (command: string) => void }) {
  const [value, setValue] = useState('')
  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) onDone(value.trim())
      return
    }
    if (key.backspace || key.delete) {
      setValue(current => [...current].slice(0, -1).join(''))
      return
    }
    if (input && !key.ctrl && !key.meta) setValue(current => current + input)
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="#7aa2f7">json-rpc-debug-tui</Text>
      <Text>command to spawn:</Text>
      <Text>❯ {value}<Text inverse> </Text></Text>
      <Text color="#565f89">example: opencode acp  ·  enter to start</Text>
    </Box>
  )
}
