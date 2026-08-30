import { clamp, type FitMode, type HoopFrame } from './types'

export function hoopFrame(
  imgW: number,
  imgH: number,
  zoom: number,
  panX: number,
  panY: number,
  fitMode: FitMode,
): HoopFrame {
  const z = clamp(zoom, 0.6, 3)
  const px = clamp(panX, -0.7, 0.7)
  const py = clamp(panY, -0.7, 0.7)
  const w = Math.max(1, imgW)
  const h = Math.max(1, imgH)
  const side = (fitMode === 'fill' ? Math.min(w, h) : Math.max(w, h)) / z
  const originX = w / 2 - side / 2 + px * side
  const originY = h / 2 - side / 2 + py * side
  return { originX, originY, side }
}

export function sampleCell(
  frame: HoopFrame,
  n: number,
  col: number,
  row: number,
): { x: number; y: number } {
  const cell = frame.side / Math.max(1, n)
  return {
    x: frame.originX + (col + 0.5) * cell,
    y: frame.originY + (row + 0.5) * cell,
  }
}
