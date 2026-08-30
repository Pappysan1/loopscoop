/// <reference types="vite/client" />

interface BluetoothRemoteGATTCharacteristic {
  uuid: string
  properties: { writeWithoutResponse: boolean; write: boolean }
  writeValueWithoutResponse(value: BufferSource): Promise<void>
  writeValue(value: BufferSource): Promise<void>
}

interface BluetoothRemoteGATTService {
  uuid: string
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
}

interface BluetoothRemoteGATTServer {
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
}

interface BluetoothDevice {
  name?: string
  gatt?: BluetoothRemoteGATTServer
}

interface Navigator {
  bluetooth?: {
    requestDevice(options: {
      acceptAllDevices?: boolean
      optionalServices?: Array<string | number>
    }): Promise<BluetoothDevice>
    getDevices(): Promise<BluetoothDevice[]>
  }
}

interface Window {
  electronLoopScoop?: boolean
  electronDiagAppend?: (e: unknown) => void
  Capacitor?: { isNativePlatform?: () => boolean }
}
