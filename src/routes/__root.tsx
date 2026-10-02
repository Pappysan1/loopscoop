import type { ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { DiagPanel } from '../components/studio/diag-panel'
import { StudioBoundary } from '../lib/diag/boundary'
import { installDiag } from '../lib/diag/install'
import { useStudio } from '../lib/studio-store'
import appCss from '../styles.css?url'

const base = import.meta.env.BASE_URL

if (typeof window !== 'undefined') installDiag()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Loop Scoop' },
      { name: 'description', content: 'Any photo, scaled to your hoop' },
      { name: 'theme-color', content: '#3f5344' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Loop Scoop' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: `${base}favicon.svg`, type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: `${base}favicon.svg` },
      { rel: 'manifest', href: `${base}manifest.webmanifest` },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  const diagOpen = useStudio((s) => s.diagOpen)
  return (
    <RootDocument>
      <StudioBoundary onOpenLog={() => useStudio.getState().setDiagOpen(true)}>
        <Outlet />
      </StudioBoundary>
      <DiagPanel open={diagOpen} onClose={() => useStudio.getState().setDiagOpen(false)} />
      <Toaster richColors position="bottom-center" />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-linen text-ink">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
