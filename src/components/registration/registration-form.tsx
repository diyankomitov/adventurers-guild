'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { PartySelector } from './party-selector'
import { ProcessingOverlay } from './processing-overlay'
import { AlertCircle } from 'lucide-react'

const schema = z.object({
  characterName: z.string().min(1, 'Name is required').max(100),
  characterDescription: z.string().max(1000).optional(),
  heroforgeUrl: z
    .string()
    .url('Must be a valid URL')
    .refine(
      (url) => /heroforge\.com\/load_config=[\w-]+/i.test(url),
      'Must be a HeroForge share URL (e.g. heroforge.com/load_config=...)'
    ),
  partyName: z.string().min(1, 'Please select or create a party'),
})

type FormData = z.infer<typeof schema>

export function RegistrationForm() {
  const router = useRouter()
  const [jobId, setJobId] = useState<string | null>(null)
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const partyName = watch('partyName')

  const onSubmit = async (data: FormData) => {
    setSubmitError(null)
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.characterName,
          description: data.characterDescription ?? '',
          heroforgeUrl: data.heroforgeUrl,
          partyName: data.partyName,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setSubmitError(body.error ?? 'Failed to register character. Please try again.')
        return
      }

      const { character, jobId: jid } = await res.json() as {
        character: { id: string }
        jobId: string
      }
      setCharacterId(character.id)
      setJobId(jid)
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    }
  }

  if (jobId && characterId) {
    return (
      <ProcessingOverlay
        jobId={jobId}
        onComplete={() => router.push(`/characters/${characterId}`)}
        onError={() => setJobId(null)}
      />
    )
  }

  return (
    <AnimatePresence>
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {/* Character Name */}
        <div>
          <label htmlFor="characterName" className="label-dark">
            Character Name <span className="text-blood-400">*</span>
          </label>
          <input
            id="characterName"
            type="text"
            placeholder="e.g. Thorin Darkmantle"
            className={`input-dark ${errors.characterName ? 'border-blood-400/60' : ''}`}
            {...register('characterName')}
          />
          {errors.characterName && (
            <p className="mt-1.5 font-ui text-xs text-blood-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.characterName.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="characterDescription" className="label-dark">
            Description{' '}
            <span className="text-parchment-300/40 font-normal">(optional)</span>
          </label>
          <textarea
            id="characterDescription"
            rows={3}
            placeholder="A brief description of your character, their class, backstory..."
            className="input-dark resize-none"
            {...register('characterDescription')}
          />
          {errors.characterDescription && (
            <p className="mt-1.5 font-ui text-xs text-blood-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.characterDescription.message}
            </p>
          )}
        </div>

        {/* HeroForge URL */}
        <div>
          <label htmlFor="heroforgeUrl" className="label-dark">
            HeroForge Share URL <span className="text-blood-400">*</span>
          </label>
          <input
            id="heroforgeUrl"
            type="url"
            placeholder="https://www.heroforge.com/load_config=..."
            className={`input-dark font-ui ${errors.heroforgeUrl ? 'border-blood-400/60' : ''}`}
            {...register('heroforgeUrl')}
          />
          <p className="mt-1.5 font-ui text-xs text-parchment-300/40">
            In HeroForge, click the Share button and copy the URL
          </p>
          {errors.heroforgeUrl && (
            <p className="mt-1.5 font-ui text-xs text-blood-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.heroforgeUrl.message}
            </p>
          )}
        </div>

        {/* Party */}
        <div>
          <label className="label-dark">
            Party / Campaign <span className="text-blood-400">*</span>
          </label>
          <PartySelector
            value={partyName ?? ''}
            onChange={(val) => setValue('partyName', val, { shouldValidate: true })}
            error={errors.partyName?.message}
          />
        </div>

        {/* Submit error */}
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-blood-500/10 border border-blood-500/20"
          >
            <AlertCircle className="w-5 h-5 text-blood-400 flex-shrink-0 mt-0.5" />
            <p className="font-ui text-sm text-blood-400">{submitError}</p>
          </motion.div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full justify-center"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-obsidian-900/40 border-t-obsidian-900 rounded-full animate-spin" />
              Registering...
            </span>
          ) : (
            'Register Character'
          )}
        </button>
      </motion.form>
    </AnimatePresence>
  )
}
