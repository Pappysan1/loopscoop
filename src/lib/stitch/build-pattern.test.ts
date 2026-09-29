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

describe('stitch sampling', () => {
  it('averages the stitch square instead of copying one pixel', () => {
    // Fine black/white checkerboard: a single-pixel read gives pure black or
    // white stitches; averaging gives mid grey everywhere.
    const checker = paint(220, 220, (x, y) => ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]))
    const p = patternFromPixels(checker, { ...base, paletteMode: 'photo', colorCount: 6 }, 'checker')
    const used = p.colors.filter((c) => c.count > 0)
    for (const c of used) {
      const v = parseInt(c.hex.slice(1, 3), 16)
      expect(v).toBeGreaterThan(90)
      expect(v).toBeLessThan(165)
    }
  })

  it('treats mostly transparent stitches as bare linen', () => {
    const clear = paint(100, 100, (x) => (x < 50 ? [200, 30, 30, 255] : [0, 0, 0, 0]))
    const p = patternFromPixels(clear, base, 'half')
    const mid = Math.floor(p.size / 2)
    expect(at(p, 2, mid)).toBeGreaterThanOrEqual(0)
    expect(at(p, p.size - 3, mid)).toBe(-1)
  })

  it('still samples when zoomed in past one pixel per stitch', () => {
    const tiny = paint(10, 10, () => [10, 120, 60])
    const p = patternFromPixels(tiny, { ...base, zoom: 3, fitMode: 'fill' }, 'tiny')
    expect(p.totalStitches).toBeGreaterThan(0)
  })
})

describe('floss key', () => {
  // A soft run of reds plus black: k-means splits the reds into several
  // clusters, but many land on the same DMC thread and must share one row.
  const photo = paint(240, 240, (x) => (x < 180 ? [190 + Math.floor(x / 12), 20 + Math.floor(x / 30), 30] : [10, 10, 10]))
  const p = patternFromPixels(photo, { ...base, colorCount: 8 }, 'reds')

  it('lists each DMC thread only once', () => {
    const codes = p.colors.map((c) => c.dmc)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('keeps cells, counts and totals consistent after merging', () => {
    const tally = new Array(p.colors.length).fill(0)
    for (const id of p.cells) if (id >= 0) tally[id]++
    expect(tally).toEqual(p.colors.map((c) => c.count))
    expect(p.totalStitches).toBe(tally.reduce((s, v) => s + v, 0))
    expect(p.colors.every((c) => c.count > 0)).toBe(true)
  })

  it('gives the busiest thread the first symbol', () => {
    expect(p.colors[0]?.symbol).toBe('●')
    for (let i = 1; i < p.colors.length; i++) expect(p.colors[i - 1]!.count).toBeGreaterThanOrEqual(p.colors[i]!.count)
  })
})
