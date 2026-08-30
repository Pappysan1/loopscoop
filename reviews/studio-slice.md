# Studio slice review — Loop Scoop

Review of the client-only embroidery studio against `C:\Users\User\Downloads\Loop-Scoop-Grok-Build-Prompt.txt`. Product source was not modified.

Focus: `src/lib/diag/*`, `src/lib/studio-store.ts`, `src/lib/stitch/*`, `src/lib/print/*`, `src/components/studio/*`, and the spec crash rules.

## Summary

Crash hardening is mostly in place. `sanitizeSettings` recovers poison/NaN storage to 6" / 14ct / zoom 1 and is applied on every read and patch. Quantize with 0 samples returns `assign => -1`. Fit uses the long edge and fill the short edge. The hoop grid skips cells outside the circle and outside the image. Pattern build guards `getContext` / `drawImage` / `getImageData`. PDF bytes start with `%PDF-1.4` and `pdfBlob` copies into a real `ArrayBuffer`. Missing Web Bluetooth throws the Chrome/phone message instead of crashing. Uploader file inputs and control sliders wait for `ready`. `.btn` is 44px. Component JSX does not hard-code palette hex (floss swatches use `c.hex`; canvas paint is not JSX).

It is **not ship-clean**. Drag pan drops most movement between React renders. PDF leftover chart tiles are padded to a square of empty cells instead of growing leftover strips. Thermal jobs never embed a symbol-chart raster when `size <= 56`. Print-on-paper has no “plugin never loaded” fallback and can revoke the blob on `focus`. The React crash screen cannot actually show the diagnostic log, and the log panel goes stale while open.

## Issues

### Issue 1 -- Severity: bug
- **File**: src/components/studio/hoop-preview.tsx:61
- **Description**: Pointer-move pan applies `dx`/`dy` to `settings.panX` / `settings.panY` from the last React render, while `last.current` advances every event. Several `pointermove` events fire before Zustand/React re-renders, so each event overwrites pan with *base + last micro-delta* instead of accumulating. Live `renderHoop` uses the same stale base (`settings.panX - dx` at line 74). Drag-to-reframe feels stuck or jumpy, especially on a phone.
- **Suggestion**: Keep pan in a ref during the gesture (or read `useStudio.getState().settings`) and `patch` from that running value. Clamp remains in `sanitizeSettings`.
- **Status**: fixed

### Issue 2 -- Severity: bug
- **File**: src/lib/print/pages.ts:63
- **Description**: Leftover chart tiles set `slice.size = Math.max(leftoverC, leftoverR)` and copy the real region into a square `Int16Array`, leaving the extra cells at `-1`. `renderChart` then draws that full square. A 4" 14ct pattern (`n = 56`) has ~43-wide tiles, so the last column is 13×50 and prints as a 50×50 grid with 37 empty columns. Cell growth at lines 58–61 also uses `min(growC, growR)`, so a skinny leftover column cannot grow when the other axis is a full row. Spec: last/partial tiles should grow cells up to ~42px so leftover columns are not a skinny strip — not pad with empty stitches. Header range (`Columns col0+1–col1`) then disagrees with the grid.
- **Suggestion**: Keep `slice.size` equal to the leftover rectangle (or pass explicit `cols`/`rows` into `renderChart`). Grow cell size from the leftover dimension alone, capped at 42. Do not square-pad with `-1`.
- **Status**: fixed

### Issue 3 -- Severity: bug
- **File**: src/lib/print/bluetooth.ts:216
- **Description**: Spec: include the symbol-chart raster only if `pattern.size <= 56`, otherwise tell the user to use Print on paper. `printPatternBluetooth` computes `includeChart`, but `escPosJob` never rasterizes a chart. When `includeChart` is true it only skips the fallback sentence (line 209). Small hoops on a thermal printer get hoop + ASCII key, no chart.
- **Suggestion**: When `includeChart` is true, dither a chart canvas (same 384px Floyd–Steinberg path) and append those GS v 0 bands. Keep the paper fallback text for `size > 56`.
- **Status**: fixed

### Issue 4 -- Severity: bug
- **File**: src/components/studio/print-sheet.tsx:83
- **Description**: Print on paper iframes the PDF and calls `print()` only in `iframe.onload`. Spec: if the plugin never loads, download the PDF and toast “PDF saved — open it and pick your printer”. There is no such fallback; Safari/Android often never fire `onload` for blob PDFs, so the button appears to do nothing. After a successful `print()`, `focus` is also used for cleanup (line 88). `iframe.contentWindow?.focus()` or the print UI can fire `focus` while the OS dialog is still open, then `cleanup` revokes the blob URL and removes the iframe — the spec says not to kill the job while the dialog is open.
- **Suggestion**: On `onload` failure / missing plugin, download + toast. Clean up on `afterprint` (listen *before* `print()`). Do not revoke the blob on generic `window` `focus`.
- **Status**: fixed

