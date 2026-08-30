import { diag } from '../diag/log'
import type { Pattern } from '../stitch/types'

const PRINTER_KEY = 'loopscoop.printer'
const NORDIC_UART = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'
const NORDIC_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
const PHOMEMO = '0000ff00-0000-1000-8000-00805f9b34fb'

export type BtPrinter = {
  name: string
  device: BluetoothDevice
  char: BluetoothRemoteGATTCharacteristic
}

let connected: BtPrinter | null = null

function btAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

export function webBluetoothAvailable() {
  return btAvailable()
}

export function lastPrinterName() {
  try {
    return localStorage.getItem(PRINTER_KEY) || ''
  } catch {
    return ''
  }
}

async function findWriteChar(server: BluetoothRemoteGATTServer) {
  const services = await server.getPrimaryServices()
  const prefer = new Set([NORDIC_RX, '0000ff02-0000-1000-8000-00805f9b34fb'])
  for (const svc of services) {
    const chars = await svc.getCharacteristics()
    for (const ch of chars) {
      const props = ch.properties
      if (prefer.has(ch.uuid) && (props.writeWithoutResponse || props.write)) return ch
    }
  }
  for (const svc of services) {
    const chars = await svc.getCharacteristics()
    for (const ch of chars) {
      if (ch.properties.writeWithoutResponse) return ch
      if (ch.properties.write) return ch
    }
  }
  return null
}

export async function connectPrinter(forcePicker = false): Promise<BtPrinter> {
  if (!btAvailable()) {
    const msg = 'Bluetooth printing needs Chrome on your phone, with the printer awake.'
    diag.warn('bluetooth', msg)
    throw new Error(msg)
  }
  try {
    const bluetooth = navigator.bluetooth
    if (!bluetooth) {
      const msg = 'Bluetooth printing needs Chrome on your phone, with the printer awake.'
      diag.warn('bluetooth', msg)
      throw new Error(msg)
    }
    let device: BluetoothDevice | undefined
    if (!forcePicker) {
      try {
        const existing = await bluetooth.getDevices()
        device = existing[0]
      } catch {
        device = undefined
      }
    }
    if (!device) {
      device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [NORDIC_UART, PHOMEMO, 0x18f0, 0xff00, 0xffe0],
      })
    }
    const server = await device.gatt?.connect()
    if (!server) throw new Error('Could not open a GATT connection.')
    const char = await findWriteChar(server)
    if (!char) throw new Error('Printer has no writable Bluetooth characteristic.')
    connected = { name: device.name || 'Bluetooth printer', device, char }
    try {
      localStorage.setItem(PRINTER_KEY, connected.name)
    } catch {
      /* ignore */
    }
    window.addEventListener('pagehide', disconnectPrinter, { once: true })
    diag.info('bluetooth', `Connected to ${connected.name}`)
    return connected
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotFoundError') {
      const msg = 'No Bluetooth printer was chosen.'
      diag.warn('bluetooth', msg, { error: err })
      throw new Error(msg)
    }
    if (name === 'NotAllowedError') {
      const msg = 'Bluetooth permission was denied.'
      diag.warn('bluetooth', msg, { error: err })
      throw new Error(msg)
    }
    diag.error('bluetooth', 'Bluetooth connect failed', { error: err })
    throw new Error('Could not connect to the printer. Keep it awake and try again.')
  }
}

export function disconnectPrinter() {
  try {
    connected?.device.gatt?.disconnect()
  } catch {
    /* ignore */
  }
  connected = null
}

export function currentPrinter() {
  return connected
}

async function writeChunks(char: BluetoothRemoteGATTCharacteristic, bytes: Uint8Array) {
  const trySize = async (size: number) => {
    for (let i = 0; i < bytes.length; i += size) {
      const slice = bytes.slice(i, i + size)
      const copy = new ArrayBuffer(slice.byteLength)
      new Uint8Array(copy).set(slice)
      if (char.properties.writeWithoutResponse) await char.writeValueWithoutResponse(copy)
      else await char.writeValue(copy)
      if (size <= 20) await new Promise((r) => setTimeout(r, 12))
    }
  }
  try {
    await trySize(128)
  } catch {
    await trySize(20)
  }
}

function dither384(src: HTMLCanvasElement) {
  const w = 384
  const h = Math.max(1, Math.round((src.height / src.width) * w))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(src, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.299 * (d[i * 4] ?? 0) + 0.587 * (d[i * 4 + 1] ?? 0) + 0.114 * (d[i * 4 + 2] ?? 0)
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const old = lum[i] ?? 0
      const next = old < 128 ? 0 : 255
      const err = old - next
      lum[i] = next
      if (x + 1 < w) lum[i + 1] += (err * 7) / 16
      if (y + 1 < h && x > 0) lum[i + w - 1] += (err * 3) / 16
      if (y + 1 < h) lum[i + w] += (err * 5) / 16
      if (y + 1 < h && x + 1 < w) lum[i + w + 1] += (err * 1) / 16
    }
  }
  const bytesPerRow = w / 8
  const raster = new Uint8Array(h * bytesPerRow)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((lum[y * w + x] ?? 0) < 128) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  return { raster, width: w, height: h }
}

function escPosJob(pattern: Pattern, hoopCanvas: HTMLCanvasElement, includeChart: boolean) {
  const parts: number[] = [0x1b, 0x40, 0x1b, 0x61, 0x01]
  const text = (s: string) => {
    for (const ch of s) parts.push(ch.charCodeAt(0) & 0x7f)
    parts.push(10)
  }
  text('LOOP SCOOP')
  text((pattern.sourceName || 'pattern').slice(0, 32))
  text(`${pattern.hoopInches}" ${pattern.aidaCount}ct ${pattern.totalStitches} sts`)
  const d = dither384(hoopCanvas)
  if (d) {
    const bytesPerRow = d.width / 8
    for (let y = 0; y < d.height; y += 24) {
      const sliceH = Math.min(24, d.height - y)
      parts.push(0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, sliceH & 0xff, (sliceH >> 8) & 0xff)
      for (let row = 0; row < sliceH; row++) {
        const off = (y + row) * bytesPerRow
        for (let i = 0; i < bytesPerRow; i++) parts.push(d.raster[off + i] ?? 0)
      }
    }
  }
  text('')
  for (const c of pattern.colors.slice(0, 24)) {
    text(`${c.symbol} ${c.dmc ? `DMC ${c.dmc}` : c.hex} ${c.count}`)
  }
  if (!includeChart) text('Use Print on paper for the full chart.')
  parts.push(10, 10, 0x1d, 0x56, 0x41, 0x10)
  return new Uint8Array(parts)
}

export async function printPatternBluetooth(pattern: Pattern, hoopCanvas: HTMLCanvasElement) {
  const printer = connected ?? (await connectPrinter())
  const includeChart = pattern.size <= 56
  const job = escPosJob(pattern, hoopCanvas, includeChart)
  await writeChunks(printer.char, job)
  diag.info('bluetooth', `Printed to ${printer.name}`)
  return printer
}
