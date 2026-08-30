## Security Audit: Loop Scoop

**Target:** `C:\Users\User\Desktop\Projects\LoopScoop`  
**Date:** 2026-08-29  
**Scope:** file upload / object URLs / canvas taint; localStorage settings + diag export; Web Bluetooth; print iframe / blob URLs; XSS via photo name in PDF text. No auth/db is by design and is not a finding.

### Summary

Loop Scoop is a client-only embroidery studio. Photos live in memory as blob object URLs; settings persist without image bytes; there is no account system or server-side photo store. That architecture is correct.

**Reviewed and not filed as vulnerabilities**

- **No auth / no database.** Intentional. Not a finding.
- **Canvas taint.** User files are loaded with `URL.createObjectURL` (same-origin blobs). Sample images set `crossOrigin = 'anonymous'` and load same-origin `/samples/*`. `getImageData` / `toBlob` failures are caught and abort the stitch/export instead of throwing through the UI (`src/lib/stitch/build-pattern.ts`, `src/lib/print/pdf.ts`).
- **localStorage settings.** `sanitizeSettings` allowlists hoop/aida/zoom/pan/BCS/fit/palette flags only. Photo bytes, object URLs, and data URLs are never written to `loopscoop.settings`.
- **PDF text XSS via photo name.** Cover-page text goes through `pdfEscape`, which backslash-escapes `\`, `(`, and `)`. That prevents breaking out of a PDF literal string into `/JS` or extra objects. No DOM sink renders `sourceName` as HTML (React text only; download names go through `slug()`).
- **Web Bluetooth is GATT, not fake classic SPP.** Nordic UART / Phomemo / `0x18f0` optional services are the right shape. `requestDevice` is only reached from click handlers (`PrintSheet` buttons), so the Chrome user-gesture requirement is met.

**Open issues** are concentrated in Bluetooth device selection and payload encoding, print-iframe blob lifetime, diag export fail-closed gaps, and the Electron shell loading the wrong dist path.

---

### Finding 1: Web Bluetooth `acceptAllDevices` plus write-any-characteristic

- **Severity**: high
- **Category**: Web Bluetooth / unauthorized device I/O
- **Location**: `src/lib/print/bluetooth.ts:33-50`, `src/lib/print/bluetooth.ts:67-84`, `src/lib/print/bluetooth.ts:124-140`, `src/components/studio/print-sheet.tsx:146-161`
- **Description**:
  `connectPrinter` calls `navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [NORDIC_UART, PHOMEMO, 0x18f0, 0xff00, 0xffe0] })`. Chrome therefore lists every nearby BLE device, not printers.

  After GATT connect, `findWriteChar` prefers Nordic RX / Phomemo `ff02`, then **falls back to the first characteristic that supports `writeWithoutResponse` or `write` on any granted service**. `writeChunks` then sends a full ESC/POS job (init, raster, **paper cut** `GS V A`).

  On later prints, `getDevices()[0]` silently reuses the first previously granted device with no name/service check and no picker. Nordic UART (`6e400001-…`) and `0xffe0` are generic serial services used by many non-printer gadgets.
- **Impact**:
  A user (or a previous “Choose printer” grant) can bind Loop Scoop to headphones, a fitness band, a BLE serial module, or a smart plug that exposes those UUIDs. Subsequent “Print to …” clicks write binary printer commands and a cut sequence to that device without another prompt. That can crash firmware, drop the BLE link, or pulse accessories. This is not classic SPP spoofing; it is over-broad GATT access.
- **Reproduction**:
  1. Chrome on Windows/Android with Web Bluetooth. Have any non-printer Nordic-UART device advertising.
  2. Load a photo, open **Print pattern**.
  3. Click **Connect Bluetooth printer**. The chooser lists all BLE devices.
  4. Select the non-printer. The app stores `loopscoop.printer` and writes ESC/POS including `0x1d 0x56 0x41 0x10`.
  5. Click **Print to …** again. `getDevices()[0]` reconnects to that same device with no chooser.
- **Remediation**:
  - Drop `acceptAllDevices`. Use `filters` (printer name prefixes such as `M02`, `M03`, `PeriPage`, `Printer` and/or services `[NORDIC_UART, PHOMEMO, 0x18f0]`).
  - Never fall back to “any writable characteristic”; require the known RX/FF02 UUIDs.
  - Reconnect only if the saved name/id still matches a device that actually exposes those services; otherwise call `requestDevice` again.
  - Keep `requestDevice` on a user-gesture path (already true).
- **Status**: open

---

### Finding 2: ESC/POS command injection from photo names and stitch symbols

- **Severity**: high
- **Category**: Injection (printer protocol) / photo name
- **Location**: `src/lib/print/bluetooth.ts:186-211`, `src/lib/print/pages.ts:36` (PDF is escaped; Bluetooth is not), `src/lib/stitch/symbols.ts:11`
- **Description**:
  Thermal text is encoded as:

  ```js
  const text = (s: string) => {
    for (const ch of s) parts.push(ch.charCodeAt(0) & 0x7f)
    parts.push(10)
  }
  text((pattern.sourceName || 'pattern').slice(0, 32))
  ```

  The 7-bit mask **keeps ESC (`0x1b`) and GS (`0x1d`)** and also folds many Unicode letters onto those bytes. `ě` (U+011B, common in Czech/Slovak names) is `283 & 0x7f = 27 = ESC`. The realistic filename `Štěpán.jpg` becomes `` `t `` + **ESC p** + `an…`. `ESC p` is the ESC/POS **cash-drawer kick**. `ESC @` reinitializes the printer.

  The floss-key dump is also unfiltered. Default palette size is 16 colors; symbol index 10 is `★` (U+2605), and `9733 & 0x7f = 0x05` (ENQ). Every Bluetooth print of an 11+ color pattern injects a control character into the key section even when the filename is harmless.
