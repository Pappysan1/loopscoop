import { useEffect } from 'react'
import { toast } from 'sonner'
import { diag } from '../../lib/diag/log'
import { buildPattern } from '../../lib/stitch/build-pattern'
import { currentBuildGen, nextBuildGen, useStudio } from '../../lib/studio-store'
import { ChartView } from './chart-view'
import { Controls } from './controls'
import { ExportBar } from './export-bar'
import { HoopPreview } from './hoop-preview'
import { Legend } from './legend'
import { PrintSheet } from './print-sheet'
import { ScaleReadout } from './scale-readout'
import { loadImageFromFile, Uploader } from './uploader'

export function Studio() {
  const hydrate = useStudio((s) => s.hydrate)
  const ready = useStudio((s) => s.ready)
  const image = useStudio((s) => s.image)
  const settings = useStudio((s) => s.settings)
  const sourceName = useStudio((s) => s.sourceName)
  const view = useStudio((s) => s.view)
  const setView = useStudio((s) => s.setView)
  const pattern = useStudio((s) => s.pattern)
  const setPattern = useStudio((s) => s.setPattern)
  const setBuilding = useStudio((s) => s.setBuilding)
  const setPrintOpen = useStudio((s) => s.setPrintOpen)
  const setDiagOpen = useStudio((s) => s.setDiagOpen)
  const lastError = useStudio((s) => s.lastError)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) {
        e.preventDefault()
        void loadImageFromFile(file)
          .then(({ img, url }) => useStudio.getState().setPhoto(img, url, file.name || 'pasted'))
          .catch((err) => {
            const msg = err instanceof Error ? err.message : 'That file is not an image.'
            toast.error(msg)
          })
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    if (!image || !ready) return
    const gen = nextBuildGen()
    setBuilding(true)
    const t = window.setTimeout(() => {
      try {
        const next = buildPattern(image, settings, sourceName)
        if (gen !== currentBuildGen()) return
        setPattern(next, gen)
      } catch (err) {
        diag.error('stitch', 'Pattern rebuild failed', { error: err })
        if (gen === currentBuildGen()) setPattern(null, gen)
      }
    }, 120)
    return () => window.clearTimeout(t)
  }, [image, settings, sourceName, ready, setBuilding, setPattern])

  return (
    <div className="min-h-screen bg-linen text-ink">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="h-10 w-10 rounded-lg" />
            <div>
              <h1 className="font-display text-xl leading-none">Loop Scoop</h1>
              <p className="text-sm text-muted">Any photo, scaled to your hoop</p>
            </div>
          </div>
          <p className="hidden text-sm text-muted sm:block" title="Open this address on an iPhone on the same Wi-Fi">
            Open on iPhone: {typeof window !== 'undefined' ? window.location.origin : ''}
          </p>
          <div className="flex rounded-lg border border-line p-1">
            <button type="button" className={`btn ${view === 'hoop' ? 'btn-primary' : ''}`} onClick={() => setView('hoop')}>
              Hoop
            </button>
            <button type="button" className={`btn ${view === 'chart' ? 'btn-primary' : ''}`} onClick={() => setView('chart')}>
              Chart
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0">
          {view === 'hoop' ? <HoopPreview /> : <ChartView />}
          <ScaleReadout />
          {pattern ? (
            <button type="button" className="btn btn-primary mt-3" onClick={() => setPrintOpen(true)}>
              Print pattern
            </button>
          ) : null}
          {lastError ? <p className="mt-2 text-sm text-danger">{lastError}</p> : null}
        </main>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          {!image ? <Uploader /> : null}
          <Controls />
          {pattern ? (
            <>
              <Legend />
              <ExportBar />
            </>
          ) : null}
        </aside>
      </div>

      <footer className="border-t border-line px-4 py-4 text-center text-sm text-muted">
        <p>Stitch counts and skein estimates are a guide — real coverage varies with tension and strand count.</p>
        <button type="button" className="btn mt-2" onClick={() => setDiagOpen(true)}>
          Dev log
        </button>
      </footer>
      <PrintSheet />
    </div>
  )
}
