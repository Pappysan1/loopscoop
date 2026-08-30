export const HOOP_INCHES = [4, 5, 6, 8, 10] as const
export const AIDA_COUNTS = [11, 14, 16, 18] as const

export type HoopInches = (typeof HOOP_INCHES)[number]
export type AidaCount = (typeof AIDA_COUNTS)[number]
export type FitMode = 'fit' | 'fill'
export type PaletteMode = 'dmc' | 'photo'

export type StudioSettings = {
  hoopInches: HoopInches
  aidaCount: AidaCount
  colorCount: number
  zoom: number
  panX: number
  panY: number
  brightness: number
  contrast: number
  saturation: number
  fitMode: FitMode
  paletteMode: PaletteMode
  knockOutBackground: boolean
}

export type FlossColor = {
  hex: string
  dmc?: string
  name: string
  symbol: string
  count: number
  skeins: number
}

export type Pattern = {
  size: number
  hoopInches: HoopInches
  aidaCount: AidaCount
  cells: Int16Array
  colors: FlossColor[]
  totalStitches: number
  sourceName: string
}

export type HoopFrame = {
  originX: number
  originY: number
  side: number
}

export const DEFAULT_SETTINGS: StudioSettings = {
  hoopInches: 6,
  aidaCount: 14,
  colorCount: 16,
  zoom: 1,
  panX: 0,
  panY: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  fitMode: 'fit',
  paletteMode: 'dmc',
  knockOutBackground: false,
}

export function stitchCount(hoopInches: number, aidaCount: number) {
  const n = Math.round(hoopInches * aidaCount)
  return Math.min(180, Math.max(24, n))
}

export function skeinsFor(count: number) {
  return Math.max(0.5, Math.ceil((count / 1600) * 2) / 2)
}

export function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}
