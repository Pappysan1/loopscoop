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
  const br = s.brightness
  const ct = s.contrast
  const sat = s.saturation
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

export function buildPattern(image: HTMLImageElement, settings: StudioSettings, sourceName: string): Pattern | null {
  const n = stitchCount(settings.hoopInches, settings.aidaCount)
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

  const frame = hoopFrame(cw, ch, settings.zoom, settings.panX, settings.panY, settings.fitMode)
  const cells = new Int16Array(n * n)
  cells.fill(-1)
  const samples: Sample[] = []
  const sampleAt: Array<{ i: number; sample: Sample } | null> = new Array(n * n)

  const cx = (n - 1) / 2
  const r2 = (n / 2) * (n / 2)

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col
      const dx = col - cx
      const dy = row - cx
      if (dx * dx + dy * dy > r2) {
        sampleAt[i] = null
        continue
      }
      const p = sampleCell(frame, n, col, row)
      const x = Math.floor(p.x)
      const y = Math.floor(p.y)
      if (x < 0 || y < 0 || x >= cw || y >= ch) {
        sampleAt[i] = null
        continue
      }
      const o = (y * cw + x) * 4
      const r = data.data[o] ?? 0
      const g = data.data[o + 1] ?? 0
      const b = data.data[o + 2] ?? 0
      const a = data.data[o + 3] ?? 0
      if (a < 8) {
        sampleAt[i] = null
        continue
      }
      if (settings.knockOutBackground) {
        const corner =
          (col < n * 0.18 || col > n * 0.82) && (row < n * 0.18 || row > n * 0.82)
        if (corner && luminance(r, g, b) > 232) {
          sampleAt[i] = null
          continue
        }
      }
      const sample = applyBcs(r, g, b, settings)
      samples.push(sample)
      sampleAt[i] = { i, sample }
    }
  }

  const q = quantize(samples, settings.colorCount)
  const counts = new Array(Math.max(0, q.palette.length)).fill(0)
  for (let i = 0; i < sampleAt.length; i++) {
    const cell = sampleAt[i]
    if (!cell) {
      cells[i] = -1
      continue
    }
    const id = q.assign(cell.sample)
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
