import { Check, ChevronRight, Plus, Star } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Feedback } from '@/components/ui/States'
import type { CatalogExercise } from '@/data/exerciseCatalog'
import { addCatalogExercises, setExerciseFavorite } from '@/db/exercises'
import { errorMessage } from '@/lib/format'
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, TRACKING_TYPE_LABELS } from '@/lib/labels'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '@/types/models'

type Describable = Pick<Exercise, 'equipment' | 'trackingType'>

function describe(item: Describable): string {
  return `${EQUIPMENT_LABELS[item.equipment]} · ${TRACKING_TYPE_LABELS[item.trackingType]}`
}

/** Liste découpée par groupe musculaire, dans l'ordre du modèle. */
function GroupedList<T extends { muscleGroup: MuscleGroup }>({
  items,
  renderItem,
}: {
  items: T[]
  renderItem: (item: T) => ReactNode
}) {
  return (
    <div className="space-y-5">
      {MUSCLE_GROUPS.map((group) => {
        const groupItems = items.filter((item) => item.muscleGroup === group)
        if (groupItems.length === 0) return null
        return (
          <section key={group} aria-label={MUSCLE_GROUP_LABELS[group]}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
              {MUSCLE_GROUP_LABELS[group]}
              <span className="text-subtle">{groupItems.length}</span>
            </h2>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">{groupItems.map(renderItem)}</ul>
            </Card>
          </section>
        )
      })}
    </div>
  )
}

// ───────────────────────────── Bibliothèque ─────────────────────────────

interface LibraryListProps {
  exercises: Exercise[]
  /** Mode démonstration : ni favori ni modification. */
  readOnly: boolean
  onOpen: (exercise: Exercise) => void
  onFeedback: (feedback: Feedback) => void
}

export function LibraryList({ exercises, readOnly, onOpen, onFeedback }: LibraryListProps) {
  async function toggleFavorite(exercise: Exercise) {
    try {
      await setExerciseFavorite(exercise.id, !exercise.favorite)
    } catch (cause) {
      onFeedback({ tone: 'error', message: errorMessage(cause) })
    }
  }

  return (
    <GroupedList
      items={exercises}
      renderItem={(exercise) => {
        const summary = (
          <>
            <span className="min-w-0 flex-1">
              <span className={`block truncate font-medium ${exercise.archived ? 'text-muted' : ''}`}>
                {exercise.name}
              </span>
              <span className="block truncate text-xs text-subtle">
                {describe(exercise)}
                {exercise.notes && ` · ${exercise.notes}`}
              </span>
            </span>
            {exercise.archived && <Badge>Archivé</Badge>}
          </>
        )

        if (readOnly) {
          return (
            <li key={exercise.id} className="flex items-center gap-3 px-4 py-3">
              {summary}
            </li>
          )
        }

        return (
          <li key={exercise.id} className="flex items-stretch">
            <button
              type="button"
              onClick={() => void toggleFavorite(exercise)}
              aria-pressed={exercise.favorite ?? false}
              aria-label={`${exercise.favorite ? 'Retirer' : 'Ajouter'} ${exercise.name} ${exercise.favorite ? 'des' : 'aux'} favoris`}
              className="flex w-12 shrink-0 items-center justify-center text-subtle hover:text-fg"
            >
              <Star
                className={`size-5 ${exercise.favorite ? 'fill-accent text-accent' : ''}`}
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={() => onOpen(exercise)}
              aria-label={`Modifier ${exercise.name}`}
              className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 text-left hover:bg-raised/50"
            >
              {summary}
              <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
            </button>
          </li>
        )
      }}
    />
  )
}

// ───────────────────────────── Catalogue ─────────────────────────────

interface CatalogListProps {
  entries: CatalogExercise[]
  /** Identifiants du catalogue déjà présents dans la bibliothèque. */
  addedIds: ReadonlySet<string>
  onFeedback: (feedback: Feedback) => void
}

export function CatalogList({ entries, addedIds, onFeedback }: CatalogListProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function add(entry: CatalogExercise) {
    setPendingId(entry.id)
    try {
      await addCatalogExercises([entry.id])
    } catch (cause) {
      onFeedback({ tone: 'error', message: errorMessage(cause) })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <GroupedList
      items={entries}
      renderItem={(entry) => (
        <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{entry.name}</span>
            <span className="block truncate text-xs text-subtle">{describe(entry)}</span>
          </span>
          {addedIds.has(entry.id) ? (
            <span className="flex min-h-9 items-center gap-1.5 px-2 text-sm text-accent">
              <Check className="size-4" aria-hidden />
              Ajouté
            </span>
          ) : (
            <Button
              size="sm"
              onClick={() => void add(entry)}
              disabled={pendingId !== null}
              aria-label={`Ajouter ${entry.name} à ma bibliothèque`}
            >
              <Plus className="size-4" aria-hidden />
              Ajouter
            </Button>
          )}
        </li>
      )}
    />
  )
}
