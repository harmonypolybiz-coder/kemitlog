import { Archive, ArchiveRestore, Trash2, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { exerciseProgressPath } from '@/components/layout/navigation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Notice, type Feedback } from '@/components/ui/States'
import { getExerciseUsage, removeExercise, setExerciseArchived } from '@/db/exercises'
import { useDbQuery } from '@/hooks/useDbQuery'
import { errorMessage, plural } from '@/lib/format'
import type { Exercise } from '@/types/models'
import { ExerciseForm } from './ExerciseForm'

interface ExerciseEditorProps {
  exercise: Exercise
  onClose: () => void
  onFeedback: (feedback: Feedback) => void
}

/** Contenu de la fenêtre de modification : formulaire, utilisation, archivage et suppression. */
export function ExerciseEditor({ exercise, onClose, onFeedback }: ExerciseEditorProps) {
  const usage = useDbQuery(() => getExerciseUsage(exercise.id), [exercise.id])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const used = usage.status === 'success' && (usage.data.workouts > 0 || usage.data.programs > 0)

  async function run(action: () => Promise<string>) {
    setPending(true)
    setError(null)
    try {
      onFeedback({ tone: 'success', message: await action() })
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
      setPending(false)
    }
  }

  const toggleArchive = () =>
    run(async () => {
      await setExerciseArchived(exercise.id, !exercise.archived)
      return exercise.archived
        ? `« ${exercise.name} » est de nouveau disponible.`
        : `« ${exercise.name} » a été archivé : il n’est plus proposé, son historique est conservé.`
    })

  const remove = () =>
    run(async () => {
      const outcome = await removeExercise(exercise.id)
      return outcome === 'deleted'
        ? `« ${exercise.name} » a été supprimé.`
        : `« ${exercise.name} » est utilisé dans votre historique : il a été archivé plutôt que supprimé.`
    })

  return (
    <div className="space-y-6">
      <ExerciseForm
        exercise={exercise}
        hasHistory={usage.status === 'success' && usage.data.workouts > 0}
        onCancel={onClose}
        onSaved={(saved) => {
          onFeedback({ tone: 'success', message: `« ${saved.name} » a été mis à jour.` })
          onClose()
        }}
      />

      <div className="space-y-3 border-t border-line pt-5">
        <p className="text-sm text-muted">
          {usage.status === 'loading' && 'Vérification de l’utilisation…'}
          {usage.status === 'error' && 'Impossible de vérifier où cet exercice est utilisé.'}
          {usage.status === 'success' &&
            (used
              ? `Utilisé dans ${plural(usage.data.workouts, 'séance')} et ${plural(usage.data.programs, 'programme')} : il peut être archivé, mais pas supprimé.`
              : 'Cet exercice n’apparaît dans aucune séance ni programme.')}
        </p>

        {confirmingDelete ? (
          <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
            <p className="text-sm">Supprimer définitivement « {exercise.name} » ?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" onClick={remove} disabled={pending}>
                Oui, supprimer
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={pending}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={toggleArchive} disabled={pending}>
              {exercise.archived ? (
                <ArchiveRestore className="size-4" aria-hidden />
              ) : (
                <Archive className="size-4" aria-hidden />
              )}
              {exercise.archived ? 'Désarchiver' : 'Archiver'}
            </Button>
            {usage.status === 'success' && usage.data.workouts > 0 && (
              <ButtonLink to={exerciseProgressPath(exercise.id)}>
                <TrendingUp className="size-4" aria-hidden />
                Voir la progression
              </ButtonLink>
            )}
            {/* La suppression n'est proposée que lorsqu'elle est réellement possible. */}
            {usage.status === 'success' && !used && (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)} disabled={pending}>
                <Trash2 className="size-4" aria-hidden />
                Supprimer
              </Button>
            )}
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </div>
  )
}
