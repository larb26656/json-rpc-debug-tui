import type { Entry } from '../core/store'
import { C, parseJsonSafe, segsWidth, strWidth, tokenizeJsonLine, wrapSegs, type Seg } from './json'

export interface RenderLine {
  key: number
  segs: Seg[]
}

const parsedCache = new Map<number, { ok: boolean; value?: unknown }>()
const collapseAt = 14
const collapseShow = 10
const maxBody = 2000

const pad = (value: number) => String(value).padStart(2, '0')
const time = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const parseEntry = (entry: Entry) => {
  const cached = parsedCache.get(entry.key)
  if (cached) return cached
  const parsed = parseJsonSafe(entry.raw)
  const result = parsed.ok ? { ok: true, value: parsed.value } : { ok: false }
  if (parsedCache.size > 4000) parsedCache.clear()
  parsedCache.set(entry.key, result)
  return result
}

const widthOf = (segments: Seg[]) => segsWidth(segments)

function header(left: Seg[], right: Seg[], width: number): Seg[] {
  const gap = width - widthOf(left) - widthOf(right)
  return right.length && gap >= 2 ? [...left, { text: ' '.repeat(gap) }, ...right] : left
}

function body(value: unknown, width: number, expanded: boolean): Seg[][] {
  let lines = (JSON.stringify(value, null, 2) ?? 'null').split('\n')
  if (lines.length > maxBody) lines = [...lines.slice(0, maxBody), '... truncated']
  const hidden = lines.length - collapseShow
  if (!expanded && lines.length > collapseAt) lines = [...lines.slice(0, collapseShow), `... +${hidden} lines (press e)`]
  return lines.flatMap(line => wrapSegs(tokenizeJsonLine(line), width))
}

function wrapEntry(segments: Seg[], width: number, key: number): RenderLine[] {
  return wrapSegs(segments, width).map(segs => ({ key, segs }))
}

export function entryToLines(entry: Entry, width: number, expanded: boolean): RenderLine[] {
  const safeWidth = Math.max(8, width)
  if (entry.kind === 'info') return wrapEntry([{ text: '✱ ', color: C.info }, { text: entry.raw, color: C.info }], safeWidth, entry.key)
  if (entry.kind === 'stderr') return wrapEntry([{ text: '  · ', color: C.stderr }, { text: entry.raw, color: C.stderr }], safeWidth, entry.key)

  const parsed = parseEntry(entry)
  const right = [{ text: time(entry.ts), color: C.dim }]
  let left: Seg[]
  let bodyValue: unknown = undefined

  if (entry.kind === 'tx') {
    if (parsed.ok && parsed.value && typeof parsed.value === 'object' && 'method' in parsed.value) {
      const message = parsed.value as { id?: string | number; method: string }
      const id = message.id === undefined ? '' : `#${message.id} `
      left = [{ text: '-> ', color: C.tx }, { text: `${id}${message.method}`, color: C.tx }]
      if (entry.latency !== undefined) left.push({ text: `  ${entry.latency}ms`, color: C.dim })
    } else {
      left = [{ text: '-> ', color: C.tx }, { text: entry.raw, color: C.tx }]
    }
    bodyValue = parsed.ok ? parsed.value : entry.raw
  } else if (!parsed.ok) {
    return [
      ...wrapEntry(header([{ text: '<- ', color: C.error }, { text: 'invalid JSON', color: C.error }], right, safeWidth), safeWidth, entry.key),
      ...wrapEntry([{ text: entry.raw, color: C.error }], safeWidth, entry.key),
    ]
  } else {
    const message = parsed.value as any
    const object = message && typeof message === 'object'
    const response = object && ('result' in message || 'error' in message)
    const id = object && message.id !== undefined ? `#${message.id} ` : ''
    if (response) {
      if (message.error) {
        const error = typeof message.error === 'object' ? `${message.error.code ?? ''} ${message.error.message ?? ''}`.trim() : String(message.error)
        left = [{ text: '<- ', color: C.error }, { text: `${id}error ${error}`, color: C.error }]
      } else {
        left = [{ text: '<- ', color: C.rx }, { text: `${id}result`, color: C.rx }]
      }
      if (entry.reqMethod) left.push({ text: ` · ${entry.reqMethod}`, color: C.dim })
      if (entry.latency !== undefined) left.push({ text: ` · ${entry.latency}ms`, color: C.dim })
      bodyValue = 'result' in message ? message.result : message.error
    } else if (object && 'method' in message) {
      left = [{ text: '<- ', color: C.notify }, { text: `${id}${message.method}`, color: C.notify }]
      bodyValue = message.params
    } else {
      left = [{ text: '<- ', color: C.rx }, { text: 'message', color: C.rx }]
      bodyValue = message
    }
  }

  const lines = wrapEntry(header(left, right, safeWidth), safeWidth, entry.key)
  if (bodyValue === undefined) return lines
  return [...lines, ...body(bodyValue, safeWidth - 2, expanded).map(segs => ({ key: entry.key, segs: [{ text: '  ' }, ...segs] }))]
}
