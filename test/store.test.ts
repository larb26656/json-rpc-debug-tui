import { beforeEach, expect, test } from 'bun:test'
import { useStore } from '../src/core/store'

beforeEach(() => useStore.getState()._resetForTest())

test('edits multiline input', () => {
  const store = useStore.getState()
  store.insertText('{"a":1}')
  store.breakLine()
  store.insertText('}')
  expect(useStore.getState().lines).toEqual(['{"a":1}', '}'])
  store.backspace()
  expect(useStore.getState().lines).toEqual(['{"a":1}', ''])
  store.backspace()
  expect(useStore.getState().lines).toEqual(['{"a":1}'])
})

test('keeps history and scroll bounds', () => {
  const store = useStore.getState()
  store.recordHistory('{"id":1}')
  store.setTotal(100)
  store.scrollBy(500)
  expect(useStore.getState().offset).toBe(99)
  store.scrollBottom()
  expect(useStore.getState().offset).toBe(0)
  store.historyPrev()
  expect(useStore.getState().lines.join('')).toBe('{"id":1}')
})
