import { Check, Plus, Search, Star } from 'lucide-react'
import { useState } from 'react'
import { ROUTES } from '@/components/layout/navigation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { QueryView } from '@/components/ui/States'
import { listExercises } from '@/db/exercises'
import { useDbQuery } from '@/hooks/useDbQuery'
import { errorMessage } from '@/lib/format'
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from '@/lib/labels'
import { matchesSearch } from '@/lib/search'
import type { Id } from '@/types/models'

interface ExercisePickerProps {
  /** Ajoute l'exercice choisi (à une séance, à un jour de programme…). */
  onPick: (exerciseId: Id) => Promise<unknown> | void
  /** Exercices déjà ajoutés (un même exercice peut l'être plusieurs fois). */
  pickedIds: readonly Id[]
  onDone: () => void
}

/** Contenu de la fenêtre d'ajout : on peut enchaîner plusieurs ajouts avant de fermer. */
export function ExercisePicker({ onPick, pickedIds, onDone }: ExercisePickerProps) {
  const exercises = useDbQuery(async () =>
    (await listExercises('user')).filter((exercise) => !exercise.archived),
  )
  const [search, setSearch] = useState('')
  const [pendingId, setPendingId] = useState<Id | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function add(exerciseId: Id) {
    setPendingId(exerciseId)
    setError(null)
    try {
      await onPick(exerciseId)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher dans ma bibliothèque"
          aria-label="Rechercher un exercice"
          className="min-h-11 w-full rounded-xl border border-line bg-canvas pr-3 pl-9 text-base placeholder:text-subtle focus:border-accent sm:text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <QueryView query={exercises}>
        {(data) => {
          const shown = data.filter((exercise) =>
            matchesSearch(
              `${exercise.name} ${MUSCLE_GROUP_LABELS[exercise.muscleGroup]} ${EQUIPMENT_LABELS[exercise.equipment]}`,
              search,
            ),
          )
          if (shown.length === 0) {
            return (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted">
                  {data.length === 0
                    ? 'Votre bibliothèque ne contient aucun exercice disponible.'
                    : 'Aucun exercice ne correspond à cette recherche.'}
                </p>
                <ButtonLink to={ROUTES.exercises} size="sm">
                  Gérer mes exercices
                </ButtonLink>
              </div>
            )
          }
          return (
            <ul className="max-h-[50dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {shown.map((exercise) => {
                const count = pickedIds.filter((id) => id === exercise.id).length
                return (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      onClick={() => void add(exercise.id)}
                      disabled={pendingId !== null}
                      aria-label={`Ajouter ${exercise.name}`}
                      className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-raised/60 disabled:opacity-60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          {exercise.favorite && (
                            <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-hidden />
                          )}
                          <span className="truncate">{exercise.name}</span>
                        </span>
                        <span className="block truncate text-xs text-subtle">
                          {MUSCLE_GROUP_LABELS[exercise.muscleGroup]} · {EQUIPMENT_LABELS[exercise.equipment]}
                        </span>
                      </span>
                      {count > 0 ? (
                        <span className="flex shrink-0 items-center gap-1 text-sm text-accent">
                          <Check className="size-4" aria-hidden />
                          {count > 1 ? `Ajouté × ${count}` : 'Ajouté'}
                        </span>
                      ) : (
                        <Plus className="size-5 shrink-0 text-muted" aria-hidden />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        }}
      </QueryView>

      <div className="flex justify-end">
        <Button variant="primary" onClick={onDone}>
          Terminé
        </Button>
      </div>
    </div>
  )
}
