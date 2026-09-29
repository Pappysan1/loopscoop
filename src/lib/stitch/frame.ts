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
  // Pan is measured in hoop sides, not the outline's imgW/2, so a drag moves
  // the photo one-to-one under the finger at any zoom. Kept on purpose.
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

export type ProjectSize = { label: 'Evening' | 'Weekend' | 'Long' | 'Heirloom'; note: string }

/** Rough project size from the stitch count, for the scale readout. */
export function projectSize(totalStitches: number): ProjectSize {
  const t = Number.isFinite(totalStitches) ? Math.max(0, totalStitches) : 0
  if (t < 1800) return { label: 'Evening', note: 'A sitting or two' }
  if (t < 5500) return { label: 'Weekend', note: 'Comfortable on this hoop' }
  if (t < 13000) return { label: 'Long', note: 'Plenty of stitches — still standard count' }
  return { label: 'Heirloom', note: 'Big piece; drop hoop size or count to simplify' }
}

/**
 * Physical size of the whole photo at the current framing, in inches.
 * The hoop spans frame.side image pixels, so the photo is hoop × img/side.
 */
export function photoOnHoop(
  imgW: number,
  imgH: number,
  frame: HoopFrame,
  hoopInches: number,
): { widthIn: number; heightIn: number } {
  const side = Math.max(1e-6, frame.side)
  return { widthIn: (hoopInches * Math.max(0, imgW)) / side, heightIn: (hoopInches * Math.max(0, imgH)) / side }
}
