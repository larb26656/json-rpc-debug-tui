export type Seg = { text: string; color?: string }

export const C = {
  tx: '#7aa2f7',
  rx: '#9ece6a',
  notify: '#e0af68',
  error: '#f7768e',
  stderr: '#565f89',
  info: '#bb9af7',
  dim: '#565f89',
  key: '#7aa2f7',
  string: '#9ece6a',
  number: '#ff9e64',
  literal: '#73daca',
  punct: '#565f89',
} as const

function charWidth(cp: number): number {
  if (cp === 0 || cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0
  if (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    cp === 0x0e31 ||
    (cp >= 0x0e34 && cp <= 0x0e3a) ||
    (cp >= 0x0e47 && cp <= 0x0e4e)
  ) return 0
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    cp >= 0x20000
  ) return 2
  return 1
}

export function strWidth(value: string): number {
  let width = 0
  for (const char of value) width += charWidth(char.codePointAt(0) ?? 0)
  return width
}

export function segsWidth(segs: Seg[]): number {
  return segs.reduce((sum, seg) => sum + strWidth(seg.text), 0)
}

export function tokenizeJsonLine(line: string): Seg[] {
  const segments: Seg[] = []
  const delimiter = '{}[],:" \t'
  let index = 0

  const push = (text: string, color?: string) => {
    if (text) segments.push({ text, ...(color ? { color } : {}) })
  }

  while (index < line.length) {
    const char = line[index]
    if (char === '"') {
      let end = index + 1
      let closed = false
      while (end < line.length) {
        if (line[end] === '\\') {
          end += 2
          continue
        }
        if (line[end] === '"') {
          closed = true
          break
        }
        end++
      }
      const finalIndex = closed ? end : line.length - 1
      let next = finalIndex + 1
      while (next < line.length && (line[next] === ' ' || line[next] === '\t')) next++
      push(line.slice(index, finalIndex + 1), line[next] === ':' ? C.key : C.string)
      index = finalIndex + 1
      continue
    }
    if (char === ' ' || char === '\t') {
      let end = index + 1
      while (end < line.length && (line[end] === ' ' || line[end] === '\t')) end++
      push(line.slice(index, end))
      index = end
      continue
    }
    if ('{}[],:'.includes(char)) {
      push(char, C.punct)
      index++
      continue
    }
    let end = index + 1
    while (end < line.length && !delimiter.includes(line[end])) end++
    const text = line.slice(index, end)
    push(text, /^-?\d/.test(text) ? C.number : C.literal)
    index = end
  }
  return segments
}

export function wrapSegs(input: Seg[], width: number): Seg[][] {
  const maxWidth = Math.max(1, width)
  const atoms: Seg[] = []

  for (const segment of input) {
    if (!segment.text) continue
    const words = segment.text.split(/(?<=\s)/)
    for (const word of words) {
      if (!word) continue
      let rest = word
      while (strWidth(rest) > maxWidth) {
        const chars = [...rest]
        let taken = ''
        let used = 0
        let index = 0
        for (; index < chars.length; index++) {
          const widthOfChar = charWidth(chars[index].codePointAt(0) ?? 0)
          if (used + widthOfChar > maxWidth) break
          taken += chars[index]
          used += widthOfChar
        }
        if (!taken) {
          taken = chars[0] ?? ' '
          index = 1
        }
        atoms.push({ text: taken, color: segment.color })
        rest = chars.slice(index).join('')
      }
      if (rest) atoms.push({ text: rest, color: segment.color })
    }
  }

  const lines: Seg[][] = []
  let current: Seg[] = []
  let currentWidth = 0
  const flush = () => {
    while (current.length && current[current.length - 1].text.trim() === '') current.pop()
    if (current.length) lines.push(current)
    current = []
    currentWidth = 0
  }

  for (const atom of atoms) {
    const atomWidth = strWidth(atom.text)
    const isSpace = atom.text.trim() === ''
    if (current.length && currentWidth + atomWidth > maxWidth) {
      flush()
      if (isSpace) continue
    }
    current.push(atom)
    currentWidth += atomWidth
  }
  flush()

  return lines.map(line => {
    const merged: Seg[] = []
    for (const segment of line) {
      const previous = merged[merged.length - 1]
      if (previous && previous.color === segment.color) previous.text += segment.text
      else merged.push({ ...segment })
    }
    return merged
  })
}

export function parseJsonSafe(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}
