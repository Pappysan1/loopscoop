function concatBytes(parts: Uint8Array[]) {
  let total = 0
  for (const p of parts) total += p.length
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

const enc = new TextEncoder()

export type PdfImage = {
  width: number
  height: number
  jpeg: Uint8Array
}

export type PdfPage = {
  images: Array<PdfImage & { x: number; y: number; w: number; h: number }>
  texts: Array<{ x: number; y: number; size: number; text: string }>
}

function pdfEscape(text: string) {
  return text
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .slice(0, 180)
}

export function buildPdf(pages: PdfPage[]): Uint8Array {
  const bodies: Array<string | Uint8Array> = []
  const add = (body: string | Uint8Array) => {
    bodies.push(body)
    return bodies.length
  }

  const catalogId = add('')
  const pagesId = add('')
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n')

  const pageIds: number[] = []
  const imageIds: number[][] = pages.map((page) => page.images.map(() => 0))
  const contentIds: number[] = pages.map(() => 0)

  pages.forEach((page, pi) => {
    page.images.forEach((img, ii) => {
      const dict = enc.encode(
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n`,
      )
      const end = enc.encode('\nendstream\n')
      imageIds[pi][ii] = add(concatBytes([dict, img.jpeg, end]))
    })

    const ops: string[] = []
    for (const t of page.texts) {
      ops.push('BT', `/F1 ${t.size} Tf`, `0.11 0.10 0.09 rg`, `${t.x.toFixed(2)} ${t.y.toFixed(2)} Td`, `(${pdfEscape(t.text)}) Tj`, 'ET')
    }
    page.images.forEach((img, ii) => {
      ops.push('q', `${img.w.toFixed(2)} 0 0 ${img.h.toFixed(2)} ${img.x.toFixed(2)} ${img.y.toFixed(2)} cm`, `/Im${ii} Do`, 'Q')
    })
    const stream = enc.encode(ops.join('\n'))
    contentIds[pi] = add(
      concatBytes([enc.encode(`<< /Length ${stream.length} >>\nstream\n`), stream, enc.encode('\nendstream\n')]),
    )
    const xobjs = page.images.map((_, ii) => `/Im${ii} ${imageIds[pi][ii]} 0 R`).join(' ')
    pageIds[pi] = add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[pi]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> /XObject << ${xobjs} >> >> >>\n`,
    )
  })

  bodies[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>\n`
  bodies[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>\n`

  const header = enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const pieces: Uint8Array[] = [header]
  const offsets = [0]
  let pos = header.length
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i]
    const bytes = typeof body === 'string' ? enc.encode(body) : body
    offsets[i + 1] = pos
    const numbered = concatBytes([enc.encode(`${i + 1} 0 obj\n`), bytes, enc.encode('endobj\n')])
    pieces.push(numbered)
    pos += numbered.length
  }
  const xrefPos = pos
  const xrefLines = ['xref', `0 ${bodies.length + 1}`, '0000000000 65535 f ']
  for (let i = 1; i <= bodies.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n `)
  }
  pieces.push(enc.encode(`${xrefLines.join('\n')}\n`))
  pieces.push(enc.encode(`trailer << /Size ${bodies.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`))
  return concatBytes(pieces)
}

export function pdfBlob(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type: 'application/pdf' })
}

export async function canvasJpeg(canvas: HTMLCanvasElement, quality = 0.82): Promise<PdfImage | null> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
      } catch {
        resolve(null)
      }
    })
    if (!blob) return null
    const buf = await blob.arrayBuffer()
    return { width: canvas.width, height: canvas.height, jpeg: new Uint8Array(buf) }
  } catch {
    return null
  }
}
