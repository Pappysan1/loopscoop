import { useStudio } from '../../lib/studio-store'

export function Legend() {
  const pattern = useStudio((s) => s.pattern)
  const highlight = useStudio((s) => s.highlight)
  const setHighlight = useStudio((s) => s.setHighlight)
  if (!pattern) return null
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <h2 className="font-display text-lg">Floss key</h2>
      <ul className="mt-2 space-y-1">
        {pattern.colors.map((c, i) => (
          <li key={i}>
            <button
              type="button"
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left ${highlight === i ? 'bg-linen' : ''}`}
              onClick={() => setHighlight(highlight === i ? -1 : i)}
            >
              <span className="h-6 w-6 shrink-0 rounded border border-line" style={{ background: c.hex }} />
              <span className="w-6 text-center">{c.symbol}</span>
              <span className="flex-1 text-sm">
                {c.dmc ? `DMC ${c.dmc}` : c.hex} {c.name}
              </span>
              <span className="text-xs text-muted">
                {c.count.toLocaleString()} sts · {c.skeins} skein{c.skeins === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
