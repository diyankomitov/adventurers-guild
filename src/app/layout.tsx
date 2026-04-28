import type { Metadata } from 'next'
import './globals.css'
import { SiteHeader } from '@/components/layout/site-header'

export const metadata: Metadata = {
  title: "Adventurer's Guild",
  description: 'A gallery of DnD characters from across the realms',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚔️</text></svg>",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <SiteHeader />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="border-t border-white/[0.06] py-8 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="font-display text-xs tracking-widest uppercase text-parchment-300/30">
              ⚔ Adventurer&apos;s Guild ⚔
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
