import { describe, expect, test } from 'bun:test'
import { C, parseJsonSafe, strWidth, tokenizeJsonLine } from '../src/ui/json'

describe('json utilities', () => {
  test('recognizes keys, strings, numbers and literals', () => {
    const segments = tokenizeJsonLine('  "key": "value", "count": -1, "ok": true')
    expect(segments.some(segment => segment.text === '"key"' && segment.color === C.key)).toBe(true)
    expect(segments.some(segment => segment.text === '"value"' && segment.color === C.string)).toBe(true)
    expect(segments.some(segment => segment.text === '-1' && segment.color === C.number)).toBe(true)
    expect(segments.some(segment => segment.text === 'true' && segment.color === C.literal)).toBe(true)
  })

  test('validates JSON without throwing', () => {
    expect(parseJsonSafe('{"id":1}').ok).toBe(true)
    expect(parseJsonSafe('{"id":').ok).toBe(false)
  })

  test('accounts for wide and combining characters', () => {
    expect(strWidth('a')).toBe(1)
    expect(strWidth('あ')).toBe(2)
    expect(strWidth('ก่')).toBe(1)
  })
})
