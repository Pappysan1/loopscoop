import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronLoopScoop', true)
contextBridge.exposeInMainWorld('electronDiagAppend', (event) => {
  try {
    ipcRenderer.send('diag:append', event)
  } catch {
    /* ignore */
  }
})
