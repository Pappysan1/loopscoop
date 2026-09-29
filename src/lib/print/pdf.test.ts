import { describe, expect, it } from 'vitest'
import { buildPdf, pdfBlob, pdfEscape } from './pdf'

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

describe('pdf text encoding (audit finding 7)', () => {
  const textBytes = (text: string) =>
    buildPdf([{ images: [], texts: [{ x: 40, y: 760, size: 12, text }] }])
  const latin = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('')

  it('writes our own separators as single WinAnsi bytes, not UTF-8', () => {
    const s = latin(textBytes('6" hoop · 14-count · Columns 1–41'))
    expect(s).toContain('(6" hoop \xB7 14-count \xB7 Columns 1\x9641) Tj')
    expect(s).not.toContain('\xC2\xB7')
    expect(s).toContain('/Encoding /WinAnsiEncoding')
  })

  it('keeps accented names and replaces what Helvetica cannot draw', () => {
    expect(pdfEscape('Café 🌸 猫')).toBe('Caf\xE9 ? ?')
  })

  it('neutralises hostile photo names', () => {
    const s = latin(textBytes('x) Tj ET BT (\\evil\u0000\n'))
    expect(s).toContain('(x\\) Tj ET BT \\(\\\\evil  ) Tj')
  })

  it('never leaves a dangling backslash when clipping a long name', () => {
    const out = pdfEscape(`${'a'.repeat(179)}(((`)
    expect(out).toBe(`${'a'.repeat(179)}\\(`)
    expect(out.endsWith('\\')).toBe(false)
  })

  it('keeps the binary marker as raw high bytes', () => {
    const b = textBytes('x')
    expect(Array.from(b.slice(10, 14))).toEqual([0xe2, 0xe3, 0xcf, 0xd3])
  })
})
