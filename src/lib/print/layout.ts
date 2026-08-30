import { stitchCount } from '../stitch/types'
import type { Pattern } from '../stitch/types'

export function pagePlan(pattern: Pattern) {
  const n = pattern.size
  const cellIn = 0.17
  const usableW = 7.4
  const usableH = 8.6
  const cols = Math.max(1, Math.floor(usableW / cellIn))
  const rows = Math.max(1, Math.floor(usableH / cellIn))
  const tilesX = Math.ceil(n / cols)
  const tilesY = Math.ceil(n / rows)
  const chartPages = tilesX * tilesY
  const keyPages = Math.max(1, Math.ceil(pattern.colors.length / 22))
  const total = 1 + chartPages + keyPages
  return {
    total,
    chartPages,
    keyPages,
    cols,
    rows,
    tilesX,
    tilesY,
    cellIn,
    label: `${total} letter pages · hoop, ${chartPages} stitch-size charts, floss key`,
    density: stitchCount(pattern.hoopInches, pattern.aidaCount),
  }
}