- **Impact**:
  A normal family photo name can reset the printer mid-job, cut paper, or pulse a cash drawer on receipt hardware (Phomemo-class devices share this command set). Job content after the name is interpreted as command arguments. This is not PDF XSS (that path is escaped); it is live hardware command injection from `file.name`.
- **Reproduction**:
  1. Rename any JPEG to `Štěpán.jpg` (or insert U+001B in the name on NTFS).
  2. Upload it, wait for the pattern, open **Print pattern**.
  3. Print to a thermal over Bluetooth while sniffing the GATT write payload (or watch a receipt printer).
  4. Observe `0x1b 0x70` (`ESC p`) in the text section before the raster.
  5. Optional: 16-color pattern with a tame name still emits `0x05` from `★` in the key lines.
- **Remediation**:
  - Restrict Bluetooth text to printable ASCII (`0x20–0x7e`), replacing everything else with `?` or transliterating.
  - Do not 7-bit-mask Unicode; if a character is not ASCII, drop it.
  - Apply the same filter to symbols (map `★`/`●`/etc. to ASCII stand-ins such as `*`/`o`).
  - Keep `pdfEscape` for PDF; add an adversarial test with `ě`, `)`, `\`, and `ESC`.
- **Status**: open

---

### Finding 3: Unsandboxed print iframe + blob URL that can outlive the sheet

- **Severity**: medium
- **Category**: Print iframe / blob URLs / photo leftover
- **Location**: `src/components/studio/print-sheet.tsx:62-98`
- **Description**:
  **Print on paper** does `URL.createObjectURL(pdf)` and assigns it to a new `iframe.src`. The blob type is `application/pdf` (good) and the bytes are checked for `%PDF-1.4` in `buildPatternPdf` (good). The iframe is then appended to **`document.body`**, not the React tree, with **no `sandbox`**, no `referrerPolicy`, and no timeout.

  `revokeObjectURL` and `iframe.remove()` run only from `iframe.onload` → `afterprint` / `focus`. If `onload` never fires (common for PDF plugins), or the user hits **Close** before load, the iframe stays in the document with a live same-origin blob URL of the hoop JPEG + chart (the user’s photo, quantized). Closing `PrintSheet` returns `null` and does not walk `document.body` for leftover frames.
- **Impact**:
  A same-origin blob iframe is a classic XSS primitive if the MIME is ever sniffed as HTML. Today the encoder prefixes `%PDF-1.4` and sets `application/pdf`, so script execution is unlikely in current Chrome — but the frame is still an unsandboxed, undocumented copy of the pattern PDF. That PDF contains the photo-derived JPEG. It can remain reachable at `blob:http(s)://<origin>/<uuid>` until reload.
- **Reproduction**:
  1. Upload a photo, open **Print pattern**, wait until Save PDF works (blob ready).
  2. Click **Print on paper**.
  3. Immediately click **Close** (or block the PDF plugin so `load` never fires).
  4. In DevTools: `document.querySelectorAll('iframe')` still shows a 0×0 frame whose `src` is `blob:…` holding the pattern PDF.
  5. `URL.revokeObjectURL` was never called for that URL.
- **Remediation**:
  - Prefer `iframe.srcdoc` is wrong here; keep a PDF blob but set `sandbox=""` (or `allow-modals` only if `print()` requires it) and `src` via `blob:` after confirming `blob.type === 'application/pdf'`.
  - Append the iframe to a ref owned by `PrintSheet` and remove/revoke in the effect cleanup and the Close handler, not only `onload`.
  - Always `revokeObjectURL` in a `finally` plus a 60s timeout.
  - Do not call `cleanup` only after `onload`.
