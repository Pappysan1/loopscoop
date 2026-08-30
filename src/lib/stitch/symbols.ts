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
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
] as const

export function symbolFor(index: number) {
  if (index < 0) return ''
  if (index < STITCH_SYMBOLS.length) return STITCH_SYMBOLS[index]
  const extra = index - STITCH_SYMBOLS.length
  const letters = 'abcdefghijklmnopqrstuvwxyz'
  return letters[extra % letters.length] ?? '?'
}
