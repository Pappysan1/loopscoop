import { Camera, ClipboardPaste, ImagePlus } from 'lucide-react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { diag } from '../../lib/diag/log'
import { useStudio } from '../../lib/studio-store'

const SAMPLES = [
  { src: '/samples/cat.jpg', label: 'Ginger cat' },
  { src: '/samples/cat-portrait.jpg', label: 'Portrait (tall cat)' },
  { src: '/samples/peony.jpg', label: 'Coral peony' },
  { src: '/samples/monarch-wide.jpg', label: 'Wide shot (wide monarch)' },
]

export async function loadImageFromFile(file: File) {
  if (!file || file.size === 0) {
    throw new Error('That file is not an image.')
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('That photo is too large — try one under 25 MB.')
  }
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('That file is not an image.')
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await (img.decode?.() ??
      new Promise<void>((res, rej) => {
        img.addEventListener('load', () => res())
        img.addEventListener('error', () => rej(new Error('That file is not an image.')))
      }))
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('That image has no pixels to stitch.')
    }
    return { img, url }
  } catch (err) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
    throw err instanceof Error ? err : new Error('That file is not an image.')
  }
}

async function loadUrl(src: string, name: string) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  await (img.decode?.() ??
    new Promise<void>((res, rej) => {
      img.addEventListener('load', () => res())
      img.addEventListener('error', () => rej(new Error('Could not load that sample.')))
    }))
  return { img, name }
}

export function Uploader() {
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const setPhoto = useStudio((s) => s.setPhoto)
  const setLastError = useStudio((s) => s.setLastError)
  const ready = useStudio((s) => s.ready)

  async function takeFile(file: File) {
    try {
      const { img, url } = await loadImageFromFile(file)
      setPhoto(img, url, file.name || 'photo')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'That file is not an image.'
      diag.warn('uploader', msg, { error: err })
      setLastError(msg)
      toast.error(msg)
    }
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (!type) continue
        const blob = await item.getType(type)
        await takeFile(new File([blob], 'pasted.png', { type: blob.type }))
        return
      }
      toast.error('No image on the clipboard.')
    } catch (err) {
      diag.warn('uploader', 'Clipboard paste failed', { error: err })
      toast.error('Could not read the clipboard.')
    }
  }

  if (!ready) return <div className="h-40 rounded-xl border border-line bg-paper" />

  return (
    <div
      className="rounded-xl border border-dashed border-wood bg-paper p-4"
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={(e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) void takeFile(file)
      }}
    >
      <p className="font-display text-lg">Add a photo</p>
      <p className="mt-1 text-sm text-muted">Upload, camera, paste, or drop. Photos stay on this device.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={18} /> Upload photo
        </button>
        <button type="button" className="btn" onClick={() => camRef.current?.click()}>
          <Camera size={18} /> Camera
        </button>
        <button type="button" className="btn" onClick={() => void pasteImage()}>
          <ClipboardPaste size={18} /> Paste
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void takeFile(f)
          e.target.value = ''
        }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void takeFile(f)
          e.target.value = ''
        }}
      />
      <div className="mt-4 grid grid-cols-2 gap-2">
        {SAMPLES.map((s) => (
          <button
            key={s.src}
            type="button"
            className="overflow-hidden rounded-lg border border-line text-left"
            onClick={async () => {
              try {
                const { img, name } = await loadUrl(s.src, s.label)
                setPhoto(img, null, name)
              } catch (err) {
                diag.warn('uploader', 'Sample failed', { error: err })
                toast.error('Could not load that sample.')
              }
            }}
          >
            <img src={s.src} alt={s.label} className="h-20 w-full object-cover" />
            <span className="block px-2 py-1 text-xs text-muted">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
