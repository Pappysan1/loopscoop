import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDiag,
  exportDiagJson,
  exportDiagText,
  getDiagEvents,
  logEvent,
  resetDiagForTests,
  safeName,
  scrub,
  setDiagContext,
} from './log'

const mem = new Map<string, string>()
const ls = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, String(v))
  },
  removeItem: (k: string) => {
    mem.delete(k)
  },
  clear: () => mem.clear(),
}
Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })

const LEAK = /data:[a-z0-9.+-]+\/[^,\s]*,|blob:|(?:content|file):\/\//i

beforeEach(() => {
  mem.clear()
  resetDiagForTests()
})

afterEach(() => {
  clearDiag()
  resetDiagForTests()
})

describe('diag log', () => {
  it('keeps a ring of events and never includes image payloads', () => {
    logEvent('error', 'stitch', 'data:image/png;base64,AAAA blob:http://x/1 failed')
    const text = exportDiagJson()
    expect(text).not.toMatch(/data:image/)
    expect(text).not.toMatch(/blob:/)
    expect(getDiagEvents()[0]?.message).toContain('[image]')
  })

  it('recovers from poison loopscoop.diag JSON', () => {
    localStorage.setItem('loopscoop.diag', '{not json')
    clearDiag()
    logEvent('info', 'store', 'hello')
    expect(getDiagEvents().some((e) => e.message === 'hello')).toBe(true)
  })
})

describe('diag scrub (audit finding 4)', () => {
  it('catches upper/mixed case, non-base64 SVG, and other data URLs', () => {
    const out = scrub(
      'a DATA:IMAGE/PNG;BASE64,QUJD b data:image/svg+xml,%3Csvg%3E c Blob:https://x/9 d data:application/octet-stream;base64,AAAA e content://media/external/images/12 f file:///C:/Users/Maria/cat.jpg',
    )
    expect(out).not.toMatch(LEAK)
    expect(out).toContain('[image]')
    expect(out).toContain('[data]')
    expect(out).toContain('[blob]')
    expect(out).toContain('[path]')
  })

  it('reduces photo file names to a short plain slug', () => {
    expect(safeName('Maria\u2019s b\u00e9b\u00e9 <script>.jpg')).toBe('Marias bebe script.jpg')
    expect(safeName('blob:https://x/1')).toBe('blob')
    expect(safeName('')).toBe('photo')
    expect(safeName('x'.repeat(200)).length).toBe(40)
  })

  it('scrubs action, settings, and pattern context on every event', () => {
    setDiagContext({
      action: 'set-photo DATA:image/png;base64,QUJD',
      settings: { note: 'blob:http://x/2', zoom: Number.NaN, fitMode: 'fit' },
      pattern: { sourceName: 'file:///C:/Users/Maria/Secret Photo.jpg', size: 80 },
    })
    logEvent('warn', 'store', 'ctx')
    const e = getDiagEvents()[0]!
    expect(e.action).not.toMatch(LEAK)
    expect(e.settings?.note).toBe('[blob]')
    expect(e.settings?.zoom).toBeNull()
    expect(e.pattern?.sourceName).not.toMatch(/Maria|file:/i)
    expect(e.pattern?.size).toBe(80)
    expect(exportDiagJson()).not.toMatch(LEAK)
    expect(exportDiagText()).not.toMatch(LEAK)
  })

  it('scrubs persisted entries when they are loaded back', () => {
    localStorage.setItem(
      'loopscoop.diag',
      JSON.stringify([
        {
          id: 'x',
          time: '2026-01-01T00:00:00Z',
          level: 'error',
          source: 'stitch',
          message: 'boom',
          stack: 'at DATA:IMAGE/JPEG;BASE64,QUJD',
          action: 'blob:http://x/3',
          settings: { note: 'data:image/webp;base64,QUJD' },
          pattern: { sourceName: 'Blob:http://x/4', size: 60 },
          platform: 'web',
          userAgent: 'UA blob:http://x/5',
        },
      ]),
    )
    const e = getDiagEvents()[0]!
    expect(JSON.stringify(e)).not.toMatch(LEAK)
    expect(exportDiagJson()).not.toMatch(LEAK)
    expect(exportDiagText()).not.toMatch(LEAK)
  })

  it('keeps long stacks up to the stack cap, not the message cap', () => {
    logEvent('error', 'window', 'long', { stack: 'x'.repeat(5000) })
    expect(getDiagEvents()[0]?.stack?.length).toBe(5000)
  })
})
