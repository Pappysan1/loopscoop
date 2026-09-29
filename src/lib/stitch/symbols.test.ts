import { describe, expect, it } from 'vitest'
import { STITCH_SYMBOLS, symbolFor } from './symbols'

describe('stitch symbols', () => {
  it('follows the outline: 20 marks then A–V without I, O, Q', () => {
    expect(STITCH_SYMBOLS.length).toBe(39)
    expect(STITCH_SYMBOLS.slice(20).join('')).toBe('ABCDEFGHJKLMNPRSTUV')
    for (const bad of ['I', 'O', 'Q']) expect(STITCH_SYMBOLS).not.toContain(bad)
  })

  it('never runs out before 32 colours and never repeats inside the list', () => {
    expect(new Set(STITCH_SYMBOLS).size).toBe(STITCH_SYMBOLS.length)
    for (let i = 0; i < 32; i++) expect(symbolFor(i)).toBe(STITCH_SYMBOLS[i])
    expect(symbolFor(39)).toBeTruthy()
    expect(symbolFor(-1)).toBe('')
  })
})
