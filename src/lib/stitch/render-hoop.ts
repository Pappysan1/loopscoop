import { diag } from '../diag/log'
import type { Pattern } from './types'

function shade(hex: string, amount: number) {
  const h = hex.replace('#', '')
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) * amount))
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) * amount))
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) * amount))
  return `rgb(${r | 0},${g | 0},${b | 0})`
}

function paintWoodRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, inner: number, outer: number) {
  const g = ctx.createRadialGradient(cx - outer * 0.2, cy - outer * 0.25, inner * 0.2, cx, cy, outer)
  g.addColorStop(0, '#d4b48a')
  g.addColorStop(0.45, '#b8956a')
  g.addColorStop(1, '#8c6a45')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, outer, 0, Math.PI * 2)
  ctx.arc(cx, cy, inner, 0, Math.PI * 2, true)
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, outer, 0, Math.PI * 2)
  ctx.arc(cx, cy, inner, 0, Math.PI * 2, true)
  ctx.clip()
  ctx.strokeStyle = 'rgba(80, 50, 24, 0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
    ctx.stroke()
  }
  ctx.restore()

  ctx.strokeStyle = '#6f5234'
  ctx.lineWidth = Math.max(1, (outer - inner) * 0.08)
  ctx.beginPath()
  ctx.arc(cx, cy, outer - 1, 0, Math.PI * 2)
  ctx.stroke()
}

function paintScrew(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number) {
  const w = outer * 0.16
  const h = outer * 0.18
  const x = cx - w / 2
  const y = cy - outer - h * 0.35
  ctx.fillStyle = '#9aa3ab'
  ctx.strokeStyle = '#5c636a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 3)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#6b7280'
  ctx.fillRect(cx - 1.5, y + 2, 3, h - 4)
  ctx.beginPath()
  ctx.arc(cx + w * 0.35, y + h * 0.35, 2.2, 0, Math.PI * 2)
  ctx.fill()
}

export function renderHoop(
  canvas: HTMLCanvasElement,
  opts: {
    pattern?: Pattern | null
    image?: HTMLImageElement | null
    highlight?: number
    livePhoto?: boolean
    frame?: { originX: number; originY: number; side: number }
    cssSize?: number
  },
) {
  const css = Math.max(1, opts.cssSize ?? (canvas.clientWidth || 640))
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const dest = Math.round(css * dpr)
  if (canvas.width !== dest || canvas.height !== dest) {
    canvas.width = dest
    canvas.height = dest
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    diag.error('canvas', 'Missing hoop canvas context')
    return
  }

  ctx.clearRect(0, 0, dest, dest)
  const cx = dest / 2
  const cy = dest / 2 + dest * 0.02
  const outer = dest * 0.46
  const inner = dest * 0.385

  ctx.fillStyle = '#f3eee6'
  ctx.fillRect(0, 0, dest, dest)

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, inner, 0, Math.PI * 2)
  ctx.fillStyle = '#f4efe6'
  ctx.fill()
  ctx.restore()

  paintWoodRing(ctx, cx, cy, inner, outer)
  paintScrew(ctx, cx, cy, outer)

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, inner - 1, 0, Math.PI * 2)
  ctx.clip()

  if (opts.livePhoto && opts.image && opts.frame) {
    try {
      const { originX, originY, side } = opts.frame
      const scale = (inner * 2) / side
      ctx.drawImage(
        opts.image,
        originX,
        originY,
        side,
        side,
        cx - inner,
        cy - inner,
        inner * 2,
        inner * 2,
      )
      void scale
    } catch (err) {
      diag.error('canvas', 'Live photo draw failed', { error: err })
    }
    ctx.restore()
    return
  }

  const pattern = opts.pattern
  if (!pattern) {
    ctx.restore()
    return
  }

  const n = pattern.size
  const cell = (inner * 2) / n
  const ox = cx - inner
  const oy = cy - inner
  const highlight = opts.highlight ?? -1

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const id = pattern.cells[row * n + col] ?? -1
      if (id < 0) continue
      const color = pattern.colors[id]
      if (!color) continue
      const dim = highlight >= 0 && id !== highlight
      const pad = cell * 0.18
      const x0 = ox + col * cell + pad
      const y0 = oy + row * cell + pad
      const x1 = ox + (col + 1) * cell - pad
      const y1 = oy + (row + 1) * cell - pad
      ctx.globalAlpha = dim ? 0.16 : 1
      ctx.strokeStyle = color.hex
      ctx.lineWidth = Math.max(1.2, cell * 0.18)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.strokeStyle = shade(color.hex, 0.72)
      ctx.beginPath()
      ctx.moveTo(x1, y0)
      ctx.lineTo(x0, y1)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()
}
