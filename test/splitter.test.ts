import { describe, expect, test } from 'bun:test'
import { createLineSplitter } from '../src/core/splitter'

describe('line splitter', () => {
  test('handles chunks split in the middle of messages', () => {
    const splitter = createLineSplitter()
    expect(splitter.feed('{"a"')).toEqual([])
    expect(splitter.feed(':1}\n{"b"')).toEqual(['{"a":1}'])
    expect(splitter.feed(':2}\r\n')).toEqual(['{"b":2}'])
  })

  test('returns a final line without a newline', () => {
    const splitter = createLineSplitter()
    splitter.feed('last message')
    expect(splitter.rest()).toBe('last message')
  })
})
