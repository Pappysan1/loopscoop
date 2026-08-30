import { describe, expect, it } from 'vitest'
import { buildPdf, pdfBlob } from './pdf'

describe('pdf encoder', () => {
  it('writes a %PDF-1.4 header and a real ArrayBuffer blob', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const bytes = buildPdf([
      {
        images: [{ width: 2, height: 2, jpeg, x: 40, y: 40, w: 200, h: 200 }],
        texts: [{ x: 40, y: 760, size: 12, text: 'Loop Scoop' }],
      },
    ])
    const header = String.fromCharCode(...bytes.slice(0, 8))
    expect(header).toBe('%PDF-1.4')
    const blob = pdfBlob(bytes)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBe(bytes.byteLength)
  })
})
