import { app, BrowserWindow, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.join(__dirname, '..', 'dist', 'client')
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

function safeJoin(root, urlPath) {
  const clean = decodeURIComponent((urlPath || '/').split('?')[0].split('#')[0])
  const resolved = path.normalize(path.join(root, clean))
  if (!resolved.startsWith(root)) return null
  return resolved
}

function lanAddresses(port) {
  const out = []
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${port}`)
    }
  }
  return out
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const target = safeJoin(clientRoot, req.url === '/' ? '/_shell.html' : req.url)
      const send = (file) => {
        fs.readFile(file, (err, data) => {
          if (err) {
            const shellPath = path.join(clientRoot, '_shell.html')
            fs.readFile(shellPath, (e2, html) => {
              if (e2) {
                res.statusCode = 404
                res.end('Loop Scoop build missing. Run npm run build.')
                return
              }
              res.setHeader('content-type', 'text/html; charset=utf-8')
              res.end(html)
            })
            return
          }
          res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream')
          res.end(data)
        })
      }
      if (!target) {
        res.statusCode = 403
        res.end()
        return
      }
      send(target)
    })
    server.listen(4173, '0.0.0.0', () => resolve({ server, port: 4173 }))
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(0, '0.0.0.0', () => {
          const addr = server.address()
          resolve({ server, port: addr.port })
        })
      } else reject(err)
    })
  })
}

async function createWindow() {
  const { port } = await startStaticServer()
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
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  appendDiag({
    time: new Date().toISOString(),
    level: 'info',
    source: 'electron',
    message: `Serving studio on http://127.0.0.1:${port} ${lanAddresses(port).join(' ')}`,
  })
  await win.loadURL(`http://127.0.0.1:${port}/`)
}

app.whenReady().then(() => createWindow())
app.on('window-all-closed', () => app.quit())