- **Status**: open

---

### Finding 4: Diag export and structured fields can miss the photo-byte guard

- **Severity**: medium
- **Category**: Privacy / diag export / localStorage
- **Location**: `src/lib/diag/log.ts:69-75`, `src/lib/diag/log.ts:87-91`, `src/lib/diag/log.ts:125-126`, `src/lib/diag/log.ts:250-269`, `src/lib/diag/install.ts:21-38`, `src/components/studio/diag-panel.tsx:71-77`, `src/lib/studio-store.ts:157`
- **Description**:
  Settings persistence is clean (`sanitizeSettings` / `loopscoop.settings`). Diag is not fully fail-closed.

  - `scrub()` only rewrites lowercase `data:image/<type>;base64,…` and `blob:` tokens in **message/stack**. It misses `DATA:IMAGE…`, `data:image/svg+xml,…` (no `;base64`), and any image payload sitting in **structured fields**.
  - `setDiagContext({ pattern: { sourceName } })` copies the raw file name onto every later event. `sourceName` is **not** passed through `scrub`, and `loadPersisted` restores `settings` / `pattern` as raw objects.
  - `exportDiagJson` refuses the download if the string matches `/data:image|blob:/` (good fail-closed). **`exportDiagText` and Copy do not run that check.**
  - `installDiag` maps `console.error` / `console.warn` arguments with `String(...)` into the ring and localStorage (`loopscoop.diag`, 100 events).
- **Impact**:
  A file named with a data-URL prefix, an uppercase data URL in a console/stack, or an SVG data URL can land in `loopscoop.diag` and in **Export text** / **Copy**. JSON export will refuse (DoS of the JSON path, not a leak). Messages are capped at 2000 chars so a full photo cannot persist that way, but a prefix of a data URL (or a blob URL) can leave the machine in a shareable log. The product rule is that diag export must **never** include photo bytes, data URLs, or blobs.
- **Reproduction**:
  1. In DevTools: `console.error('DATA:IMAGE/PNG;BASE64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')`.
  2. Open **Dev log** → **Export text** or **Copy**. The base64 is present; JSON export may also contain it because the refuse regex is case-sensitive (`data:image` only).
  3. Upload a file whose name is `blob:http://evil/123.png` (allowed on macOS/Linux). JSON export returns `{ "error": "refused to export: image data leaked" }`; the name is already in `localStorage['loopscoop.diag']`.
- **Remediation**:
  - Scrub every string field (`message`, `stack`, `action`, `sourceName`, `userAgent`) with a case-insensitive rule covering `data:image`, `data:*;base64`, and `blob:`.
  - Run the same refuse check in `exportDiagText` (and Copy).
  - Never attach raw `sourceName`; store a sanitized basename (same `slug()` as downloads).
  - Stop persisting console hooks, or scrub before `String(args)`.
- **Status**: open

---

### Finding 5: Electron shell loads `127.0.0.1:3000` with preload and no navigation lock

- **Severity**: medium
- **Category**: Electron packaging / navigation / IPC
- **Location**: `electron/main.mjs:28-55`, `electron/preload.mjs:1-10`
- **Description**:
  The BrowserWindow uses `contextIsolation: true` and `nodeIntegration: false` (good) but:

  - Looks for `dist/index.html`. The Vite/TanStack build emits `dist/client/` (`_shell.html` + assets). That file does not exist, so the window **always** `loadURL('http://127.0.0.1:3000')`.
  - Preload still injects `electronLoopScoop` and `electronDiagAppend` into whatever document loads.
  - There is no `will-navigate`, `will-attach-webview`, or `setWindowOpenHandler` handler.
  - `ipcMain.on('diag:append', (_e, event) => appendDiag(event))` JSON-serializes the renderer object to `%APPDATA%/…/diag/loopscoop-diag.jsonl` with no size/shape check.

  Capacitor is configured with `webDir: 'dist/client'` (correct). The Electron path is not.
- **Impact**:
  Any process bound to port 3000 (dev server, malware, another app) becomes the desktop UI, with the ability to append arbitrary JSON lines under the user-data directory until disk fills. If that page navigates off-origin, Electron still injects the same preload into the new document unless navigation is blocked.
- **Reproduction**:
  1. Confirm `dist/index.html` is missing and `dist/client/_shell.html` exists.
  2. Run `npm run electron:dev` / portable exe with nothing on 3000 → blank window; with `npm run dev` → app loads from the dev server.
  3. Serve hostile HTML on `127.0.0.1:3000` that calls `window.electronDiagAppend({ huge: 'x'.repeat(1e7) })`. Watch `userData/diag/loopscoop-diag.jsonl` grow.
