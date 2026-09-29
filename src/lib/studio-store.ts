import { create } from 'zustand'
import { diag, setDiagContext } from './diag/log'
import {
  AIDA_COUNTS,
  clamp,
  DEFAULT_SETTINGS,
  HOOP_INCHES,
  type AidaCount,
  type FitMode,
  type HoopInches,
  type PaletteMode,
  type Pattern,
  type StudioSettings,
} from './stitch/types'

const SETTINGS_KEY = 'loopscoop.settings'
const LEGACY_KEY = 'hoopstitch.settings'

/**
 * Tone sliders use the outline's whole-number scale. Settings saved by the
 * August build used fractions (-0.5..0.5), so a small non-integer is read as
 * that old scale and converted once.
 */
function toneNumber(v: unknown, fallback: number, min: number, max: number) {
  let n = asNumber(v, fallback)
  if (!Number.isInteger(n) && Math.abs(n) <= 0.5) n *= 100
  return Math.round(clamp(n, min, max))
}

function asNumber(v: unknown, fallback: number) {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

export function sanitizeSettings(raw: unknown): StudioSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const hoop = asNumber(src.hoopInches, DEFAULT_SETTINGS.hoopInches)
  const aida = asNumber(src.aidaCount, DEFAULT_SETTINGS.aidaCount)
  const fit = src.fitMode === 'fill' ? 'fill' : 'fit'
  const palette: PaletteMode = src.paletteMode === 'photo' ? 'photo' : 'dmc'
  return {
    hoopInches: (HOOP_INCHES as readonly number[]).includes(hoop)
      ? (hoop as HoopInches)
      : DEFAULT_SETTINGS.hoopInches,
    aidaCount: (AIDA_COUNTS as readonly number[]).includes(aida)
      ? (aida as AidaCount)
      : DEFAULT_SETTINGS.aidaCount,
    colorCount: Math.round(clamp(asNumber(src.colorCount, 16), 6, 32)),
    zoom: clamp(asNumber(src.zoom, 1), 0.6, 3),
    panX: clamp(asNumber(src.panX, 0), -0.7, 0.7),
    panY: clamp(asNumber(src.panY, 0), -0.7, 0.7),
    brightness: toneNumber(src.brightness, DEFAULT_SETTINGS.brightness, -40, 40),
    contrast: toneNumber(src.contrast, DEFAULT_SETTINGS.contrast, -40, 40),
    saturation: toneNumber(src.saturation, DEFAULT_SETTINGS.saturation, -40, 60),
    fitMode: fit as FitMode,
    paletteMode: palette,
    knockOutBackground: src.knockOutBackground === true,
  }
}

function readSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return sanitizeSettings(JSON.parse(raw))
  } catch (err) {
    diag.warn('store', 'Recovered default settings from unreadable storage', { error: err })
    return { ...DEFAULT_SETTINGS }
  }
}

function writeSettings(settings: StudioSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (err) {
    diag.warn('store', 'Could not save settings', { error: err })
  }
}

export type StudioState = {
  ready: boolean
  settings: StudioSettings
  image: HTMLImageElement | null
  objectUrl: string | null
  sourceName: string
  pattern: Pattern | null
  building: boolean
  view: 'hoop' | 'chart'
  highlight: number
  printOpen: boolean
  diagOpen: boolean
  lastError: string | null
  hydrate: () => void
  patch: (partial: Partial<StudioSettings>) => void
  setFitMode: (fitMode: FitMode) => void
  setPhoto: (image: HTMLImageElement, objectUrl: string | null, sourceName: string) => void
  clearPhoto: () => void
  setPattern: (pattern: Pattern | null, gen: number) => void
  setBuilding: (building: boolean) => void
  setView: (view: 'hoop' | 'chart') => void
  setHighlight: (id: number) => void
  setPrintOpen: (open: boolean) => void
  setDiagOpen: (open: boolean) => void
  setLastError: (msg: string | null) => void
}

let buildGen = 0
export function nextBuildGen() {
  buildGen += 1
  return buildGen
}
export function currentBuildGen() {
  return buildGen
}

export const useStudio = create<StudioState>((set, get) => ({
  ready: false,
  settings: { ...DEFAULT_SETTINGS },
  image: null,
  objectUrl: null,
  sourceName: '',
  pattern: null,
  building: false,
  view: 'hoop',
  highlight: -1,
  printOpen: false,
  diagOpen: false,
  lastError: null,
  hydrate: () => {
    const settings = readSettings()
    setDiagContext({
      action: 'hydrate',
      settings: {
        hoopInches: settings.hoopInches,
        aidaCount: settings.aidaCount,
        zoom: settings.zoom,
        fitMode: settings.fitMode,
      },
    })
    set({ settings, ready: true })
  },
  patch: (partial) => {
    const settings = sanitizeSettings({ ...get().settings, ...partial })
    writeSettings(settings)
    setDiagContext({
      action: 'patch-settings',
      settings: {
        hoopInches: settings.hoopInches,
        aidaCount: settings.aidaCount,
        zoom: settings.zoom,
        fitMode: settings.fitMode,
      },
    })
    set({ settings })
  },
  setFitMode: (fitMode) => {
    get().patch({ fitMode, zoom: 1, panX: 0, panY: 0 })
  },
  setPhoto: (image, objectUrl, sourceName) => {
    const prev = get().objectUrl
    if (prev && prev !== objectUrl) {
      try {
        URL.revokeObjectURL(prev)
      } catch {
        /* ignore */
      }
    }
    setDiagContext({ action: 'set-photo', pattern: { sourceName: sourceName.slice(0, 80) } })
    set({
      image,
      objectUrl,
      sourceName,
      pattern: null,
      lastError: null,
      highlight: -1,
    })
    get().patch({ zoom: 1, panX: 0, panY: 0, fitMode: 'fit' })
  },
  clearPhoto: () => {
    const prev = get().objectUrl
    if (prev) {
      try {
        URL.revokeObjectURL(prev)
      } catch {
        /* ignore */
      }
    }
    set({ image: null, objectUrl: null, sourceName: '', pattern: null, highlight: -1 })
  },
  setPattern: (pattern, gen) => {
    if (gen !== currentBuildGen()) return
    if (pattern) {
      setDiagContext({
        action: 'pattern-ready',
        pattern: {
          size: pattern.size,
          totalStitches: pattern.totalStitches,
          colorCount: pattern.colors.length,
          sourceName: pattern.sourceName.slice(0, 80),
        },
      })
    }
    set({ pattern, building: false })
  },
  setBuilding: (building) => set({ building }),
  setView: (view) => set({ view }),
  setHighlight: (id) => set({ highlight: id }),
  setPrintOpen: (open) => set({ printOpen: open }),
  setDiagOpen: (open) => set({ diagOpen: open }),
  setLastError: (msg) => set({ lastError: msg }),
}))
