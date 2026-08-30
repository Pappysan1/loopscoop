import { useEffect, useRef } from 'react'
import { renderChart } from '../../lib/stitch/render-chart'
import { useStudio } from '../../lib/studio-store'

export function ChartView() {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const pattern = useStudio((s) => s.pattern)
  const highlight = useStudio((s) => s.highlight)

  useEffect(() => {
    const canvas = ref.current
    const box = wrap.current
    if (!canvas || !pattern || !box) return
    renderChart(canvas, pattern, { highlight, fitWidth: box.clientWidth || 640 })
  }, [pattern, highlight])

  if (!pattern) return null
  return (
    <div ref={wrap} className="w-full overflow-x-auto">
      <canvas ref={ref} className="block" />
    </div>
  )
}
