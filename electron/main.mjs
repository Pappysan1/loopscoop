import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, '..', 'dist')
const diagDir = path.join(app.getPath('userData'), 'diag')
const diagFile = path.join(diagDir, 'loopscoop-diag.jsonl')

function appendDiag(event) {
  try {
    fs.mkdirSync(diagDir, { recursive: true })
    fs.appendFileSync(diagFile, `${JSON.stringify(event)}\n`)
  } catch {
    /* never throw */
  }
}

process.on('uncaughtException', (err) => {
  appendDiag({ time: new Date().toISOString(), level: 'fatal', source: 'electron', message: err.message, stack: err.stack })
})
process.on('unhandledRejection', (reason) => {
  appendDiag({ time: new Date().toISOString(), level: 'fatal', source: 'electron', message: String(reason) })
})

ipcMain.on('diag:append', (_e, event) => appendDiag(event))

function lanUrl(port) {
  return `http://127.0.0.1:${port}`
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    backgroundColor: '#f3eee6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    appendDiag({ time: new Date().toISOString(), level: 'fatal', source: 'electron', message: `renderer gone: ${details.reason}` })
  })

  const index = path.join(dist, 'index.html')
  if (fs.existsSync(index)) {
    await win.loadFile(index)
  } else {
    await win.loadURL('http://127.0.0.1:3000')
  }
}

app.whenReady().then(() => createWindow())
app.on('window-all-closed', () => app.quit())
void lanUrl
void http
