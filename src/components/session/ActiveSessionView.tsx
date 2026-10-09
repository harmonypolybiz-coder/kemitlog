import { Dumbbell, Flag, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/components/layout/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextAreaField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Notice } from '@/components/ui/States'
import {
  addExerciseToWorkout,
  finishWorkout,
  updateWorkoutInfo,
  WORKOUT_NAME_MAX_LENGTH,
  WORKOUT_NOTES_MAX_LENGTH,
} from '@/db/session'
import { deleteWorkout } from '@/db/workouts'
import { useNow } from '@/hooks/useNow'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatClock, plural } from '@/lib/format'
import type { ActiveSession, Workout } from '@/types/models'
import { ExercisePicker } from './ExercisePicker'
import { RestTimerBar } from './RestTimerBar'
import { SessionExerciseCard } from './SessionExerciseCard'

function ElapsedClock({ startedAt }: { startedAt: number }) {
  const now = useNow(1000)
  return (
    <span role="timer" aria-label="Durée de la séance" className="font-display text-3xl font-bold tabular-nums">
      {formatClock((now - startedAt) / 1000)}
    </span>
  )
}

/** Nom et notes : enregistrés à la sortie du champ. */
function SessionHeader({
  workout,
  completedSets,
  totalSets,
  onError,
}: {
  workout: Workout
  completedSets: number
  totalSets: number
  onError: (message: string | null) => void
}) {
  const [name, setName] = useState(workout.name)

  async function saveName() {
    if (name.trim() === workout.name) return
    try {
      await updateWorkoutInfo(workout.id, { name })
      onError(null)
    } catch (cause) {
      onError(errorMessage(cause))
      setName(workout.name)
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
      <div className="min-w-0 flex-1 basis-56">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => void saveName()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          maxLength={WORKOUT_NAME_MAX_LENGTH}
          aria-label="Nom de la séance"
          className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-xl font-semibold hover:border-line focus:border-accent sm:-ml-2"
        />
        <p className="px-2 text-sm text-muted sm:px-0">
          {totalSets === 0
            ? 'Aucune série pour l’instant'
            : `${completedSets} / ${plural(totalSets, 'série validée', 'séries validées')}`}
        </p>
      </div>
      <ElapsedClock startedAt={workout.startedAt} />
    </Card>
  )
}

type Confirming = 'finish' | 'discard' | null

export function ActiveSessionView({ session }: { session: ActiveSession }) {
  const { weightUnit, defaultRestSec } = usePreferences()
  const navigate = useNavigate()
  const { workout, exercises } = session

  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState(workout.notes ?? '')

  const allSets = exercises.flatMap((entry) => entry.sets)
  const completedSets = allSets.filter((set) => set.completed).length
  const pendingSets = allSets.length - completedSets

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

  const finish = () =>
    run(async () => {
      await finishWorkout(workout.id)
      navigate(ROUTES.history)
    })

  // Après l'abandon, la séance disparaît : la page revient d'elle-même à l'écran de départ.
  const discard = () => run(() => deleteWorkout(workout.id))

  async function saveNotes() {
    if (notes.trim() === (workout.notes ?? '')) return
    try {
      await updateWorkoutInfo(workout.id, { notes })
      setError(null)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    // Marge basse : le minuteur de repos fixe ne doit pas masquer les derniers boutons.
    <div className="space-y-4 pb-24">
      <SessionHeader
        workout={workout}
        completedSets={completedSets}
        totalSets={allSets.length}
        onError={setError}
      />

      {exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Ajoutez votre premier exercice"
          description="Choisissez un exercice de votre bibliothèque : ses séries seront préremplies avec votre dernière performance."
          actions={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Ajouter un exercice
            </Button>
          }
        />
      ) : (
        <>
          {exercises.map((entry, index) => (
            <SessionExerciseCard
              key={entry.workoutExercise.id}
              entry={entry}
              isFirst={index === 0}
              isLast={index === exercises.length - 1}
              unit={weightUnit}
              restSec={entry.workoutExercise.restSec ?? defaultRestSec}
            />
          ))}
          <Button className="w-full" onClick={() => setPickerOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Ajouter un exercice
          </Button>
        </>
      )}

      <TextAreaField
        label="Notes de séance"
        hint="Facultatif : forme du jour, douleurs, contexte…"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={() => void saveNotes()}
        maxLength={WORKOUT_NOTES_MAX_LENGTH}
        rows={2}
      />

      {error && <Notice tone="error">{error}</Notice>}

      {confirming === 'finish' && (
        <Card className="p-4">
          <p className="font-semibold">Terminer la séance ?</p>
          <p className="mt-1 text-sm text-muted">
            {plural(completedSets, 'série validée sera enregistrée', 'séries validées seront enregistrées')}
            {pendingSets > 0 &&
              ` ; ${plural(pendingSets, 'série non validée sera écartée', 'séries non validées seront écartées')}`}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void finish()} disabled={pending}>
              {pending ? 'Enregistrement…' : 'Oui, terminer'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
              Continuer la séance
            </Button>
          </div>
        </Card>
      )}

      {confirming === 'discard' && (
        <Card className="border-danger/40 bg-danger/5 p-4">
          <p className="font-semibold">Abandonner la séance ?</p>
          <p className="mt-1 text-sm text-muted">
            Rien ne sera enregistré
            {completedSets > 0 && ` : ${plural(completedSets, 'série validée sera perdue', 'séries validées seront perdues')}`}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => void discard()} disabled={pending}>
              Oui, abandonner
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
              Continuer la séance
            </Button>
          </div>
        </Card>
      )}

      {confirming === null && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              className="flex-1 basis-48"
              onClick={() => setConfirming('finish')}
              disabled={completedSets === 0}
            >
              <Flag className="size-4" aria-hidden />
              Terminer la séance
            </Button>
            <Button variant="danger" onClick={() => setConfirming('discard')}>
              Abandonner
            </Button>
          </div>
          {completedSets === 0 && (
            <p className="text-sm text-subtle">Validez au moins une série pour pouvoir terminer la séance.</p>
          )}
        </div>
      )}

      <RestTimerBar workout={workout} />

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
