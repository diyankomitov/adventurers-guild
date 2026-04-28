import Link from 'next/link'
import { PageContainer } from '@/components/layout/page-container'

export default function NotFound() {
  return (
    <PageContainer narrow className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-6xl mb-6">🗺️</div>
      <h1 className="font-display text-3xl font-semibold text-gold-gradient mb-4">
        Lost in the Dungeon
      </h1>
      <p className="font-body text-lg text-parchment-300/60 mb-8 max-w-sm">
        The page you seek has vanished into the shadows.
      </p>
      <Link href="/" className="btn-primary">
        Return to the Guild
      </Link>
    </PageContainer>
  )
}
