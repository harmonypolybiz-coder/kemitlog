import { Dumbbell, Layers, Pencil, RotateCcw, Trash2, Weight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { exerciseProgressPath, ROUTES } from '@/components/layout/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/States'
import { StatTile } from '@/components/ui/StatTile'
import { startWorkoutFrom } from '@/db/session'
import { deleteWorkout } from '@/db/workouts'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatSetValues, formatVolume } from '@/lib/format'
import { SET_TYPE_LABELS } from '@/lib/labels'
import { setVolumeKg, summarizeWorkout } from '@/lib/stats'
import type { WorkoutDetails } from '@/types/models'

interface WorkoutReadViewProps {
  /** Séance sans ses brouillons (séries non validées). */
  details: WorkoutDetails
  /** Mode démonstration : aucune action. */
  readOnly: boolean
  onEdit: () => void
}

export function WorkoutReadView({ details, readOnly, onEdit }: WorkoutReadViewProps) {
  const { weightUnit } = usePreferences()
  const navigate = useNavigate()
  const { workout, exercises } = details
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const summary = summarizeWorkout(
    workout,
    exercises.flatMap((entry) => entry.sets),
  )

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(errorMessage(cause))
      setPending(false)
    }
  }

  const repeat = () =>
    run(async () => {
      await startWorkoutFrom(workout.id)
      navigate(ROUTES.training)
    })

  const remove = () =>
    run(async () => {
      await deleteWorkout(workout.id)
      navigate(ROUTES.history, { replace: true })
    })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={Dumbbell} label="Exercices" value={String(summary.exerciseCount)} />
        <StatTile icon={Layers} label="Séries" value={String(summary.setCount)} hint="hors échauffement" />
        <StatTile icon={Weight} label="Volume" value={formatVolume(summary.volumeKg, weightUnit)} />
      </div>

      {workout.notes && (
        <Card className="p-4">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Notes</h2>
          <p className="mt-1.5 text-sm whitespace-pre-wrap">{workout.notes}</p>
        </Card>
      )}

      {exercises.map(({ workoutExercise, exercise, sets }) => {
        const volumeKg = sets.reduce((total, set) => total + setVolumeKg(set), 0)
        let workingNumber = 0
        return (
          <Card key={workoutExercise.id} className="overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 px-4 pt-4 pb-2">
              <h2 className="min-w-0 truncate text-lg font-semibold">
                {exercise ? (
                  <Link
                    to={exerciseProgressPath(exercise.id)}
                    className="hover:text-accent"
                    title="Voir la progression de cet exercice"
                  >
                    {exercise.name}
                  </Link>
                ) : (
                  'Exercice supprimé'
                )}
              </h2>
              {volumeKg > 0 && (
                <span className="shrink-0 text-xs text-subtle tabular-nums">
                  {formatVolume(volumeKg, weightUnit)}
                </span>
              )}
            </div>
            <ol className="divide-y divide-line/60">
              {sets.map((set) => {
                if (set.type !== 'warmup') workingNumber += 1
                return (
                  <li key={set.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-6 shrink-0 text-center font-display text-lg font-semibold text-muted tabular-nums">
                      {set.type === 'warmup' ? '·' : workingNumber}
                    </span>
                    <span className="min-w-0 flex-1 font-medium tabular-nums">
                      {formatSetValues(set, weightUnit)}
                    </span>
                    {set.type !== 'normal' && (
                      <span className="shrink-0 text-xs text-demo first-letter:uppercase">
                        {SET_TYPE_LABELS[set.type]}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </Card>
        )
      })}

      {!readOnly &&
        (confirmingDelete ? (
          <Card className="border-danger/40 bg-danger/5 p-4">
            <p className="font-semibold">Supprimer définitivement cette séance ?</p>
            <p className="mt-1 text-sm text-muted">
              Ses séries disparaîtront de l’historique et des statistiques.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => void remove()} disabled={pending}>
                Oui, supprimer
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={pending}>
                Annuler
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void repeat()} disabled={pending}>
              <RotateCcw className="size-4" aria-hidden />
              Refaire cette séance
            </Button>
            <Button onClick={onEdit} disabled={pending}>
              <Pencil className="size-4" aria-hidden />
              Modifier
            </Button>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)} disabled={pending}>
              <Trash2 className="size-4" aria-hidden />
              Supprimer
            </Button>
          </div>
        ))}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
