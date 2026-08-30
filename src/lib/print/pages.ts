import { diag } from '../diag/log'
import { renderChart, renderKey } from '../stitch/render-chart'
import { renderHoop } from '../stitch/render-hoop'
import type { Pattern } from '../stitch/types'
import { pagePlan } from './layout'
import { buildPdf, canvasJpeg, pdfBlob, type PdfPage } from './pdf'

function yieldFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.style.width = `${w}px`
  c.style.height = `${h}px`
  return c
}

export async function buildPatternPdf(pattern: Pattern): Promise<Blob | null> {
  try {
    const plan = pagePlan(pattern)
    const pages: PdfPage[] = []

    const cover = makeCanvas(1100, 1100)
    renderHoop(cover, { pattern, cssSize: 1100 })
    const hoopImg = await canvasJpeg(cover)
    await yieldFrame()
    pages.push({
      images: hoopImg
        ? [{ ...hoopImg, x: 86, y: 160, w: 440, h: 440 }]
        : [],
      texts: [
        { x: 54, y: 740, size: 22, text: 'Loop Scoop' },
        { x: 54, y: 714, size: 12, text: pattern.sourceName || 'Untitled photo' },
        {
          x: 54,
          y: 694,
          size: 11,
          text: `${pattern.hoopInches}" hoop  ·  ${pattern.aidaCount}-count  ·  ${pattern.totalStitches} stitches  ·  ${pattern.colors.length} colors`,
        },
      ],
    })

    const cellIn = 0.17
    const pxPerIn = 150
    let baseCell = Math.round(cellIn * pxPerIn)
    for (let ty = 0; ty < plan.tilesY; ty++) {
      for (let tx = 0; tx < plan.tilesX; tx++) {
        const col0 = tx * plan.cols
        const row0 = ty * plan.rows
        const col1 = Math.min(pattern.size, col0 + plan.cols)
        const row1 = Math.min(pattern.size, row0 + plan.rows)
        const leftoverC = Math.max(1, col1 - col0)
        const leftoverR = Math.max(1, row1 - row0)
        let cell = baseCell
        if (leftoverC < plan.cols) {
          cell = Math.max(cell, Math.min(42, Math.floor((7.4 * pxPerIn) / leftoverC)))
        }
        if (leftoverR < plan.rows) {
          cell = Math.max(cell, Math.min(42, Math.floor((8.6 * pxPerIn) / leftoverR)))
        }
        const packed = new Int16Array(leftoverC * leftoverR)
        for (let r = 0; r < leftoverR; r++) {
          for (let c = 0; c < leftoverC; c++) {
            packed[r * leftoverC + c] = pattern.cells[(row0 + r) * pattern.size + (col0 + c)] ?? -1
          }
        }
        const slice: Pattern = { ...pattern, cells: packed }
        const chart = makeCanvas(40 + leftoverC * cell, 40 + leftoverR * cell)
        renderChart(chart, slice, {
          cellPx: cell,
          fitWidth: leftoverC * cell,
          cols: leftoverC,
          rows: leftoverR,
          stride: leftoverC,
        })
        const img = await canvasJpeg(chart)
        await yieldFrame()
        pages.push({
          images: img ? [{ ...img, x: 36, y: 80, w: 540, h: 540 * (chart.height / Math.max(1, chart.width)) }] : [],
          texts: [
            { x: 36, y: 760, size: 12, text: 'Loop Scoop symbol chart' },
            {
              x: 36,
              y: 742,
              size: 10,
              text: `Columns ${col0 + 1}–${col1}  ·  Rows ${row0 + 1}–${row1}  ·  ${pattern.hoopInches}" / ${pattern.aidaCount}ct`,
            },
          ],
        })
      }
    }

    const per = 22
    for (let k = 0; k < plan.keyPages; k++) {
      const part: Pattern = {
        ...pattern,
        colors: pattern.colors.slice(k * per, k * per + per),
      }
      const key = makeCanvas(1000, 80 + part.colors.length * 56)
      renderKey(key, part)
      const img = await canvasJpeg(key)
      await yieldFrame()
      pages.push({
        images: img ? [{ ...img, x: 36, y: 120, w: 540, h: Math.min(640, 540 * (key.height / Math.max(1, key.width))) }] : [],
        texts: [{ x: 36, y: 760, size: 14, text: 'Loop Scoop floss key' }],
      })
    }

    const bytes = buildPdf(pages)
    if (bytes.length < 8 || String.fromCharCode(...bytes.slice(0, 8)) !== '%PDF-1.4') {
      diag.error('print', 'PDF encoder did not produce a %PDF-1.4 header')
      return null
    }
    return pdfBlob(bytes)
  } catch (err) {
    diag.error('print', 'PDF build failed', { error: err })
    return null
  }
}
