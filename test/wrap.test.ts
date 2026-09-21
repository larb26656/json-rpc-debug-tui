import { expect, test } from 'bun:test'
import { strWidth, wrapSegs } from '../src/ui/json'
import { entryToLines } from '../src/ui/render'

test('wraps colored segments without exceeding the width', () => {
  const lines = wrapSegs([{ text: 'aaaa bb', color: 'red' }, { text: ' cc dd', color: 'blue' }], 5)
  expect(lines.length).toBeGreaterThan(1)
  expect(lines.every(line => strWidth(line.map(segment => segment.text).join('')) <= 5)).toBe(true)
})

test('hard wraps long words', () => {
  const lines = wrapSegs([{ text: 'abcdefghij', color: 'red' }], 4)
  expect(lines.map(line => line.map(segment => segment.text).join('')).join('')).toBe('abcdefghij')
  expect(lines.map(line => strWidth(line.map(segment => segment.text).join('')))).toEqual([4, 4, 2])
})

test('renders long JSON bodies without a collapse toggle', () => {
  const entry = {
    key: 1,
    ts: 0,
    kind: 'rx' as const,
    raw: JSON.stringify({ result: Array.from({ length: 15 }, (_, index) => `value-${index}`) }),
  }
  const output = entryToLines(entry, 80).flatMap(line => line.segs.map(segment => segment.text)).join('')

  expect(output).toContain('value-14')
  expect(output).not.toContain('press e')
})
