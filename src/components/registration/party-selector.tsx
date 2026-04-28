'use client'

import { useEffect, useState } from 'react'
import * as Select from '@radix-ui/react-select'
import { ChevronDown, Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Party } from '@/db/schema'

interface PartySelectorProps {
  value: string
  onChange: (value: string) => void
  error?: string
}

export function PartySelector({ value, onChange, error }: PartySelectorProps) {
  const [parties, setParties] = useState<Party[]>([])
  const [isNewParty, setIsNewParty] = useState(false)
  const [newPartyName, setNewPartyName] = useState('')

  useEffect(() => {
    fetch('/api/parties')
      .then((r) => r.json())
      .then((data) => setParties(data))
      .catch(() => {})
  }, [])

  const handleSelectChange = (val: string) => {
    if (val === '__new__') {
      setIsNewParty(true)
      onChange('')
    } else {
      setIsNewParty(false)
      onChange(val)
    }
  }

  const handleNewPartyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPartyName(e.target.value)
    onChange(e.target.value)
  }

  return (
    <div className="space-y-2">
      {!isNewParty ? (
        <Select.Root onValueChange={handleSelectChange} value={value || undefined}>
          <Select.Trigger
            className={cn(
              'input-dark flex items-center justify-between',
              error && 'border-blood-400/60 focus:border-blood-400'
            )}
            aria-label="Select party"
          >
            <Select.Value placeholder="Select a party..." />
            <Select.Icon>
              <ChevronDown className="w-4 h-4 text-parchment-300/50" />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content
              className="z-50 min-w-[240px] overflow-hidden rounded-xl bg-obsidian-700 border border-white/[0.1] shadow-card"
              position="popper"
              sideOffset={4}
            >
              <Select.Viewport className="p-1">
                {parties.map((party) => (
                  <Select.Item
                    key={party.id}
                    value={party.name}
                    className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm font-ui text-parchment-100 hover:bg-white/[0.06] focus:bg-white/[0.06] outline-none data-[highlighted]:bg-white/[0.06] transition-colors duration-100"
                  >
                    <Select.ItemText>{party.name}</Select.ItemText>
                    <Select.ItemIndicator className="absolute right-3">
                      <Check className="w-4 h-4 text-gold-400" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}

                <div className="h-px bg-white/[0.06] my-1" />

                <Select.Item
                  value="__new__"
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm font-ui text-gold-400 hover:bg-white/[0.06] focus:bg-white/[0.06] outline-none data-[highlighted]:bg-white/[0.06] transition-colors duration-100"
                >
                  <Plus className="w-4 h-4" />
                  <Select.ItemText>Create new party...</Select.ItemText>
                </Select.Item>
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={newPartyName}
            onChange={handleNewPartyInput}
            placeholder="Enter new party name..."
            className={cn(
              'input-dark flex-1',
              error && 'border-blood-400/60 focus:border-blood-400'
            )}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setIsNewParty(false)
              setNewPartyName('')
              onChange('')
            }}
            className="btn-secondary px-3"
          >
            Back
          </button>
        </div>
      )}

      {error && <p className="font-ui text-xs text-blood-400">{error}</p>}
    </div>
  )
}
