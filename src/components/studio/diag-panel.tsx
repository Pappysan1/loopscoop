import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  clearDiag,
  diagCount,
  exportDiagJson,
  exportDiagText,
  getDiagEvents,
  subscribeDiag,
  type DiagLevel,
} from '../../lib/diag/log'

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function DiagPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, bump] = useState(0)
  const [level, setLevel] = useState<DiagLevel | 'all'>('all')
  useEffect(() => subscribeDiag(() => bump((n) => n + 1)), [])
  const events = useMemo(() => {
    const all = getDiagEvents()
    return level === 'all' ? all : all.filter((e) => e.level === level)
  }, [level, open, bump])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg">Dev log ({diagCount()})</h2>
          <button type="button" className="btn" onClick={onClose} aria-label="Close log">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-2">
          {(['all', 'fatal', 'error', 'warn', 'info'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`btn ${level === l ? 'btn-primary' : ''}`}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-5 text-ink">
          {events.length === 0 ? (
            <p className="text-muted">Nothing logged yet.</p>
          ) : (
            events.map((e) => (
              <div key={e.id} className="mb-3 border-b border-line pb-2">
                <div className="text-muted">
                  {e.time} · {e.level} · {e.source}
                  {e.action ? ` · ${e.action}` : ''}
                </div>
                <div>{e.message}</div>
                {e.stack ? <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-subtle">{e.stack}</pre> : null}
              </div>
            ))
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
          <button type="button" className="btn" onClick={() => download('loopscoop-diag.json', exportDiagJson(), 'application/json')}>
            Export JSON
          </button>
          <button type="button" className="btn" onClick={() => download('loopscoop-diag.txt', exportDiagText(), 'text/plain')}>
            Export text
          </button>
          <button type="button" className="btn" onClick={() => navigator.clipboard.writeText(exportDiagText())}>
            Copy
          </button>
          <button type="button" className="btn" onClick={clearDiag}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
