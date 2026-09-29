// Outline order: 20 marks, then A–V without I, O, Q (they read like o/0/symbols).
export const STITCH_SYMBOLS = [
  '●',
  '×',
  '■',
  '▲',
  '+',
  '○',
  '◆',
  '*',
  '△',
  '□',
  '★',
  '▼',
  '◇',
  '#',
  '▣',
  '▶',
  '◀',
  '◎',
  '▽',
  '@',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'J',
  'K',
  'L',
  'M',
  'N',
  'P',
  'R',
  'S',
  'T',
  'U',
  'V',
] as const

export function symbolFor(index: number) {
  if (index < 0) return ''
  if (index < STITCH_SYMBOLS.length) return STITCH_SYMBOLS[index]
  const extra = index - STITCH_SYMBOLS.length
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return letters[extra % letters.length] ?? '?'
}
