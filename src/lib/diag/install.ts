import { diag } from './log'

let installed = false

export function installDiag() {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (ev) => {
    diag.fatal('window', ev.message || 'window error', {
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
      error: ev.error,
    })
  })

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason
    const message = reason instanceof Error ? reason.message : String(reason ?? 'unhandled rejection')
    diag.fatal('window', message, { error: reason })
  })

  const originalError = console.error.bind(console)
  const originalWarn = console.warn.bind(console)
  console.error = (...args: unknown[]) => {
    try {
      diag.error('console', args.map(String).join(' '))
    } catch {
      /* ignore */
    }
    originalError(...args)
  }
  console.warn = (...args: unknown[]) => {
    try {
      diag.warn('console', args.map(String).join(' '))
    } catch {
      /* ignore */
    }
    originalWarn(...args)
  }
}
