import { describe, expect, it } from 'vitest'
import { pickPrinterChar } from './bluetooth'

const u16 = (n: number) => `0000${n.toString(16)}-0000-1000-8000-00805f9b34fb`
const ch = (uuid: string, write = true) => ({ uuid, properties: { write, writeWithoutResponse: false } })
const svc = (uuid: string, chars: ReturnType<typeof ch>[]) => ({ uuid, getCharacteristics: async () => chars })

describe('Bluetooth write target (audit finding 1)', () => {
  it('writes to the known printer characteristic in a generic serial service', async () => {
    const got = await pickPrinterChar([svc(u16(0xffe0), [ch(u16(0xffe2)), ch(u16(0xffe1))])])
    expect(got?.uuid).toBe(u16(0xffe1))
  })

  it('refuses a generic serial service with no known printer characteristic', async () => {
    const strap = [svc(u16(0xffe0), [ch(u16(0xffe9))]), svc('6e400001-b5a3-f393-e0a9-e50e24dcca9e', [ch('6e400003-b5a3-f393-e0a9-e50e24dcca9e')])]
    expect(await pickPrinterChar(strap)).toBeNull()
  })

  it('ignores writable characteristics in unknown services', async () => {
    expect(await pickPrinterChar([svc(u16(0x180d), [ch(u16(0x2a39))])])).toBeNull()
  })

  it('skips a known characteristic that is not writable', async () => {
    expect(await pickPrinterChar([svc(u16(0x18f0), [ch(u16(0x2af1), false)])])).toBeNull()
  })

  it('finds cat-printer, Phomemo and Nordic write slots', async () => {
    expect((await pickPrinterChar([svc(u16(0xae30), [ch(u16(0xae01))])]))?.uuid).toBe(u16(0xae01))
    expect((await pickPrinterChar([svc(u16(0xff00), [ch(u16(0xff02))])]))?.uuid).toBe(u16(0xff02))
    const nordic = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'
    expect((await pickPrinterChar([svc('6E400001-B5A3-F393-E0A9-E50E24DCCA9E', [ch(nordic.toUpperCase())])]))?.uuid).toBe(nordic.toUpperCase())
  })
})
