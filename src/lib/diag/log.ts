export type DiagLevel = 'fatal' | 'error' | 'warn' | 'info'
export type DiagSource =
  | 'window'
  | 'react'
  | 'stitch'
  | 'canvas'
  | 'print'
  | 'bluetooth'
  | 'store'
  | 'electron'
  | 'uploader'
  | 'console'

export type DiagEvent = {
  id: string
  time: string
  level: DiagLevel
  source: DiagSource
  message: string
  stack?: string
  action?: string
  settings?: Record<string, string | number | boolean | null>
  pattern?: {
    size?: number
    totalStitches?: number
    colorCount?: number
    sourceName?: string
  }
  platform: 'web' | 'electron' | 'android'
  userAgent: string
}

const MEMORY_CAP = 200
const PERSIST_CAP = 100
const STORAGE_KEY = 'loopscoop.diag'
const MSG_MAX = 2000
const STACK_MAX = 8000

const ring: DiagEvent[] = []
const listeners = new Set<() => void>()
let persistOk = true
let lastAction: string | undefined
let extraSettings: DiagEvent['settings']
let extraPattern: DiagEvent['pattern']

function platform(): DiagEvent['platform'] {
  try {
    const w = window as Window & { electronLoopScoop?: boolean; Capacitor?: { isNativePlatform?: () => boolean } }
    if (w.electronLoopScoop) return 'electron'
    if (w.Capacitor?.isNativePlatform?.()) return 'android'
  } catch {
    /* ignore */
  }
  return 'web'
}

function ua() {
  try {
    return scrub(navigator.userAgent, 400)
  } catch {
    return 'unknown'
  }
}

function rid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Anything that could carry photo bytes or point at a photo on disk.
// Case-insensitive: browsers accept DATA:IMAGE/... and Blob: just the same.
const DATA_IMAGE_RE = /data:image\/[^,\s]*,[^\s"'<>)]*/gi
const DATA_ANY_RE = /data:[a-z0-9.+-]+\/[^,\s]*,[^\s"'<>)]*/gi
const BLOB_RE = /blob:[^\s"'<>)]+/gi
const LOCAL_URI_RE = /\b(?:content|file):\/\/[^\s"'<>)]+/gi
// Last-line guard for exports. If this matches, something slipped past scrub().
const LEAK_RE = /data:[a-z0-9.+-]+\/[^,\s]*,|blob:|\b(?:content|file):\/\//i

export function scrub(value: unknown, max = MSG_MAX): string {
  const s = String(value ?? '')
  return s
    .replace(DATA_IMAGE_RE, '[image]')
    .replace(DATA_ANY_RE, '[data]')
    .replace(BLOB_RE, '[blob]')
    .replace(LOCAL_URI_RE, '[path]')
    .slice(0, max)
}

// Photo file names can be personal ("maria-birthday.jpg"). Keep only a short,
// plain slug so the log still says "a photo was loaded" without the details.
export function safeName(value: unknown): string {
  const s = scrub(value, 200)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._ -]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return s || 'photo'
}

function cleanSettings(raw: unknown): DiagEvent['settings'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, string | number | boolean | null> = {}
  let n = 0
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n++ >= 30) break
    const key = scrub(k, 40)
    if (typeof v === 'number') out[key] = Number.isFinite(v) ? v : null
    else if (typeof v === 'boolean' || v === null) out[key] = v
    else if (typeof v === 'string') out[key] = scrub(v, 100)
  }
  return out
}

function cleanPattern(raw: unknown): DiagEvent['pattern'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  return {
    size: num(r.size),
    totalStitches: num(r.totalStitches),
    colorCount: num(r.colorCount),
    sourceName: r.sourceName === undefined ? undefined : safeName(r.sourceName),
  }
}

function emitChange() {
  for (const fn of listeners) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

function persist() {
  if (!persistOk) return
  try {
    const slice = ring.slice(0, PERSIST_CAP)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slice))
  } catch {
    persistOk = false
    ring.unshift({
      id: rid(),
      time: new Date().toISOString(),
      level: 'warn',
      source: 'store',
      message: 'Could not persist diagnostic log (storage quota or blocked).',
      platform: platform(),
      userAgent: ua(),
    })
    if (ring.length > MEMORY_CAP) ring.length = MEMORY_CAP
  }
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Partial<DiagEvent>
      if (typeof rec.message !== 'string') continue
      ring.push({
        id: typeof rec.id === 'string' ? rec.id : rid(),
        time: typeof rec.time === 'string' ? rec.time : new Date().toISOString(),
        level: rec.level === 'fatal' || rec.level === 'error' || rec.level === 'warn' || rec.level === 'info' ? rec.level : 'error',
        source: typeof rec.source === 'string' ? (scrub(rec.source, 20) as DiagSource) : 'window',
        message: scrub(rec.message),
        stack: typeof rec.stack === 'string' ? scrub(rec.stack, STACK_MAX) : undefined,
        action: typeof rec.action === 'string' ? scrub(rec.action, 80) : undefined,
        settings: cleanSettings(rec.settings),
        pattern: cleanPattern(rec.pattern),
        platform: rec.platform === 'electron' || rec.platform === 'android' ? rec.platform : 'web',
        userAgent: typeof rec.userAgent === 'string' ? scrub(rec.userAgent, 400) : ua(),
      })
    }
    if (ring.length > MEMORY_CAP) ring.length = MEMORY_CAP
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}

