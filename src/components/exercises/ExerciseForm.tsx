import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Notice } from '@/components/ui/States'
import {
  createExercise,
  EXERCISE_NAME_MAX_LENGTH,
  EXERCISE_NOTES_MAX_LENGTH,
  updateExercise,
  type ExerciseInput,
} from '@/db/exercises'
import { errorMessage } from '@/lib/format'
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, TRACKING_TYPE_LABELS } from '@/lib/labels'
import {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  TRACKING_TYPES,
  type Exercise,
  type MuscleGroup,
} from '@/types/models'

const MUSCLE_GROUP_OPTIONS = MUSCLE_GROUPS.map((value) => ({ value, label: MUSCLE_GROUP_LABELS[value] }))
const EQUIPMENT_OPTIONS = EQUIPMENT_TYPES.map((value) => ({ value, label: EQUIPMENT_LABELS[value] }))
const TRACKING_OPTIONS = TRACKING_TYPES.map((value) => ({ value, label: TRACKING_TYPE_LABELS[value] }))

interface ExerciseFormProps {
  /** Exercice à modifier ; absent pour une création. */
  exercise?: Exercise
  /** Groupe présélectionné à la création (le filtre actif de la liste). */
  defaultMuscleGroup?: MuscleGroup
  /** Vrai si l'exercice a déjà des séries : changer le type de suivi mérite un avertissement. */
  hasHistory?: boolean
  onSaved: (exercise: Exercise, mode: 'created' | 'updated') => void
  onCancel: () => void
}

export function ExerciseForm({
  exercise,
  defaultMuscleGroup = 'chest',
  hasHistory = false,
  onSaved,
  onCancel,
}: ExerciseFormProps) {
  const [input, setInput] = useState<ExerciseInput>(() => ({
    name: exercise?.name ?? '',
    muscleGroup: exercise?.muscleGroup ?? defaultMuscleGroup,
    equipment: exercise?.equipment ?? 'barbell',
    trackingType: exercise?.trackingType ?? 'weight_reps',
    notes: exercise?.notes ?? '',
  }))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      if (exercise) onSaved(await updateExercise(exercise.id, input), 'updated')
      else onSaved(await createExercise(input), 'created')
    } catch (cause) {
      setError(errorMessage(cause))
      setPending(false)
    }
  }

  const trackingChanged = exercise !== undefined && input.trackingType !== exercise.trackingType

  return (
    <form onSubmit={submit} className="space-y-4">
      <TextField
        label="Nom"
        value={input.name}
        onChange={(event) => setInput({ ...input, name: event.target.value })}
        placeholder="Ex. Développé couché"
        maxLength={EXERCISE_NAME_MAX_LENGTH}
        required
        data-autofocus={exercise ? undefined : true}
        autoComplete="off"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Groupe musculaire"
          value={input.muscleGroup}
          options={MUSCLE_GROUP_OPTIONS}
          onChange={(muscleGroup) => setInput({ ...input, muscleGroup })}
        />
        <SelectField
          label="Matériel"
          value={input.equipment}
          options={EQUIPMENT_OPTIONS}
          onChange={(equipment) => setInput({ ...input, equipment })}
        />
      </div>
      <SelectField
        label="Type de suivi"
        hint="Détermine ce que vous saisissez à chaque série."
        value={input.trackingType}
        options={TRACKING_OPTIONS}
        onChange={(trackingType) => setInput({ ...input, trackingType })}
      />
      {trackingChanged && hasHistory && (
        <p className="rounded-xl border border-demo/40 bg-demo/10 px-4 py-3 text-sm">
          Cet exercice a déjà des séries enregistrées. Elles sont conservées telles quelles, mais
          les prochaines seront saisies avec le nouveau type de suivi.
        </p>
      )}
      <TextAreaField
        label="Notes"
        hint="Facultatif : réglages de machine, consignes techniques…"
        value={input.notes ?? ''}
        onChange={(event) => setInput({ ...input, notes: event.target.value })}
        maxLength={EXERCISE_NOTES_MAX_LENGTH}
        rows={3}
      />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Enregistrement…' : exercise ? 'Enregistrer les modifications' : 'Créer l’exercice'}
        </Button>
      </div>
    </form>
  )
}
