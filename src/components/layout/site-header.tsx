import Link from 'next/link'
import { Sword } from 'lucide-react'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-obsidian-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-300 flex items-center justify-center shadow-glow-gold group-hover:scale-110 transition-transform duration-200">
            <Sword className="w-4 h-4 text-obsidian-900" />
          </div>
          <span className="font-display text-lg font-semibold text-gold-gradient hidden sm:block">
            Adventurer&apos;s Guild
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="font-ui text-sm text-parchment-300/70 hover:text-parchment-100 px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-all duration-150"
          >
            Parties
          </Link>
          <Link
            href="/characters/new"
            className="btn-primary !py-2 !px-4 text-sm"
          >
            + Register Character
          </Link>
        </nav>
      </div>
    </header>
  )
}
