import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { ExercisePicker } from '@/components/session/ExercisePicker'
import { SessionExerciseCard } from '@/components/session/SessionExerciseCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Notice } from '@/components/ui/States'
import {
  addExerciseToWorkout,
  finishEditing,
  updateWorkoutInfo,
  updateWorkoutSchedule,
  WORKOUT_NAME_MAX_LENGTH,
  WORKOUT_NOTES_MAX_LENGTH,
} from '@/db/session'
import { useNow } from '@/hooks/useNow'
import { usePreferences } from '@/hooks/usePreferences'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/dates'
import { errorMessage, plural } from '@/lib/format'
import type { Workout, WorkoutDetails } from '@/types/models'

function durationMinutes(workout: Workout): number {
  return Math.max(1, Math.round(((workout.endedAt ?? workout.startedAt) - workout.startedAt) / 60_000))
}

interface WorkoutEditViewProps {
  /** Séance complète, brouillons compris. */
  details: WorkoutDetails
  onDone: () => void
}

/**
 * Correction d'une séance terminée. Comme dans le journal, chaque modification est
 * enregistrée immédiatement ; la clôture écarte les séries laissées non validées.
 */
export function WorkoutEditView({ details, onDone }: WorkoutEditViewProps) {
  const { weightUnit } = usePreferences()
  const { workout, exercises } = details

  const [name, setName] = useState(workout.name)
  const [start, setStart] = useState(() => toDateTimeLocal(workout.startedAt))
  const [duration, setDuration] = useState(() => String(durationMinutes(workout)))
  const [notes, setNotes] = useState(workout.notes ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const now = useNow(60_000)

  const pendingSets = exercises.flatMap((entry) => entry.sets).filter((set) => !set.completed).length

  async function save(action: () => Promise<unknown>) {
    try {
      await action()
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  function saveName() {
    if (name.trim() !== workout.name) void save(() => updateWorkoutInfo(workout.id, { name }))
  }

  function saveNotes() {
    if (notes.trim() !== (workout.notes ?? '')) void save(() => updateWorkoutInfo(workout.id, { notes }))
  }

  function saveSchedule() {
    const unchanged =
      start === toDateTimeLocal(workout.startedAt) && duration === String(durationMinutes(workout))
    if (unchanged) return
    void save(() =>
      updateWorkoutSchedule(workout.id, {
        startedAt: fromDateTimeLocal(start),
        durationMin: Number(duration.replace(',', '.')),
      }),
    )
  }

  async function close() {
    setPending(true)
    setError(null)
    try {
      await finishEditing(workout.id)
      onDone()
    } catch (cause) {
      setError(errorMessage(cause))
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <TextField
          label="Nom de la séance"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          maxLength={WORKOUT_NAME_MAX_LENGTH}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Début"
            type="datetime-local"
            value={start}
            max={toDateTimeLocal(now)}
            onChange={(event) => setStart(event.target.value)}
            onBlur={saveSchedule}
          />
          <TextField
            label="Durée (minutes)"
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            onBlur={saveSchedule}
          />
        </div>
      </Card>

      {exercises.map((entry, index) => (
        <SessionExerciseCard
          key={entry.workoutExercise.id}
          entry={{ ...entry, previous: undefined }}
          isFirst={index === 0}
          isLast={index === exercises.length - 1}
          unit={weightUnit}
          restSec={0}
          hidePrevious
        />
      ))}

      <Button className="w-full" onClick={() => setPickerOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Ajouter un exercice oublié
      </Button>

      <TextAreaField
        label="Notes de séance"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={saveNotes}
        maxLength={WORKOUT_NOTES_MAX_LENGTH}
        rows={2}
      />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="space-y-2">
        <Button variant="primary" className="w-full" onClick={() => void close()} disabled={pending}>
          <Check className="size-4" aria-hidden />
          {pending ? 'Enregistrement…' : 'Terminer la modification'}
        </Button>
        <p className="text-sm text-subtle">
          Chaque modification est enregistrée immédiatement.
          {pendingSets > 0 &&
            ` ${plural(pendingSets, 'série non validée sera écartée', 'séries non validées seront écartées')} à la clôture.`}
        </p>
      </div>

      <Modal open={pickerOpen} title="Ajouter un exercice" onClose={() => setPickerOpen(false)}>
        <ExercisePicker
          onPick={(exerciseId) => addExerciseToWorkout(workout.id, exerciseId)}
          pickedIds={exercises.map((entry) => entry.workoutExercise.exerciseId)}
          onDone={() => setPickerOpen(false)}
        />
      </Modal>
    </div>
  )
}
