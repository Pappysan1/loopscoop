// Checks a picked, pasted, dropped, or camera file before the browser decodes it.
// The MIME type can be empty or wrong (pasted blobs, some Android pickers), so we
// look at the first bytes of the file itself.

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_MEGAPIXELS = 40

export type SniffedType = 'jpeg' | 'png' | 'gif' | 'webp' | 'avif' | 'bmp' | 'heic' | null

function ascii(bytes: Uint8Array, start: number, len: number) {
  let s = ''
  for (let i = start; i < start + len && i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

export function sniffImageType(bytes: Uint8Array): SniffedType {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === 'PNG' &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'png'
  const head6 = ascii(bytes, 0, 6)
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp'
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'avif'
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic'
  }
  if (bytes.length >= 14 && ascii(bytes, 0, 2) === 'BM') return 'bmp'
  return null
}

async function headBytes(file: Blob, n = 32): Promise<Uint8Array> {
  const part = file.slice(0, n)
  if (typeof part.arrayBuffer === 'function') return new Uint8Array(await part.arrayBuffer())
  return new Uint8Array(
    await new Promise<ArrayBuffer>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as ArrayBuffer)
      r.onerror = () => reject(new Error('That file is not an image.'))
      r.readAsArrayBuffer(part)
    }),
  )
}

// Throws an Error with a plain message if the file should not be decoded.
export async function checkUploadFile(file: Blob | null | undefined): Promise<SniffedType> {
  if (!file || file.size === 0) throw new Error('That file is not an image.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That photo is too large — try one under 25 MB.')
  const type = (file.type || '').toLowerCase()
  if (type && !type.startsWith('image/')) throw new Error('That file is not an image.')
  if (type.includes('svg') || type.includes('xml')) throw new Error('That file is not an image.')
  let kind: SniffedType
  try {
    kind = sniffImageType(await headBytes(file))
  } catch {
    throw new Error('That file is not an image.')
  }
  if (kind === 'heic') {
    throw new Error('iPhone-style HEIC photos can\u2019t be read here. Save it as a JPEG and try again.')
  }
  if (!kind) throw new Error('That file is not an image.')
  return kind
}

// Called after decode, before we keep the image around.
export function checkDecodedSize(width: number, height: number) {
  if (!width || !height) throw new Error('That image has no pixels to stitch.')
  if (width * height > MAX_MEGAPIXELS * 1_000_000) {
    throw new Error(`That photo is too big to work with — try one under ${MAX_MEGAPIXELS} megapixels.`)
  }
}
