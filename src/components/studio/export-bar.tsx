import { toast } from 'sonner'
import { diag } from '../../lib/diag/log'
import { renderChart, renderKey } from '../../lib/stitch/render-chart'
import { renderHoop } from '../../lib/stitch/render-hoop'
import { useStudio } from '../../lib/studio-store'

async function downloadCanvas(canvas: HTMLCanvasElement, name: string) {
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/png')
      } catch {
        resolve(null)
      }
    })
    if (!blob) throw new Error('Could not export that image.')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  } catch (err) {
    diag.error('canvas', 'PNG export failed', { error: err })
    toast.error('Could not download that image.')
  }
}

export function ExportBar() {
  const pattern = useStudio((s) => s.pattern)
  const setPrintOpen = useStudio((s) => s.setPrintOpen)
  const clearPhoto = useStudio((s) => s.clearPhoto)
  if (!pattern) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className="btn btn-primary" onClick={() => setPrintOpen(true)}>
        Print pattern
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const c = document.createElement('canvas')
          renderHoop(c, { pattern, cssSize: 1200 })
          void downloadCanvas(c, 'loopscoop-hoop.png')
        }}
      >
        Download hoop PNG
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const c = document.createElement('canvas')
          renderChart(c, pattern, { fitWidth: 1400 })
          void downloadCanvas(c, 'loopscoop-chart.png')
        }}
      >
        Symbol chart PNG
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          const c = document.createElement('canvas')
          renderKey(c, pattern)
          void downloadCanvas(c, 'loopscoop-key.png')
        }}
      >
        Color key PNG
      </button>
      <button type="button" className="btn" onClick={() => clearPhoto()}>
        Start over
      </button>
    </div>
  )
}
