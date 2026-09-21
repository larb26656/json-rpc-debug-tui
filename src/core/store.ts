import { create } from 'zustand'

export type Entry =
  | { key: number; ts: number; kind: 'tx'; raw: string; method?: string; metaId?: string | number; latency?: number }
  | { key: number; ts: number; kind: 'rx'; raw: string; reqMethod?: string; latency?: number }
  | { key: number; ts: number; kind: 'stderr'; raw: string }
  | { key: number; ts: number; kind: 'info'; raw: string }

export type Mode = 'input' | 'view'

let nextKey = 1
const pending: Entry[] = []

export function allocEntryKey(): number {
  return nextKey++
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const endOf = (line: string) => [...line].length

export interface Store {
  entries: Entry[]
  showStderr: boolean
  offset: number
  mode: Mode
  vpH: number
  totalLines: number
  firstVisibleKey: number | null
  visibleKeys: number[]
  lines: string[]
  cursor: { row: number; col: number }
  history: string[]
  histIdx: number | null
  draft: string | null
  cmd: string[]
  cwd?: string
  status: 'idle' | 'running' | 'exited'
  pid: number | null
  exitCode: number | null
  logFile: string | null
  push: (entry: Entry) => void
  flush: () => void
  clearEntries: () => void
  toggleStderr: () => void
  setMode: (mode: Mode) => void
  toggleMode: () => void
  setVpH: (height: number) => void
  setTotal: (total: number) => void
  setFirstVisible: (key: number | null) => void
  setVisibleKeys: (keys: number[]) => void
  adjustOffset: (delta: number) => void
  scrollBy: (delta: number) => void
  scrollTop: () => void
  scrollBottom: () => void
  insertText: (text: string) => void
  breakLine: () => void
  backspace: () => void
  deleteForward: () => void
  moveH: (delta: -1 | 1) => void
  moveV: (delta: -1 | 1) => void
  moveHome: () => void
  moveEnd: () => void
  deleteWordBack: () => void
  setEditorText: (text: string) => void
  resetEditor: () => void
  historyPrev: () => void
  historyNext: () => void
  recordHistory: (text: string) => void
  _resetForTest: () => void
}

const initial = {
  entries: [],
  showStderr: true,
  offset: 0,
  mode: 'input' as Mode,
  vpH: 0,
  totalLines: 0,
  firstVisibleKey: null,
  visibleKeys: [],
  lines: [''],
  cursor: { row: 0, col: 0 },
  history: [],
  histIdx: null,
  draft: null,
  cmd: [],
  cwd: undefined,
  status: 'idle' as const,
  pid: null,
  exitCode: null,
  logFile: null,
}

export const useStore = create<Store>()((set, get) => ({
  ...initial,
  push: entry => pending.push(entry),
  flush: () => {
    if (!pending.length) return
    const batch = pending.splice(0, pending.length)
    set(state => ({ entries: [...state.entries, ...batch] }))
  },
  clearEntries: () => {
    pending.length = 0
    set({ entries: [], totalLines: 0, firstVisibleKey: null })
  },
  toggleStderr: () => set(state => ({ showStderr: !state.showStderr })),
  setMode: mode => set({ mode }),
  toggleMode: () => set(state => ({ mode: state.mode === 'input' ? 'view' : 'input' })),
  setVpH: vpH => set(state => (state.vpH === vpH ? state : { vpH })),
  setTotal: totalLines => set(state => (state.totalLines === totalLines ? state : { totalLines })),
  setFirstVisible: firstVisibleKey => set(state => (state.firstVisibleKey === firstVisibleKey ? state : { firstVisibleKey })),
  setVisibleKeys: visibleKeys => set(state => (
    state.visibleKeys.length === visibleKeys.length && state.visibleKeys.every((key, index) => key === visibleKeys[index])
      ? state
      : { visibleKeys }
  )),
  adjustOffset: delta => set(state => ({ offset: Math.max(0, state.offset + delta) })),
  scrollBy: delta => set(state => ({ offset: clamp(state.offset + delta, 0, Math.max(0, state.totalLines - 1)) })),
  scrollTop: () => set(state => ({ offset: Math.max(0, state.totalLines - 1) })),
  scrollBottom: () => set({ offset: 0 }),
  insertText: text => set(state => {
    const lines = [...state.lines]
    const row = clamp(state.cursor.row, 0, lines.length - 1)
    const chars = [...lines[row]]
    const col = clamp(state.cursor.col, 0, chars.length)
    if (text.includes('\n')) {
      const parts = text.split('\n')
      const before = chars.slice(0, col).join('')
      const after = chars.slice(col).join('')
      const replacement = [before + parts[0], ...parts.slice(1, -1), parts.at(-1)! + after]
      lines.splice(row, 1, ...replacement)
      return { lines, cursor: { row: row + replacement.length - 1, col: endOf(replacement.at(-1)!) } }
    }
    chars.splice(col, 0, ...[...text])
    lines[row] = chars.join('')
    return { lines, cursor: { row, col: col + [...text].length } }
  }),
  breakLine: () => set(state => {
    const lines = [...state.lines]
    const row = clamp(state.cursor.row, 0, lines.length - 1)
    const chars = [...lines[row]]
    lines.splice(row, 1, chars.slice(0, state.cursor.col).join(''), chars.slice(state.cursor.col).join(''))
    return { lines, cursor: { row: row + 1, col: 0 } }
  }),
  backspace: () => set(state => {
    const lines = [...state.lines]
    const { row, col } = state.cursor
    if (col > 0) {
      const chars = [...lines[row]]
      chars.splice(col - 1, 1)
      lines[row] = chars.join('')
      return { lines, cursor: { row, col: col - 1 } }
    }
    if (row > 0) {
      const previousLength = endOf(lines[row - 1])
      lines[row - 1] += lines[row]
      lines.splice(row, 1)
      return { lines, cursor: { row: row - 1, col: previousLength } }
    }
    return state
  }),
  deleteForward: () => set(state => {
    const lines = [...state.lines]
    const { row, col } = state.cursor
    const chars = [...lines[row]]
    if (col < chars.length) {
      chars.splice(col, 1)
      lines[row] = chars.join('')
      return { lines }
    }
    if (row < lines.length - 1) {
      lines[row] += lines[row + 1]
      lines.splice(row + 1, 1)
      return { lines }
    }
    return state
  }),
  moveH: delta => set(state => {
    const { row, col } = state.cursor
    const length = endOf(state.lines[row])
    if (delta > 0) {
      if (col < length) return { cursor: { row, col: col + 1 } }
      if (row < state.lines.length - 1) return { cursor: { row: row + 1, col: 0 } }
    } else {
      if (col > 0) return { cursor: { row, col: col - 1 } }
      if (row > 0) return { cursor: { row: row - 1, col: endOf(state.lines[row - 1]) } }
    }
    return state
  }),
  moveV: delta => set(state => {
    const row = state.cursor.row + delta
    if (row < 0 || row >= state.lines.length) return state
    return { cursor: { row, col: Math.min(state.cursor.col, endOf(state.lines[row])) } }
  }),
  moveHome: () => set(state => ({ cursor: { ...state.cursor, col: 0 } })),
  moveEnd: () => set(state => ({ cursor: { ...state.cursor, col: endOf(state.lines[state.cursor.row]) } })),
  deleteWordBack: () => set(state => {
    const lines = [...state.lines]
    const { row, col } = state.cursor
    if (col === 0) {
      if (row === 0) return state
      const previousLength = endOf(lines[row - 1])
      lines[row - 1] += lines[row]
      lines.splice(row, 1)
      return { lines, cursor: { row: row - 1, col: previousLength } }
    }
    const chars = [...lines[row]]
    let next = col
    while (next > 0 && chars[next - 1] === ' ') next--
    while (next > 0 && chars[next - 1] !== ' ') next--
    chars.splice(next, col - next)
    lines[row] = chars.join('')
    return { lines, cursor: { row, col: next } }
  }),
  setEditorText: text => {
    const lines = text.split('\n')
    set({ lines, cursor: { row: lines.length - 1, col: endOf(lines.at(-1)!) } })
  },
  resetEditor: () => set({ lines: [''], cursor: { row: 0, col: 0 }, histIdx: null, draft: null }),
  historyPrev: () => {
    const state = get()
    if (!state.history.length) return
    const index = state.histIdx === null ? state.history.length - 1 : Math.max(0, state.histIdx - 1)
    const text = state.history[index]
    const lines = text.split('\n')
    set({ histIdx: index, draft: state.histIdx === null ? state.lines.join('\n') : state.draft, lines, cursor: { row: lines.length - 1, col: endOf(lines.at(-1)!) } })
  },
  historyNext: () => {
    const state = get()
    if (state.histIdx === null) return
    const index = state.histIdx + 1
    if (index >= state.history.length) {
      const lines = (state.draft ?? '').split('\n')
      set({ histIdx: null, draft: null, lines, cursor: { row: lines.length - 1, col: endOf(lines.at(-1)!) } })
      return
    }
    const lines = state.history[index].split('\n')
    set({ histIdx: index, lines, cursor: { row: lines.length - 1, col: endOf(lines.at(-1)!) } })
  },
  recordHistory: text => set(state => ({ history: [...state.history, text].slice(-200), histIdx: null, draft: null })),
  _resetForTest: () => {
    pending.length = 0
    nextKey = 1
    set({ ...initial })
  },
}))