### Issue 5 -- Severity: bug
- **File**: src/lib/diag/boundary.tsx:26
- **Description**: “Open log” calls `onOpenLog` → `useStudio.getState().setDiagOpen(true)` (`src/routes/__root.tsx:35`). `DiagPanel` lives inside `Studio` (`src/components/studio/studio.tsx:125`), which unmounts when the boundary replaces `Outlet`. After a React crash the button sets a flag nothing reads.
- **Suggestion**: Mount `DiagPanel` next to the boundary (root) so it survives `Studio` dying, or render a log list in the fallback UI from `getDiagEvents()`.
- **Status**: fixed

### Issue 6 -- Severity: bug
- **File**: src/components/studio/diag-panel.tsx:24
- **Description**: `const [, bump] = useState(0)` discards the tick. `useMemo` depends on `[level, open, bump]` — `bump` is the stable setter. `subscribeDiag` re-renders, but `useMemo` returns the cached list, so new events do not appear while the panel is open. Filter/open changes are the only refresh.
- **Suggestion**: Depend on the tick value (`const [tick, bump] = useState(0)` → `[level, open, tick]`), or call `getDiagEvents()` during render and skip `useMemo`.
- **Status**: fixed

### Issue 7 -- Severity: suggestion
- **File**: src/components/studio/hoop-preview.tsx:81
- **Description**: Only `onPointerUp` clears `dragging.current`. There is no `onPointerCancel`. If the browser cancels the pointer (touch interrupt, system gesture) after a pan, `dragging` stays true. The render effect uses `dragging.current` for `livePhoto`, so later pattern rebuilds can keep showing the photo instead of X-stitches.
- **Suggestion**: Handle `onPointerCancel` / `onPointerUp` together: `dragging.current = false` and redraw the hoop with the current pattern (not live photo).
- **Status**: fixed

### Issue 8 -- Severity: suggestion
- **File**: src/lib/print/bluetooth.ts:152
- **Description**: Crash rule: guard every `drawImage` / `getImageData`. `dither384` calls both unguarded. A 0-width source makes `h` NaN/0 and `getImageData` throws `IndexSizeError`. `printPatternBluetooth` does not catch it; the print-sheet click handler will toast, so it is not a full app crash, but it violates the canvas crash rule and skips the friendly Bluetooth errors.
- **Suggestion**: try/catch `drawImage`/`getImageData`, treat 0-size canvases as `null`, and let `escPosJob` print the text key without a raster.
- **Status**: fixed

### Issue 9 -- Severity: suggestion
- **File**: src/components/studio/print-sheet.tsx:112
- **Description**: Spec Share: `navigator.share` the PDF when `canShare({ files })`, otherwise share hoop/chart/key PNGs. Failure/unsupported path toasts and `savePdf()` instead. Browsers that can share images but not PDF files never get the PNG path.
- **Suggestion**: If `canShare({ files: [pdf] })` is false, `canShare` the three PNG blobs from the thumb canvases (or rendered copies) and share those.
- **Status**: fixed

### Issue 10 -- Severity: suggestion
- **File**: src/components/studio/print-sheet.tsx:151
- **Description**: Bluetooth print prefers `hoopRef` (rendered at `cssSize: 240`) and only renders a 384px hoop when the ref is missing. Spec job is a dithered 384px hoop raster. Upscaling the 240px thumb to 384 in `dither384` softens the thermal print.
- **Suggestion**: Always `renderHoop` to an offscreen canvas at `cssSize: 384` (dpr 1) for the ESC/POS job.
- **Status**: fixed

### Issue 11 -- Severity: suggestion
- **File**: src/lib/stitch/types.ts:64
- **Description**: Crash rule: never call `TypedArray` with NaN from corrupt storage. `stitchCount` is `Math.min(180, Math.max(24, Math.round(hoop * aida)))`. `Math.max(24, NaN)` is `NaN`, and `new Int16Array(NaN)` in `build-pattern.ts:75` throws. The live store always sanitizes hoop/Aida first, so this is latent unless `buildPattern` is called with raw input.
- **Suggestion**: If `!Number.isFinite(n)` return 24 (or reuse `clamp`). Same guard before `new Int16Array(n * n)`.
- **Status**: fixed

### Issue 12 -- Severity: nit
- **File**: src/routes/__root.tsx:18
- **Description**: Spec: no raw hex in JSX. The only match in `src/**/*.tsx` is `{ name: 'theme-color', content: '#3f5344' }`. Floss swatches correctly use `c.hex`.
- **Suggestion**: Use the pine token if the HTML meta pipeline can see it; otherwise leave it — `theme-color` needs a concrete color.
- **Status**: fixed

### Issue 13 -- Severity: nit
- **File**: src/lib/stitch/render-chart.ts:36
- **Description**: 10-count labels print `i + 1` when `i % 10 === 0`, so 1, 11, 21… rather than the usual 10, 20, 30. Heavy lines every 10 (line 80) are correct.
- **Suggestion**: Number 10, 20, … and the last column/row, matching printed stitch charts.
- **Status**: fixed
