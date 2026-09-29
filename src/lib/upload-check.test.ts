import { describe, expect, it } from 'vitest'
import { checkDecodedSize, checkUploadFile, MAX_UPLOAD_BYTES, sniffImageType } from './upload-check'

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]
const bytes = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
const GIF = bytes('GIF89a\x01\x00\x01\x00')
const WEBP = [...bytes('RIFF'), 0x24, 0, 0, 0, ...bytes('WEBPVP8 ')]
const AVIF = [0, 0, 0, 0x1c, ...bytes('ftypavif'), 0, 0, 0, 0]
const HEIC = [0, 0, 0, 0x18, ...bytes('ftypheic'), 0, 0, 0, 0]
const SVG = bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

const blob = (arr: number[], type = '') => new Blob([new Uint8Array(arr)], { type })

describe('sniffImageType', () => {
  it('recognizes real image headers', () => {
    expect(sniffImageType(new Uint8Array(JPEG))).toBe('jpeg')
    expect(sniffImageType(new Uint8Array(PNG))).toBe('png')
    expect(sniffImageType(new Uint8Array(GIF))).toBe('gif')
    expect(sniffImageType(new Uint8Array(WEBP))).toBe('webp')
    expect(sniffImageType(new Uint8Array(AVIF))).toBe('avif')
    expect(sniffImageType(new Uint8Array(HEIC))).toBe('heic')
  })

  it('rejects SVG, text, and truncated headers', () => {
    expect(sniffImageType(new Uint8Array(SVG))).toBeNull()
    expect(sniffImageType(new Uint8Array(bytes('hello world')))).toBeNull()
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull()
    expect(sniffImageType(new Uint8Array([]))).toBeNull()
  })
})

describe('checkUploadFile (audit finding 6)', () => {
  it('accepts a real JPEG even when the MIME type is empty (pasted blobs)', async () => {
    await expect(checkUploadFile(blob(JPEG))).resolves.toBe('jpeg')
  })

  it('refuses an SVG with an empty or disguised MIME type', async () => {
    await expect(checkUploadFile(blob(SVG))).rejects.toThrow('not an image')
    await expect(checkUploadFile(blob(SVG, 'image/png'))).rejects.toThrow('not an image')
    await expect(checkUploadFile(blob(PNG, 'image/xml+svg'))).rejects.toThrow('not an image')
    await expect(checkUploadFile(blob(PNG, 'image/SVG+XML'))).rejects.toThrow('not an image')
  })

  it('refuses non-image MIME types, empty files, and oversize files', async () => {
    await expect(checkUploadFile(blob(PNG, 'text/plain'))).rejects.toThrow('not an image')
    await expect(checkUploadFile(blob([]))).rejects.toThrow('not an image')
    await expect(checkUploadFile(null)).rejects.toThrow('not an image')
    const big = { size: MAX_UPLOAD_BYTES + 1, type: 'image/jpeg', slice: () => blob(JPEG) } as unknown as Blob
    await expect(checkUploadFile(big)).rejects.toThrow('under 25 MB')
  })

  it('lets HEIC through so Safari on iPhone can decode it', async () => {
    await expect(checkUploadFile(blob(HEIC, 'image/heic'))).resolves.toBe('heic')
  })
})

describe('checkDecodedSize', () => {
  it('refuses zero-pixel and over-50-megapixel images, but allows 48 MP iPhone shots', () => {
    expect(() => checkDecodedSize(0, 100)).toThrow('no pixels')
    expect(() => checkDecodedSize(8064, 6048)).not.toThrow()
    expect(() => checkDecodedSize(10000, 5100)).toThrow('megapixels')
  })
})
