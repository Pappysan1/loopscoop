import { describe, expect, it } from 'vitest'
import { patternFromPixels, type PixelSource } from './build-pattern'
import { DEFAULT_SETTINGS, type StudioSettings } from './types'

/** Paint a w×h image with a colour function of (x, y). */
function paint(w: number, h: number, color: (x: number, y: number) => [number, number, number, number?]): PixelSource {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = color(x, y)
      data.set([r, g, b, a], (y * w + x) * 4)
    }
  }
  return { data, width: w, height: h }
}

const base: StudioSettings = { ...DEFAULT_SETTINGS, hoopInches: 4, aidaCount: 11, brightness: 0, contrast: 0, saturation: 0, colorCount: 6 }
const at = (p: ReturnType<typeof patternFromPixels>, col: number, row: number) => p.cells[row * p.size + col]

describe('skip light background', () => {
  // A dark disc on a white sheet, with a white glint in the middle of the disc.
  const photo = paint(200, 200, (x, y) => {
    const d = Math.hypot(x - 100, y - 100)
    if (d < 6) return [255, 255, 255]
    if (d < 55) return [40, 60, 120]
    return [250, 250, 248]
  })

  it('removes white background that touches the hoop edge', () => {
    const off = patternFromPixels(photo, base, 'disc')
    const on = patternFromPixels(photo, { ...base, knockOutBackground: true }, 'disc')
    const n = on.size
    // Just inside the rim on the left, halfway down.
    expect(at(off, 1, Math.floor(n / 2))).toBeGreaterThanOrEqual(0)
    expect(at(on, 1, Math.floor(n / 2))).toBe(-1)
    expect(on.totalStitches).toBeLessThan(off.totalStitches * 0.6)
  })

  it('keeps white spots inside the subject', () => {
    const on = patternFromPixels(photo, { ...base, knockOutBackground: true }, 'disc')
    const mid = Math.floor(on.size / 2)
    expect(at(on, mid, mid)).toBeGreaterThanOrEqual(0)
  })

  it('leaves light but coloured areas alone', () => {
    const peach = paint(200, 200, () => [255, 236, 200])
    const on = patternFromPixels(peach, { ...base, knockOutBackground: true }, 'peach')
    expect(on.totalStitches).toBeGreaterThan(0)
  })
})
