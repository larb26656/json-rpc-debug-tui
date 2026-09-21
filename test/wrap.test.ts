import { expect, test } from 'bun:test'
import { strWidth, wrapSegs } from '../src/ui/json'

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