- **Remediation**:
  - Load `dist/client/index.html` or `_shell.html` via `loadFile`, never a fallback TCP URL in production.
  - `sandbox: true`, deny `will-navigate` except that file URL, `setWindowOpenHandler: deny`.
  - Validate IPC: cap payload size, allowlist keys, ignore non-file senders.
- **Status**: open

---

### Finding 6: File accept path allows empty MIME and SVG

- **Severity**: low
- **Category**: File upload / object URLs
- **Location**: `src/components/studio/uploader.tsx:14-36`, `src/components/studio/uploader.tsx:100-107`
- **Description**:
  `loadImageFromFile` rejects typed non-images (`file.type && !file.type.startsWith('image/')`) but **allows `file.type === ''`**. Drag-and-drop uses `dataTransfer.files[0]` with the same helper. `image/svg+xml` is accepted. Decode uses `new Image()` + blob URL; scripts inside SVG do not run in `<img>`, and same-origin blobs should not taint the canvas.

  There is no magic-byte check (JPEG/PNG/WebP/GIF). A 25 MB cap is the only size guard; SVG `width`/`height` can still decode to a huge bitmap before `buildPattern` downscales the long edge to 960.
- **Impact**:
  Not DOM XSS with the current `Image()` sink. Residual risk is decoder DoS (huge SVG/bitmap) and accidentally treating non-image polyglots as photos. Empty MIME is the bypass for the type check.
- **Reproduction**:
  1. Drop a `.bin` whose OS-reported MIME is empty — the type check does not throw; failure happens only if `decode()` errors.
  2. Upload `image/svg+xml` with `width="100000" height="100000"` and watch decode/memory before stitch.
- **Remediation**:
  - Require `file.type.startsWith('image/')` (no empty bypass) and/or sniff `ffd8ff` / `89504e47` / `52494646` / `47494638` / `57454250`.
  - Block `image/svg+xml` (and `image/xml+svg`).
  - Cap `naturalWidth * naturalHeight` after decode (e.g. 40 MPx) before canvas draw.
- **Status**: open

---

### Finding 7: PDF name sanitizer is incomplete even though string breakout is blocked

- **Severity**: low
- **Category**: XSS via photo name in PDF text (residual)
- **Location**: `src/lib/print/pdf.ts:26-28`, `src/lib/print/pdf.ts:54-56`, `src/lib/print/pages.ts:34-36`, `src/lib/print/pdf.test.ts` (no adversarial cases)
- **Description**:
  `pdfEscape` prevents `)` / `(` / `\` breakout, so a photo named `) /JS (app.alert(1)` does **not** become PDF JavaScript. That is why this is not a high XSS.

  Remaining gaps: no stripping of `NUL`/C0 controls (some native viewers are C-string based and will truncate a literal at `\x00`, leaving the tail parsed as operators); UTF-8 bytes are written into a Helvetica Type1 string (mojibake, not script); tests never feed `sourceName` with `)`, `\`, `\x00`, or `ě`.
- **Impact**:
  Practical Chrome/Edge PDF viewer XSS from a photo name was not demonstrated. A crafted name with an embedded NUL could still confuse lesser parsers. Bluetooth (Finding 2) is the exploitable name channel today.
- **Reproduction**:
  1. Upload `test)(foo\\bar.png`, Save PDF, inspect the content stream: the name is `\(\)`-escaped inside `(…)`.
  2. There is no test covering that. A name containing `\x00) Tj` is not rejected.
- **Remediation**:
  - After `pdfEscape`, drop non-WinAnsi characters and all controls (`[\x00-\x1f\x7f]`).
  - Add a unit test: `buildPdf` + a name of `Hello) /JS (app.alert(1)`; assert the content stream still has a single literal and no `/JS`.
- **Status**: open

---

### Notes (not findings)

| Topic | Result |
|-------|--------|
| Auth / backend / DB | None. Client-only. Correct. |
| `loopscoop.settings` | Allowlisted numbers/enums only. No photo bytes. |
| Object URL revoke on replace/clear | `setPhoto` / `clearPhoto` revoke the previous blob URL. |
| Sample photos | Same-origin + `crossOrigin = 'anonymous'`. |
| Download filenames | `slug()` strips to `[a-z0-9-]`. |
| `npm run dev --host 0.0.0.0` | Intentional LAN preview; each browser has its own in-memory photo. |
| CSP | None set. Low value while there are no HTML sinks; still worth a strict CSP as defense in depth. |
