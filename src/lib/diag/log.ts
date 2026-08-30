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
    return navigator.userAgent.slice(0, 400)
  } catch {
    return 'unknown'
  }
}

function rid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function scrub(value: unknown): string {
  const s = String(value ?? '')
  return s
    .replace(/data:image\/[a-zA-Z0-9+]+;base64,[a-zA-Z0-9+/=]+/g, '[image]')
    .replace(/blob:[^\s)]+/g, '[blob]')
    .slice(0, MSG_MAX)
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
        source: (rec.source as DiagSource) || 'window',
        message: scrub(rec.message),
        stack: typeof rec.stack === 'string' ? rec.stack.slice(0, STACK_MAX) : undefined,
        action: typeof rec.action === 'string' ? rec.action : undefined,
        settings: rec.settings && typeof rec.settings === 'object' ? rec.settings : undefined,
        pattern: rec.pattern && typeof rec.pattern === 'object' ? rec.pattern : undefined,
        platform: rec.platform === 'electron' || rec.platform === 'android' ? rec.platform : 'web',
        userAgent: typeof rec.userAgent === 'string' ? rec.userAgent : ua(),
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
}

export function setDiagContext(next: {
  action?: string
  settings?: DiagEvent['settings']
  pattern?: DiagEvent['pattern']
}) {
  try {
    if (next.action) lastAction = next.action
    if (next.settings) extraSettings = next.settings
    if (next.pattern) extraPattern = next.pattern
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
      stack: scrub(extra?.stack ?? stackFromErr).slice(0, STACK_MAX) || undefined,
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
  if (/data:image|blob:/.test(text)) {
    return JSON.stringify({ error: 'refused to export: image data leaked' })
  }
  return text
}

export function exportDiagText() {
  ensureLoaded()
  return ring
    .map((e) => `[${e.time}] ${e.level.toUpperCase()} ${e.source} ${e.message}${e.stack ? `\n${e.stack}` : ''}`)
    .join('\n\n')
}
