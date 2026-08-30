import { diag } from '../diag/log'
import type { Pattern } from './types'

export function renderChart(
  canvas: HTMLCanvasElement,
  pattern: Pattern,
  opts?: { highlight?: number; fitWidth?: number; cellPx?: number; cols?: number; rows?: number; stride?: number },
) {
  const cols = Math.max(1, opts?.cols ?? pattern.size)
  const rows = Math.max(1, opts?.rows ?? pattern.size)
  const stride = Math.max(1, opts?.stride ?? pattern.size)
  const highlight = opts?.highlight ?? -1
  const width = Math.max(1, opts?.fitWidth ?? (canvas.clientWidth || 640))
  const cell = opts?.cellPx ?? Math.max(10, Math.floor(width / (cols + 3)))
  const padLeft = cell * 2
  const padTop = cell * 2
  const cssW = padLeft + cols * cell + cell
  const cssH = padTop + rows * cell + cell
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    diag.error('canvas', 'Missing chart canvas context')
    return
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#faf7f1'
  ctx.fillRect(0, 0, cssW, cssH)

  ctx.font = `${Math.max(9, cell * 0.55)}px "Source Sans 3", sans-serif`
  ctx.fillStyle = '#6b6358'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < cols; i++) {
    if ((i + 1) % 10 === 0 || i === cols - 1) {
      ctx.fillText(String(i + 1), padLeft + (i + 0.5) * cell, padTop - cell * 0.6)
    }
  }
  for (let i = 0; i < rows; i++) {
    if ((i + 1) % 10 === 0 || i === rows - 1) {
      ctx.fillText(String(i + 1), padLeft - cell * 0.7, padTop + (i + 0.5) * cell)
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = pattern.cells[row * stride + col] ?? -1
      const x = padLeft + col * cell
      const y = padTop + row * cell
      if (id < 0) {
        ctx.fillStyle = '#f4efe6'
        ctx.fillRect(x, y, cell, cell)
        continue
      }
      const color = pattern.colors[id]
      if (!color) continue
      const dim = highlight >= 0 && id !== highlight
      ctx.globalAlpha = dim ? 0.2 : 1
      ctx.fillStyle = color.hex
      ctx.fillRect(x, y, cell, cell)
      ctx.fillStyle = '#1c1916'
      ctx.font = `${Math.max(8, cell * 0.55)}px "Source Sans 3", sans-serif`
      ctx.fillText(color.symbol, x + cell / 2, y + cell / 2 + 0.5)
      ctx.globalAlpha = 1
    }
  }

  ctx.strokeStyle = '#e0d8cc'
  ctx.lineWidth = 1
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath()
    ctx.moveTo(padLeft + i * cell, padTop)
    ctx.lineTo(padLeft + i * cell, padTop + rows * cell)
    ctx.stroke()
  }
  for (let i = 0; i <= rows; i++) {
    ctx.beginPath()
    ctx.moveTo(padLeft, padTop + i * cell)
    ctx.lineTo(padLeft + cols * cell, padTop + i * cell)
    ctx.stroke()
  }

  ctx.strokeStyle = '#1c1916'
  ctx.lineWidth = 1.6
  for (let i = 0; i <= cols; i += 10) {
    ctx.beginPath()
    ctx.moveTo(padLeft + i * cell, padTop)
    ctx.lineTo(padLeft + i * cell, padTop + rows * cell)
    ctx.stroke()
  }
  for (let i = 0; i <= rows; i += 10) {
    ctx.beginPath()
    ctx.moveTo(padLeft, padTop + i * cell)
    ctx.lineTo(padLeft + cols * cell, padTop + i * cell)
    ctx.stroke()
  }

  ctx.strokeStyle = '#3f5344'
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 1
  const mid = padLeft + (cols / 2) * cell
  const midY = padTop + (rows / 2) * cell
  ctx.beginPath()
  ctx.moveTo(mid, padTop)
  ctx.lineTo(mid, padTop + rows * cell)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(padLeft, midY)
  ctx.lineTo(padLeft + cols * cell, midY)
  ctx.stroke()
  ctx.setLineDash([])
}

export function renderKey(canvas: HTMLCanvasElement, pattern: Pattern) {
  const rowH = 28
  const h = 48 + pattern.colors.length * rowH
  const w = 520
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#faf7f1'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#1c1916'
  ctx.font = '600 16px Fraunces, serif'
  ctx.fillText('Floss key', 16, 28)
  ctx.font = '13px "Source Sans 3", sans-serif'
  pattern.colors.forEach((c, i) => {
    const y = 44 + i * rowH
    ctx.fillStyle = c.hex
    ctx.fillRect(16, y, 22, 22)
    ctx.strokeStyle = '#e0d8cc'
    ctx.strokeRect(16, y, 22, 22)
    ctx.fillStyle = '#1c1916'
    ctx.fillText(`${c.symbol}   ${c.dmc ? `DMC ${c.dmc}` : ''}  ${c.name}   ${c.count} sts   ${c.skeins} skeins`, 48, y + 16)
  })
}
