import { useEffect, useRef } from 'react'
import { diag } from '../../lib/diag/log'
import { hoopFrame } from '../../lib/stitch/frame'
import { renderHoop } from '../../lib/stitch/render-hoop'
import { useStudio } from '../../lib/studio-store'

export function HoopPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const pan = useRef({ x: 0, y: 0 })
  const image = useStudio((s) => s.image)
  const pattern = useStudio((s) => s.pattern)
  const settings = useStudio((s) => s.settings)
  const highlight = useStudio((s) => s.highlight)
  const patch = useStudio((s) => s.patch)
  pan.current = { x: settings.panX, y: settings.panY }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const live = dragging.current
    renderHoop(canvas, {
      pattern,
      image,
      highlight,
      livePhoto: live && !!image,
      frame: image
        ? hoopFrame(
            image.naturalWidth || image.width,
            image.naturalHeight || image.height,
            settings.zoom,
            settings.panX,
            settings.panY,
            settings.fitMode,
          )
        : undefined,
    })
  }, [image, pattern, settings, highlight])

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block w-full max-w-[min(100%,520px)] touch-none rounded-xl bg-linen"
      style={{ aspectRatio: '1 / 1' }}
      onPointerDown={(e) => {
        if (!image) return
        dragging.current = true
        last.current = { x: e.clientX, y: e.clientY }
        const s = useStudio.getState().settings
        pan.current = { x: s.panX, y: s.panY }
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch (err) {
          diag.warn('canvas', 'Pointer capture failed', { error: err })
        }
      }}
      onPointerMove={(e) => {
        if (!dragging.current || !image) return
        const canvas = canvasRef.current
        const w = canvas?.clientWidth || 640
        const dx = (e.clientX - last.current.x) / w
        const dy = (e.clientY - last.current.y) / w
        last.current = { x: e.clientX, y: e.clientY }
        pan.current = { x: pan.current.x - dx, y: pan.current.y - dy }
        patch({ panX: pan.current.x, panY: pan.current.y })
        if (canvas) {
          const s = useStudio.getState().settings
          renderHoop(canvas, {
            pattern,
            image,
            livePhoto: true,
            frame: hoopFrame(
              image.naturalWidth || image.width,
              image.naturalHeight || image.height,
              s.zoom,
              pan.current.x,
              pan.current.y,
              s.fitMode,
            ),
          })
        }
      }}
      onPointerUp={() => {
        dragging.current = false
      }}
      onPointerCancel={() => {
        dragging.current = false
      }}
    />
  )
}
