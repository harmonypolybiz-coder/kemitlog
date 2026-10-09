import { useState } from 'react'
import { SectionCard } from '@/components/ui/Card'
import { SelectField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/States'
import { updatePreferences, type PreferencesPatch } from '@/db/preferences'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatExactDuration } from '@/lib/format'
import { WEIGHT_UNIT_LABELS } from '@/lib/labels'
import { REST_CHOICES_SEC } from '@/lib/rest'
import { WEIGHT_UNITS } from '@/types/models'

const UNIT_OPTIONS = WEIGHT_UNITS.map((value) => ({ value, label: WEIGHT_UNIT_LABELS[value] }))

const REST_OPTIONS = REST_CHOICES_SEC.map((value): { value: number; label: string } => ({
  value,
  label: formatExactDuration(value),
}))

const WEEK_START_OPTIONS: Array<{ value: 0 | 1; label: string }> = [
  { value: 1, label: 'Lundi' },
  { value: 0, label: 'Dimanche' },
]

/** Chaque réglage est enregistré dès qu'il est modifié. */
export function PreferencesSection() {
  const preferences = usePreferences()
  const [error, setError] = useState<string | null>(null)

  async function save(patch: PreferencesPatch) {
    setError(null)
    try {
      await updatePreferences(patch)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <SectionCard title="Préférences" description="Enregistrées automatiquement sur cet appareil.">
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Unité de charge"
          hint="Les charges sont converties à l’affichage."
          value={preferences.weightUnit}
          options={UNIT_OPTIONS}
          onChange={(weightUnit) => void save({ weightUnit })}
        />
        <SelectField
          label="Repos par défaut"
          hint="Proposé entre deux séries."
          value={preferences.defaultRestSec}
          options={REST_OPTIONS}
          onChange={(defaultRestSec) => void save({ defaultRestSec })}
        />
        <SelectField
          label="Début de semaine"
          hint="Utilisé pour les totaux hebdomadaires."
          value={preferences.weekStartsOn}
          options={WEEK_START_OPTIONS}
          onChange={(weekStartsOn) => void save({ weekStartsOn })}
        />
      </div>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </SectionCard>
  )
}
