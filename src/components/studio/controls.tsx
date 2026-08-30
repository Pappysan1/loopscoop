import { AIDA_COUNTS, HOOP_INCHES } from '../../lib/stitch/types'
import { useStudio } from '../../lib/studio-store'

export function Controls() {
  const ready = useStudio((s) => s.ready)
  const settings = useStudio((s) => s.settings)
  const image = useStudio((s) => s.image)
  const patch = useStudio((s) => s.patch)
  const setFitMode = useStudio((s) => s.setFitMode)
  const dim = !image

  if (!ready) return <div className="h-72 rounded-xl border border-line bg-paper" />

  return (
    <div className={`rounded-xl border border-line bg-paper p-4 ${dim ? 'opacity-60' : ''}`}>
      <h2 className="font-display text-lg">Pattern</h2>
      <fieldset className="mt-3">
        <legend className="text-sm text-muted">Hoop</legend>
        <div className="mt-1 flex flex-wrap gap-1">
          {HOOP_INCHES.map((h) => (
            <button
              key={h}
              type="button"
              className={`btn ${settings.hoopInches === h ? 'btn-primary' : ''}`}
              onClick={() => patch({ hoopInches: h })}
            >
              {h}"
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="text-sm text-muted">Photo in hoop</legend>
        <div className="mt-1 flex gap-1">
          <button type="button" className={`btn ${settings.fitMode === 'fit' ? 'btn-primary' : ''}`} onClick={() => setFitMode('fit')}>
            Fit whole
          </button>
          <button type="button" className={`btn ${settings.fitMode === 'fill' ? 'btn-primary' : ''}`} onClick={() => setFitMode('fill')}>
            Fill hoop
          </button>
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="text-sm text-muted">Aida</legend>
        <div className="mt-1 flex flex-wrap gap-1">
          {AIDA_COUNTS.map((a) => (
            <button
              key={a}
              type="button"
              className={`btn ${settings.aidaCount === a ? 'btn-primary' : ''}`}
              onClick={() => patch({ aidaCount: a })}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mt-3 block text-sm text-muted">
        Floss colors {settings.colorCount}
        <input
          type="range"
          min={6}
          max={32}
          value={settings.colorCount}
          className="mt-1 w-full accent-pine"
          onChange={(e) => patch({ colorCount: Number(e.target.value) })}
        />
      </label>
      <fieldset className="mt-3">
        <legend className="text-sm text-muted">Palette</legend>
        <div className="mt-1 flex gap-1">
          <button
            type="button"
            className={`btn ${settings.paletteMode === 'dmc' ? 'btn-primary' : ''}`}
            onClick={() => patch({ paletteMode: 'dmc' })}
          >
            DMC floss
          </button>
          <button
            type="button"
            className={`btn ${settings.paletteMode === 'photo' ? 'btn-primary' : ''}`}
            onClick={() => patch({ paletteMode: 'photo' })}
          >
            Photo colors
          </button>
        </div>
      </fieldset>
      <label className="mt-3 block text-sm text-muted">
        Scale {settings.zoom.toFixed(2)}
        <input
          type="range"
          min={0.6}
          max={3}
          step={0.05}
          value={settings.zoom}
          className="mt-1 w-full accent-pine"
          onChange={(e) => patch({ zoom: Number(e.target.value) })}
        />
      </label>
      <label className="mt-3 block text-sm text-muted">
        Brightness
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.02}
          value={settings.brightness}
          className="mt-1 w-full accent-pine"
          onChange={(e) => patch({ brightness: Number(e.target.value) })}
        />
      </label>
      <label className="mt-3 block text-sm text-muted">
        Contrast
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.02}
          value={settings.contrast}
          className="mt-1 w-full accent-pine"
          onChange={(e) => patch({ contrast: Number(e.target.value) })}
        />
      </label>
      <label className="mt-3 block text-sm text-muted">
        Saturation
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.02}
          value={settings.saturation}
          className="mt-1 w-full accent-pine"
          onChange={(e) => patch({ saturation: Number(e.target.value) })}
        />
      </label>
      <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.knockOutBackground}
          onChange={(e) => patch({ knockOutBackground: e.target.checked })}
        />
        Skip light background
      </label>
    </div>
  )
}
