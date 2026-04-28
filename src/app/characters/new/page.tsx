import { PageContainer } from '@/components/layout/page-container'
import { RegistrationForm } from '@/components/registration/registration-form'
import { Scroll } from 'lucide-react'

export default function NewCharacterPage() {
  return (
    <PageContainer narrow>
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-obsidian-700 border border-white/[0.08] mb-6">
          <Scroll className="w-3.5 h-3.5 text-gold-400" />
          <span className="font-ui text-xs tracking-widest uppercase text-parchment-300/60">
            The Registry
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-gold-gradient mb-3">
          Register Your Adventurer
        </h1>
        <p className="font-body text-base text-parchment-300/60 max-w-md mx-auto leading-relaxed">
          Provide your character details and HeroForge miniature link. We&apos;ll
          capture your mini in 36 poses for the gallery.
        </p>
      </div>

      {/* Form card */}
      <div className="card-dark p-6 sm:p-8 rounded-2xl">
        <RegistrationForm />
      </div>

      {/* HeroForge help */}
      <div className="mt-6 p-4 rounded-xl bg-obsidian-800 border border-white/[0.06]">
        <h3 className="font-display text-sm font-semibold text-parchment-200 mb-2">
          How to get your HeroForge share URL
        </h3>
        <ol className="space-y-1 font-ui text-sm text-parchment-300/60 list-decimal list-inside">
          <li>Open your character in HeroForge</li>
          <li>Click the <strong className="text-parchment-200">Share</strong> button in the toolbar</li>
          <li>Copy the link — it will look like{' '}
            <code className="text-gold-400/80 text-xs bg-obsidian-700 px-1.5 py-0.5 rounded">
              heroforge.com/load_config=12345
            </code>
          </li>
          <li>Paste it in the field above</li>
        </ol>
      </div>
    </PageContainer>
  )
}
