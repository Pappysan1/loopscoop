import { diag } from '../diag/log'
import { nearestDmc } from './dmc'
import { hoopFrame, sampleCell } from './frame'
import { quantize, rgbToHex, type Sample } from './quantize'
import { symbolFor } from './symbols'
import {
  skeinsFor,
  stitchCount,
  type Pattern,
  type StudioSettings,
} from './types'

function applyBcs(r: number, g: number, b: number, s: StudioSettings): Sample {
  // Sliders are whole percentages (brightness/contrast -40..40, saturation -40..60).
  const br = s.brightness / 100
  const ct = s.contrast / 100
  const sat = s.saturation / 100
  let rr = r / 255 + br
  let gg = g / 255 + br
  let bb = b / 255 + br
  rr = (rr - 0.5) * (1 + ct) + 0.5
  gg = (gg - 0.5) * (1 + ct) + 0.5
  bb = (bb - 0.5) * (1 + ct) + 0.5
  const y = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb
  rr = y + (rr - y) * (1 + sat)
  gg = y + (gg - y) * (1 + sat)
  bb = y + (bb - y) * (1 + sat)
  return {
    r: Math.max(0, Math.min(255, rr * 255)),
    g: Math.max(0, Math.min(255, gg * 255)),
    b: Math.max(0, Math.min(255, bb * 255)),
  }
}

function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export type PixelSource = { data: Uint8ClampedArray; width: number; height: number }

type Rgb = { r: number; g: number; b: number }

/** Very light, nearly grey: paper, sky, a studio sweep. */
function isBackgroundLight(c: Rgb) {
  const hi = Math.max(c.r, c.g, c.b)
  const lo = Math.min(c.r, c.g, c.b)
  return luminance(c.r, c.g, c.b) > 228 && hi - lo <= 28
}

/**
 * "Skip light background": knock out light stitches that are connected to the
 * hoop rim or to bare linen. The old check only looked at the square corners of
 * the grid, most of which lie outside the round hoop, so it removed almost
 * nothing. Light spots inside the subject (eye glints, a white collar) are not
 * connected to the edge and are kept.
 */
function knockOutEdgeLight(raw: Array<Rgb | null>, n: number) {
  const light = raw.map((c) => !!c && isBackgroundLight(c))
  const gone = new Uint8Array(n * n)
  const queue: number[] = []
  const bare = (col: number, row: number) =>
    col < 0 || row < 0 || col >= n || row >= n || raw[row * n + col] === null
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col
      if (!light[i]) continue
      if (bare(col - 1, row) || bare(col + 1, row) || bare(col, row - 1) || bare(col, row + 1)) {
        gone[i] = 1
        queue.push(i)
      }
    }
  }
  while (queue.length) {
    const i = queue.pop() as number
    const col = i % n
    const row = (i - col) / n
    const next = [
      col > 0 ? i - 1 : -1,
      col < n - 1 ? i + 1 : -1,
      row > 0 ? i - n : -1,
      row < n - 1 ? i + n : -1,
    ]
    for (const j of next) {
      if (j >= 0 && light[j] && !gone[j]) {
        gone[j] = 1
        queue.push(j)
      }
    }
  }
  for (let i = 0; i < raw.length; i++) if (gone[i]) raw[i] = null
}

