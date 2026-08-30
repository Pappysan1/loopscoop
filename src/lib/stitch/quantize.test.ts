import { describe, expect, it } from 'vitest'
import { hoopFrame } from './frame'
import { quantize } from './quantize'

describe('quantize', () => {
  it('returns assign => -1 when there are no samples', () => {
    const q = quantize([], 16)
    expect(q.palette).toEqual([])
    expect(q.assign({ r: 0, g: 0, b: 0 })).toBe(-1)
  })

  it('clusters a two-color set', () => {
    const samples = [
      ...Array.from({ length: 20 }, () => ({ r: 10, g: 10, b: 10 })),
      ...Array.from({ length: 20 }, () => ({ r: 200, g: 20, b: 20 })),
    ]
    const q = quantize(samples, 2)
    expect(q.palette.length).toBe(2)
    const a = q.assign({ r: 12, g: 12, b: 12 })
    const b = q.assign({ r: 190, g: 25, b: 18 })
    expect(a).not.toBe(b)
  })
})

describe('hoopFrame', () => {
  it('fit uses the long edge, fill uses the short edge', () => {
    const fit = hoopFrame(200, 100, 1, 0, 0, 'fit')
    const fill = hoopFrame(200, 100, 1, 0, 0, 'fill')
    expect(fit.side).toBe(200)
    expect(fill.side).toBe(100)
  })
})
