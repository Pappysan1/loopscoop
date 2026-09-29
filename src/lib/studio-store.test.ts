import { describe, expect, it } from 'vitest'
import { sanitizeSettings } from './studio-store'
import { stitchCount } from './stitch/types'

describe('sanitizeSettings', () => {
  it('recovers garbage to 6 inch / 14ct / zoom 1', () => {
    const s = sanitizeSettings({ hoopInches: 'nope', aidaCount: NaN, zoom: 'NaN', panX: {}, fitMode: 'zoom', paletteMode: 2 })
    expect(s.hoopInches).toBe(6)
    expect(s.aidaCount).toBe(14)
    expect(s.zoom).toBe(1)
    expect(s.fitMode).toBe('fit')
    expect(s.paletteMode).toBe('dmc')
  })

  it('clamps color count and pan', () => {
    const s = sanitizeSettings({ colorCount: 99, panX: 8, panY: -9, knockOutBackground: 'yes' })
    expect(s.colorCount).toBe(32)
    expect(s.panX).toBe(0.7)
    expect(s.panY).toBe(-0.7)
    expect(s.knockOutBackground).toBe(false)
  })
})

describe('stitchCount', () => {
  it('clamps between 24 and 180', () => {
    expect(stitchCount(4, 14)).toBe(56)
    expect(stitchCount(10, 18)).toBe(180)
    expect(stitchCount(1, 11)).toBe(24)
  })
})

describe('tone sliders (outline scale)', () => {
  it('defaults to brightness 0, contrast 8, saturation 12', () => {
    const s = sanitizeSettings({})
    expect([s.brightness, s.contrast, s.saturation]).toEqual([0, 8, 12])
  })

  it('clamps to -40..40, -40..40, -40..60', () => {
    const s = sanitizeSettings({ brightness: 99, contrast: -99, saturation: 99 })
    expect([s.brightness, s.contrast, s.saturation]).toEqual([40, -40, 60])
  })

  it('converts settings saved on the old fractional scale', () => {
    const s = sanitizeSettings({ brightness: 0.1, contrast: -0.24, saturation: 0.5 })
    expect([s.brightness, s.contrast, s.saturation]).toEqual([10, -24, 50])
  })

  it('falls back on poison values', () => {
    const s = sanitizeSettings({ brightness: 'x', contrast: null, saturation: NaN })
    expect([s.brightness, s.contrast, s.saturation]).toEqual([0, 8, 12])
  })
})
