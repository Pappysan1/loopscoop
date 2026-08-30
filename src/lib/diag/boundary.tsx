import { Component, type ErrorInfo, type ReactNode } from 'react'
import { diag } from './log'

type Props = { children: ReactNode; onOpenLog?: () => void }
type State = { error: Error | null }

export class StudioBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    diag.fatal('react', error.message, { stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`, error })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-linen px-6 text-center text-ink">
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="max-w-md text-muted">{error.message || 'The studio hit an unexpected error.'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => this.props.onOpenLog?.()}>
            Open log
          </button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