let loaded = false
function ensureLoaded() {
  if (loaded) return
  loaded = true
  try {
    if (typeof localStorage !== 'undefined') loadPersisted()
  } catch {
    /* ignore */
  }
}

export function resetDiagForTests() {
  loaded = false
  ring.length = 0
  persistOk = true
  lastAction = undefined
  extraSettings = undefined
  extraPattern = undefined
}

export function setDiagContext(next: {
  action?: string
  settings?: DiagEvent['settings']
  pattern?: DiagEvent['pattern']
}) {
  try {
    if (next.action) lastAction = scrub(next.action, 80)
    if (next.settings) extraSettings = cleanSettings(next.settings)
    if (next.pattern) extraPattern = cleanPattern(next.pattern)
  } catch {
    /* ignore */
  }
}

export function logEvent(
  level: DiagLevel,
  source: DiagSource,
  message: unknown,
  extra?: { stack?: unknown; error?: unknown },
) {
  try {
    ensureLoaded()
    const err = extra?.error
    const stackFromErr = err && typeof err === 'object' && 'stack' in err ? String((err as Error).stack ?? '') : ''
    const event: DiagEvent = {
      id: rid(),
      time: new Date().toISOString(),
      level,
      source,
      message: scrub(message),
      stack: scrub(extra?.stack ?? stackFromErr, STACK_MAX) || undefined,
      action: lastAction,
      settings: extraSettings,
      pattern: extraPattern,
      platform: platform(),
      userAgent: ua(),
    }
    ring.unshift(event)
    if (ring.length > MEMORY_CAP) ring.length = MEMORY_CAP
    persist()
    emitChange()
    try {
      const w = window as Window & { electronDiagAppend?: (e: DiagEvent) => void }
      w.electronDiagAppend?.(event)
    } catch {
      /* ignore */
    }
  } catch {
    /* logging never throws */
  }
}

export const diag = {
  fatal: (source: DiagSource, message: unknown, extra?: { stack?: unknown; error?: unknown }) =>
    logEvent('fatal', source, message, extra),
  error: (source: DiagSource, message: unknown, extra?: { stack?: unknown; error?: unknown }) =>
    logEvent('error', source, message, extra),
  warn: (source: DiagSource, message: unknown, extra?: { stack?: unknown; error?: unknown }) =>
    logEvent('warn', source, message, extra),
  info: (source: DiagSource, message: unknown, extra?: { stack?: unknown; error?: unknown }) =>
    logEvent('info', source, message, extra),
}

export function getDiagEvents() {
  ensureLoaded()
  return ring.slice()
}

export function diagCount() {
  ensureLoaded()
  return ring.length
}

export function subscribeDiag(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function clearDiag() {
  try {
    ring.length = 0
    persistOk = true
    localStorage.removeItem(STORAGE_KEY)
    emitChange()
  } catch {
    ring.length = 0
    emitChange()
  }
}

export function exportDiagJson() {
  ensureLoaded()
  const payload = ring.map((e) => ({
    ...e,
    settings: e.settings ?? null,
    pattern: e.pattern ?? null,
  }))
  const text = JSON.stringify(payload, null, 2)
  if (LEAK_RE.test(text)) {
    return JSON.stringify({ error: 'refused to export: image data leaked' })
  }
  return text
}

// Used by both "Export text" and "Copy", so both get the same leak guard.
export function exportDiagText() {
  ensureLoaded()
  const text = ring
    .map((e) => `[${e.time}] ${e.level.toUpperCase()} ${e.source} ${e.message}${e.stack ? `\n${e.stack}` : ''}`)
    .join('\n\n')
  if (LEAK_RE.test(text)) {
    return 'Refused to export: image data leaked into the log. Use Clear and try again.'
  }
  return text
}
