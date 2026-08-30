import type { ReactNode } from 'react'
import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { StudioBoundary } from '../lib/diag/boundary'
import { installDiag } from '../lib/diag/install'
import { useStudio } from '../lib/studio-store'
import appCss from '../styles.css?url'

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
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/favicon.svg' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <StudioBoundary onOpenLog={() => useStudio.getState().setDiagOpen(true)}>
        <Outlet />
      </StudioBoundary>
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
