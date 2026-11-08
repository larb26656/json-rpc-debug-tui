import { Box, Text, measureElement } from 'ink'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../core/store'
import { entryToLines, type RenderLine } from '../ui/render'

export function EventStream({ columns, rows }: { columns: number; rows: number }) {
  const entries = useStore(state => state.entries)
  const showStderr = useStore(state => state.showStderr)
  const offset = useStore(state => state.offset)
  const ref = useRef<any>(null)
  const previousTotal = useRef(0)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const previous = useRef<{ width: number; height: number; lines: RenderLine[]; start: number } | null>(null)

  useLayoutEffect(() => {
    if (!ref.current) return
    const measured = measureElement(ref.current)
    if (measured.width && measured.height && (measured.width !== size.width || measured.height !== size.height)) {
      setSize({ width: measured.width, height: measured.height })
    }
  })

  const width = size.width || columns
  const height = size.height || Math.max(1, rows - 8)
  const lines = useMemo<RenderLine[]>(() => entries
    .filter(entry => showStderr || entry.kind !== 'stderr')
    .flatMap(entry => entryToLines(entry, width - 2)), [entries, showStderr, width])

  let start = Math.max(0, Math.min(Math.max(0, lines.length - height), lines.length - offset - height))
  const resized = previous.current !== null && (previous.current.width !== width || previous.current.height !== height)
  if (resized && offset > 0 && previous.current) {
    const old = previous.current
    const key = old.lines[old.start]?.key
    const first = lines.findIndex(line => line.key === key)
    if (first >= 0) {
      const oldFirst = old.lines.findIndex(line => line.key === key)
      let last = first
      while (last + 1 < lines.length && lines[last + 1].key === key) last++
      start = Math.min(Math.max(0, lines.length - height), Math.min(last, first + old.start - oldFirst))
    }
  }
  const visible = lines.slice(start, start + height)
  const visibleKeySignature = visible.map(line => line.key).join(',')

  useLayoutEffect(() => {
    if (resized && offset > 0) useStore.getState().adjustOffset(Math.max(0, lines.length - height - start) - offset)
    previous.current = { width, height, lines, start }
  })

  useEffect(() => {
    const delta = lines.length - previousTotal.current
    previousTotal.current = lines.length
    const state = useStore.getState()
    state.setTotal(lines.length)
    state.setVpH(height)
    state.setFirstVisible(lines[start]?.key ?? null)
    state.setVisibleKeys(visible.map(line => line.key))
    if (!resized && delta > 0 && state.offset > 0) state.adjustOffset(delta)
  }, [lines.length, start, height, visibleKeySignature])

  return (
    <Box ref={ref} flexGrow={1} flexShrink={1} flexDirection="column" width="100%" overflow="hidden">
      {visible.map((line, index) => (
        <Box key={`${line.key}-${start + index}`} height={1}>
          <Text>{line.segs.map((segment, segmentIndex) => <Text key={segmentIndex} color={segment.color}>{segment.text}</Text>)}</Text>
        </Box>
      ))}
      {Array.from({ length: Math.max(0, height - visible.length) }, (_, index) => <Box key={`empty-${index}`} height={1}><Text> </Text></Box>)}
    </Box>
  )
}
