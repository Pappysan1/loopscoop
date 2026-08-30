import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearDiag, exportDiagJson, getDiagEvents, logEvent, resetDiagForTests } from './log'

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
