import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { diag } from '../../lib/diag/log'
import {
  connectPrinter,
  currentPrinter,
  printPatternBluetooth,
  PrinterPickerCancelled,
  webBluetoothAvailable,
} from '../../lib/print/bluetooth'
import { pagePlan } from '../../lib/print/layout'
import { buildPatternPdf } from '../../lib/print/pages'
import { renderChart, renderKey } from '../../lib/stitch/render-chart'
import { renderHoop } from '../../lib/stitch/render-hoop'
import { useStudio } from '../../lib/studio-store'

function slug(name: string) {
  return (name || 'pattern').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pattern'
}

export function PrintSheet() {
  const open = useStudio((s) => s.printOpen)
  const setPrintOpen = useStudio((s) => s.setPrintOpen)
  const pattern = useStudio((s) => s.pattern)
  const hoopRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const keyRef = useRef<HTMLCanvasElement>(null)
  const [pdf, setPdf] = useState<Blob | null>(null)
  const [btName, setBtName] = useState(currentPrinter()?.name || '')
  const ios = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)

  useEffect(() => {
    if (!open || !pattern) return
    if (hoopRef.current) renderHoop(hoopRef.current, { pattern, cssSize: 240 })
    if (chartRef.current) renderChart(chartRef.current, pattern, { fitWidth: 240 })
    if (keyRef.current) renderKey(keyRef.current, pattern)
    let cancelled = false
    setPdf(null)
    void buildPatternPdf(pattern).then((blob) => {
      if (!cancelled) setPdf(blob)
    })
    return () => {
      cancelled = true
    }
  }, [open, pattern])

  if (!open || !pattern) return null
  const plan = pagePlan(pattern)

  async function savePdf() {
    if (!pdf || !pattern) {
      toast.error('PDF is still preparing.')
      return
    }
    const url = URL.createObjectURL(pdf)
    const a = document.createElement('a')
    a.href = url
    a.download = `loopscoop-${slug(pattern.sourceName)}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  async function printPaper() {
    if (!pdf || !pattern) {
      toast.error('PDF is still preparing.')
      return
    }
    const url = URL.createObjectURL(pdf)
    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-modals allow-same-origin allow-scripts')
    iframe.setAttribute('title', 'Print pattern')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = url
    document.body.appendChild(iframe)
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      iframe.remove()
      URL.revokeObjectURL(url)
      window.removeEventListener('afterprint', cleanup)
      window.removeEventListener('focus', cleanup)
    }
    const downloadInstead = () => {
      diag.warn('print', 'Print plugin missing; downloaded PDF instead')
      const a = document.createElement('a')
      a.href = url
      a.download = `loopscoop-${slug(pattern.sourceName)}.pdf`
      a.click()
      toast.message('PDF saved — open it and pick your printer')
      cleanup()
    }
    let pluginLoaded = false
    window.addEventListener('afterprint', cleanup)
    iframe.onload = () => {
      pluginLoaded = true
      try {
        iframe.contentWindow?.print()
      } catch (err) {
        diag.warn('print', 'Print plugin missing; downloaded PDF instead', { error: err })
        downloadInstead()
      }
    }
    iframe.onerror = () => downloadInstead()
    window.setTimeout(() => {
      if (!pluginLoaded && !cleaned) downloadInstead()
    }, 4000)
  }

  async function share() {
    if (!pdf || !pattern) return
    const file = new File([pdf], `loopscoop-${slug(pattern.sourceName)}.pdf`, { type: 'application/pdf' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Loop Scoop pattern' })
        return
      }
    } catch (err) {
      diag.warn('print', 'PDF share cancelled or failed', { error: err })
    }
    try {
      const files: File[] = []
      const hoop = hoopRef.current
      const chart = chartRef.current
      const key = keyRef.current
      const toFile = async (c: HTMLCanvasElement | null, name: string) => {
        if (!c) return
        const blob = await new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), 'image/png'))
        if (blob) files.push(new File([blob], name, { type: 'image/png' }))
      }
      await toFile(hoop, 'loopscoop-hoop.png')
      await toFile(chart, 'loopscoop-chart.png')
      await toFile(key, 'loopscoop-key.png')
      if (files.length && navigator.canShare?.({ files })) {
        await navigator.share({ files, title: 'Loop Scoop pattern' })
        return
      }
    } catch (err) {
      diag.warn('print', 'PNG share failed', { error: err })
    }
    toast.message('Share the saved PDF, or use Print on paper.')
    await savePdf()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-lg overflow-auto rounded-xl border border-line bg-paper p-4">
        <h2 className="font-display text-xl">Print to stitch</h2>
        <p className="mt-2 text-sm text-muted">
          Connect Bluetooth printer talks to a pocket thermal (Phomemo, PeriPage, most ESC/POS rolls) and stays connected so you can print again.
          Print on paper opens the phone’s printer list — Bluetooth inkjet, AirPrint, or Save as PDF. Share can send the PDF over Bluetooth too.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div>
            <canvas ref={hoopRef} className="w-full rounded-lg bg-linen" />
            <div className="mt-1 text-center text-xs text-muted">Hoop</div>
          </div>
          <div>
            <canvas ref={chartRef} className="w-full rounded-lg bg-linen" />
            <div className="mt-1 text-center text-xs text-muted">Chart</div>
          </div>
          <div>
            <canvas ref={keyRef} className="w-full rounded-lg bg-linen" />
            <div className="mt-1 text-center text-xs text-muted">Key</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted">{plan.label}</p>
        <div className="mt-4 flex flex-col gap-2">
          {ios ? (
            <p className="text-sm text-muted">
              Pocket thermals need the Android app or Chrome on a computer. On iPhone, print on paper or save the PDF.
            </p>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    const hoop = document.createElement('canvas')
                    renderHoop(hoop, { pattern, cssSize: 384 })
                    const printer = await printPatternBluetooth(pattern, hoop)
                    setBtName(printer.name)
                    toast.success(`Printed to ${printer.name}`)
                  } catch (err) {
                    if (err instanceof PrinterPickerCancelled) return
                    toast.error(err instanceof Error ? err.message : 'Bluetooth print failed')
                  }
                }}
              >
                {btName ? `Print to ${btName}` : 'Connect Bluetooth printer'}
              </button>
              {webBluetoothAvailable() ? (
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    try {
                      const p = await connectPrinter(true)
                      setBtName(p.name)
                    } catch (err) {
                      if (err instanceof PrinterPickerCancelled) return
                      toast.error(err instanceof Error ? err.message : 'Could not choose a printer')
                    }
                  }}
                >
                  Choose printer
                </button>
              ) : null}
            </>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void printPaper()}>
            Print on paper
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" onClick={() => void savePdf()}>
              Save PDF
            </button>
            <button type="button" className="btn flex-1" onClick={() => void share()}>
              Share
            </button>
          </div>
          <button type="button" className="btn" onClick={() => setPrintOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
