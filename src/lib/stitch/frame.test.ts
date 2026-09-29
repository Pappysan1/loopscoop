import { describe, expect, it } from 'vitest'
import { hoopFrame, photoOnHoop, projectSize } from './frame'

describe('projectSize', () => {
  it('buckets by stitch count', () => {
    expect(projectSize(0).label).toBe('Evening')
    expect(projectSize(1799).label).toBe('Evening')
    expect(projectSize(1800).label).toBe('Weekend')
    expect(projectSize(5499).label).toBe('Weekend')
    expect(projectSize(5500).label).toBe('Long')
    expect(projectSize(12999).label).toBe('Long')
    expect(projectSize(13000).label).toBe('Heirloom')
    expect(projectSize(Number.NaN).label).toBe('Evening')
  })
})

describe('photoOnHoop', () => {
  it('fill mode: short side matches the hoop', () => {
    const f = hoopFrame(4000, 3000, 1, 0, 0, 'fill')
    const s = photoOnHoop(4000, 3000, f, 6)
    expect(s.heightIn).toBeCloseTo(6)
    expect(s.widthIn).toBeCloseTo(8)
  })

  it('zooming in makes the photo larger on the fabric', () => {
    const f = hoopFrame(3000, 3000, 2, 0, 0, 'fit')
    expect(photoOnHoop(3000, 3000, f, 5).widthIn).toBeCloseTo(10)
  })

  it('pan moves the origin by hoop sides', () => {
    const a = hoopFrame(1000, 1000, 1, 0, 0, 'fill')
    const b = hoopFrame(1000, 1000, 1, 0.1, 0, 'fill')
    expect(b.originX - a.originX).toBeCloseTo(0.1 * a.side)
  })
})
