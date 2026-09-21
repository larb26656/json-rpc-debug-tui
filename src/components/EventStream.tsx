import { Box, Text, measureElement, useStdout } from 'ink'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store'
import { entryToLines, type RenderLine } from '../ui/render'

export function EventStream() {
  const entries = useStore(state => state.entries)
  const expanded = useStore(state => state.expanded)
  const showStderr = useStore(state => state.showStderr)
  const offset = useStore(state => state.offset)
  const { stdout } = useStdout()
  const ref = useRef<any>(null)
  const previousTotal = useRef(0)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (!ref.current) return
    const measured = measureElement(ref.current)
    if (measured.width && measured.height && (measured.width !== size.width || measured.height !== size.height)) {
      setSize({ width: measured.width, height: measured.height })
    }
  })

  const width = size.width || stdout.columns || 80
  const height = size.height || Math.max(3, (stdout.rows || 24) - 8)
  const lines = useMemo<RenderLine[]>(() => entries
    .filter(entry => showStderr || entry.kind !== 'stderr')
    .flatMap(entry => entryToLines(entry, width - 2, Boolean(expanded[entry.key]))), [entries, expanded, showStderr, width])

  const start = Math.max(0, Math.min(Math.max(0, lines.length - height), lines.length - offset - height))
  const visible = lines.slice(start, start + height)

  useEffect(() => {
    const delta = lines.length - previousTotal.current
    previousTotal.current = lines.length
    const state = useStore.getState()
    state.setTotal(lines.length)
    state.setVpH(height)
    state.setFirstVisible(lines[start]?.key ?? null)
    if (delta > 0 && state.offset > 0) state.adjustOffset(delta)
  }, [lines.length, start, height])

  return (
    <Box ref={ref} flexGrow={1} flexDirection="column" width="100%">
      {visible.map((line, index) => (
        <Box key={`${line.key}-${start + index}`} height={1}>
          <Text>{line.segs.map((segment, segmentIndex) => <Text key={segmentIndex} color={segment.color}>{segment.text}</Text>)}</Text>
        </Box>
      ))}
      {Array.from({ length: Math.max(0, height - visible.length) }, (_, index) => <Box key={`empty-${index}`} height={1}><Text> </Text></Box>)}
    </Box>
  )
}
