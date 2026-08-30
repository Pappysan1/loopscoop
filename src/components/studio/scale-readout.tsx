import { stitchCount } from '../../lib/stitch/types'
import { useStudio } from '../../lib/studio-store'

export function ScaleReadout() {
  const settings = useStudio((s) => s.settings)
  const pattern = useStudio((s) => s.pattern)
  const n = stitchCount(settings.hoopInches, settings.aidaCount)
  const mm = (settings.hoopInches * 25.4) / n
  const skeinHint = pattern ? Math.max(0.5, Math.ceil((pattern.totalStitches / 1600) * 2) / 2) : 0
  return (
    <div className="mt-2 space-y-1 text-sm text-muted">
      <div>
        {settings.hoopInches}" hoop · {settings.aidaCount}-count Aida · {pattern?.colors.length ?? settings.colorCount} colors
      </div>
      <div>
        {n} stitches across · {mm.toFixed(2)} mm per stitch
        {pattern ? ` · ${pattern.totalStitches.toLocaleString()} stitches · ~${skeinHint} skeins` : ''}
      </div>
      <div>Drag to reframe. Fit keeps the whole photo; fill crops to the hoop.</div>
    </div>
  )
}
