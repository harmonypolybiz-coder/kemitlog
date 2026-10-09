import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { addSet, moveWorkoutExercise, removeWorkoutExercise } from '@/db/session'
import { errorMessage, formatExactDuration, formatSetValues, formatShortDate } from '@/lib/format'
import { fieldLabel, FIELDS_BY_TRACKING } from '@/lib/setInput'
import { workingSetNumbers } from '@/lib/stats'
import type { ActiveSession, WeightUnit } from '@/types/models'
import { SetRow } from './SetRow'

interface SessionExerciseCardProps {
  entry: ActiveSession['exercises'][number]
  isFirst: boolean
  isLast: boolean
  unit: WeightUnit
  /** Repos lancé à chaque série validée ; 0 pour la correction d'une séance passée. */
  restSec: number
  /** Masque le rappel de la dernière performance (sans objet pour une séance passée). */
  hidePrevious?: boolean
}

const ICON_BUTTON =
  'flex size-9 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent'

export function SessionExerciseCard({
  entry,
  isFirst,
  isLast,
  unit,
  restSec,
  hidePrevious = false,
}: SessionExerciseCardProps) {
  const { workoutExercise, exercise, sets, previous } = entry
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trackingType = exercise?.trackingType ?? 'weight_reps'
  const name = exercise?.name ?? 'Exercice supprimé'
  const hasCompletedSets = sets.some((set) => set.completed)

  async function run(action: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  function remove() {
    // Rien à perdre : retrait immédiat. Sinon, confirmation.
    if (hasCompletedSets && !confirmingRemove) setConfirmingRemove(true)
    else void run(() => removeWorkoutExercise(workoutExercise.id))
  }

  const numbers = workingSetNumbers(sets)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-2 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{name}</h2>
          {!hidePrevious && (
          <p className="mt-0.5 text-xs text-subtle">
            {previous
              ? `Dernière fois (${formatShortDate(previous.workout.startedAt)}) : ${previous.sets
                  .map((set) => formatSetValues(set, unit))
                  .join(' · ')}`
              : 'Première fois : aucune performance précédente.'}
          </p>
          )}
          {workoutExercise.targetSets !== undefined && (
            <p className="mt-1 text-xs font-medium text-accent">
              Objectif : {workoutExercise.targetSets}{' '}
              {workoutExercise.targetReps
                ? `× ${workoutExercise.targetReps}`
                : workoutExercise.targetSets > 1
                  ? 'séries'
                  : 'série'}
              {!hidePrevious && restSec > 0 && ` · repos ${formatExactDuration(restSec)}`}
            </p>
          )}
          {exercise?.notes && <p className="mt-1 text-xs text-muted">{exercise.notes}</p>}
        </div>
        <div className="flex shrink-0">
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={pending || isFirst}
            onClick={() => void run(() => moveWorkoutExercise(workoutExercise.id, -1))}
            aria-label={`Monter ${name}`}
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={pending || isLast}
            onClick={() => void run(() => moveWorkoutExercise(workoutExercise.id, 1))}
            aria-label={`Descendre ${name}`}
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`${ICON_BUTTON} hover:text-danger`}
            disabled={pending}
            onClick={remove}
            aria-label={`Retirer ${name} de la séance`}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {confirmingRemove && (
        <div className="mx-4 mb-3 rounded-xl border border-danger/40 bg-danger/5 p-3">
          <p className="text-sm">Retirer « {name} » et ses séries validées de la séance ?</p>
          <div className="mt-2 flex gap-2">
            <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
              Oui, retirer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-danger">
          {error}
        </p>
      )}

      {sets.length > 0 && (
        // Mêmes colonnes que les lignes de série : type, champs, validation, suppression.
        <div
          aria-hidden
          className="flex items-center gap-2 px-3 pb-1 text-[11px] font-medium tracking-wider text-subtle uppercase sm:px-4"
        >
          <span className="w-11 shrink-0 text-center">Série</span>
          <div className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-2 text-center">
            {FIELDS_BY_TRACKING[trackingType].map((field) => (
              <span key={field}>{fieldLabel(field, trackingType, unit)}</span>
            ))}
          </div>
          <span className="w-11 shrink-0 text-center">OK</span>
          <span className="w-9 shrink-0" />
        </div>
      )}

      <div className="divide-y divide-line/60">
        {sets.map((set, index) => {
          return (
            <SetRow
              key={set.id}
              set={set}
              workingNumber={numbers[index] ?? 0}
              trackingType={trackingType}
              previous={previous?.sets[index]}
              unit={unit}
              restSec={restSec}
            />
          )
        })}
      </div>

      <div className="p-3 sm:px-4">
        <Button
          className="w-full"
          onClick={() => void run(() => addSet(workoutExercise.id))}
          disabled={pending}
        >
          <Plus className="size-4" aria-hidden />
          Ajouter une série
        </Button>
      </div>
    </Card>
  )
}