/** Read one colour per stitch inside the hoop circle; null means bare linen. */
function sampleStitches(px: PixelSource, n: number, settings: StudioSettings): Array<Rgb | null> {
  const { data, width: cw, height: ch } = px
  const frame = hoopFrame(cw, ch, settings.zoom, settings.panX, settings.panY, settings.fitMode)
  const raw: Array<Rgb | null> = new Array(n * n).fill(null)
  const cx = (n - 1) / 2
  const r2 = (n / 2) * (n / 2)
  const cell = frame.side / Math.max(1, n)
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const dx = col - cx
      const dy = row - cx
      if (dx * dx + dy * dy > r2) continue
      const p = sampleCell(frame, n, col, row)
      // The stitch centre decides photo versus bare linen, as in the outline.
      if (p.x < 0 || p.y < 0 || p.x >= cw || p.y >= ch) continue
      // Average the whole stitch square instead of one pixel, so JPEG speckle
      // and single stray pixels do not become stitches. Up to 16×16 taps each.
      const left = frame.originX + col * cell
      const top = frame.originY + row * cell
      const x0 = Math.max(0, Math.floor(left))
      const y0 = Math.max(0, Math.floor(top))
      const x1 = Math.min(cw, Math.max(x0 + 1, Math.ceil(left + cell)))
      const y1 = Math.min(ch, Math.max(y0 + 1, Math.ceil(top + cell)))
      const sx = Math.max(1, Math.floor((x1 - x0) / 16))
      const sy = Math.max(1, Math.floor((y1 - y0) / 16))
      let r = 0
      let g = 0
      let b = 0
      let opaque = 0
      let taps = 0
      for (let y = y0; y < y1; y += sy) {
        for (let x = x0; x < x1; x += sx) {
          const o = (y * cw + x) * 4
          taps++
          if ((data[o + 3] ?? 0) < 8) continue
          r += data[o] ?? 0
          g += data[o + 1] ?? 0
          b += data[o + 2] ?? 0
          opaque++
        }
      }
      if (!opaque || opaque * 2 < taps) continue
      raw[row * n + col] = { r: r / opaque, g: g / opaque, b: b / opaque }
    }
  }
  return raw
}

/** Pure pattern build from pixels (no canvas), so it can be tested directly. */
export function patternFromPixels(px: PixelSource, settings: StudioSettings, sourceName: string): Pattern {
  const n = stitchCount(settings.hoopInches, settings.aidaCount)
  const raw = sampleStitches(px, n, settings)
  if (settings.knockOutBackground) knockOutEdgeLight(raw, n)

  const cells = new Int16Array(n * n)
  cells.fill(-1)
  const samples: Sample[] = []
  const sampleAt: Array<Sample | null> = new Array(n * n).fill(null)
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (!c) continue
    const sample = applyBcs(c.r, c.g, c.b, settings)
    samples.push(sample)
    sampleAt[i] = sample
  }

  const q = quantize(samples, settings.colorCount)
  const counts = new Array(Math.max(0, q.palette.length)).fill(0)
  for (let i = 0; i < sampleAt.length; i++) {
    const sample = sampleAt[i]
    if (!sample) continue
    const id = q.assign(sample)
    cells[i] = id
    if (id >= 0 && id < counts.length) counts[id]++
  }

  const colors = q.palette.map((p, idx) => {
    const hex = rgbToHex(p)
    const dmc = settings.paletteMode === 'dmc' ? nearestDmc(hex) : null
    const count = counts[idx] ?? 0
    return {
      hex: dmc ? dmc.hex : hex,
      dmc: dmc?.code,
      name: dmc ? dmc.name : hex.toUpperCase(),
      symbol: symbolFor(idx),
      count,
      skeins: skeinsFor(count),
    }
  })

  let totalStitches = 0
  for (const c of counts) totalStitches += c

  return {
    size: n,
    hoopInches: settings.hoopInches,
    aidaCount: settings.aidaCount,
    cells,
    colors,
    totalStitches,
    sourceName,
  }
}

export function buildPattern(image: HTMLImageElement, settings: StudioSettings, sourceName: string): Pattern | null {
  const imgW = image.naturalWidth || image.width
  const imgH = image.naturalHeight || image.height
  if (!imgW || !imgH) {
    diag.warn('stitch', 'That image has no pixels to stitch.')
    return null
  }

  const long = Math.max(imgW, imgH)
  const scale = long > 960 ? 960 / long : 1
  const cw = Math.max(1, Math.round(imgW * scale))
  const ch = Math.max(1, Math.round(imgH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    diag.error('canvas', 'No 2d context for pattern build')
    return null
  }
  try {
    ctx.drawImage(image, 0, 0, cw, ch)
  } catch (err) {
    diag.error('canvas', 'Could not draw photo (tainted or broken image)', { error: err })
    return null
  }
  let data: ImageData
  try {
    data = ctx.getImageData(0, 0, cw, ch)
  } catch (err) {
    diag.error('canvas', 'Could not read photo pixels', { error: err })
    return null
  }
  return patternFromPixels({ data: data.data, width: cw, height: ch }, settings, sourceName)
}
