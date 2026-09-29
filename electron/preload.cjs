// CommonJS on purpose: sandboxed Electron preloads cannot be ES modules.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronLoopScoop', true)
contextBridge.exposeInMainWorld('electronDiagAppend', (event) => {
  try {
    ipcRenderer.send('diag:append', event)
  } catch {
    /* ignore */
  }
})
