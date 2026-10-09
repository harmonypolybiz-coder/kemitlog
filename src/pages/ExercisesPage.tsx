import { BookOpen, Dumbbell, Plus, SearchX } from 'lucide-react'
import { useState } from 'react'
import { ExerciseEditor } from '@/components/exercises/ExerciseEditor'
import { ExerciseFilters, type GroupFilter } from '@/components/exercises/ExerciseFilters'
import { ExerciseForm } from '@/components/exercises/ExerciseForm'
import { CatalogList, LibraryList } from '@/components/exercises/ExerciseLists'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, Notice, QueryView, type Feedback } from '@/components/ui/States'
import { EXERCISE_CATALOG } from '@/data/exerciseCatalog'
import { addCatalogExercises, listExercises } from '@/db/exercises'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, plural } from '@/lib/format'
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from '@/lib/labels'
import { matchesSearch, normalizeText } from '@/lib/search'
import type { Equipment, Exercise, Id, MuscleGroup } from '@/types/models'

type Tab = 'library' | 'catalog'
type Editor = { mode: 'create' } | { mode: 'edit'; id: Id } | null

interface Filterable {
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
}

/** Applique la recherche puis le filtre de groupe ; renvoie aussi les compteurs par groupe. */
function applyFilters<T extends Filterable>(items: T[], search: string, group: GroupFilter) {
  const searched = items.filter((item) =>
    matchesSearch(
      `${item.name} ${MUSCLE_GROUP_LABELS[item.muscleGroup]} ${EQUIPMENT_LABELS[item.equipment]}`,
      search,
    ),
  )
  const counts: Partial<Record<MuscleGroup, number>> = {}
  for (const item of searched) counts[item.muscleGroup] = (counts[item.muscleGroup] ?? 0) + 1
  return {
    counts,
    shown: group === 'all' ? searched : searched.filter((item) => item.muscleGroup === group),
  }
}

/** Entrées du catalogue déjà présentes : même origine catalogue, ou même nom. */
function findAddedCatalogIds(exercises: Exercise[]): Set<string> {
  const catalogIds = new Set(exercises.map((exercise) => exercise.catalogId))
  const names = new Set(exercises.map((exercise) => normalizeText(exercise.name)))
  return new Set(
    EXERCISE_CATALOG.filter(
      (entry) => catalogIds.has(entry.id) || names.has(normalizeText(entry.name)),
    ).map((entry) => entry.id),
  )
}

export default function ExercisesPage() {
  const { dataScope } = usePreferences()
  const readOnly = dataScope === 'demo'
  const exercises = useDbQuery(() => listExercises(dataScope), [dataScope])

  const [tab, setTab] = useState<Tab>('library')
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState<GroupFilter>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [editor, setEditor] = useState<Editor>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [bulkPending, setBulkPending] = useState(false)

  const activeTab: Tab = readOnly ? 'library' : tab

  function changeTab(next: Tab) {
    setTab(next)
    setGroup('all')
    setFeedback(null)
  }

  function resetFilters() {
    setSearch('')
    setGroup('all')
  }

  async function addAll(catalogIds: string[]) {
    setBulkPending(true)
    setFeedback(null)
    try {
      const { added } = await addCatalogExercises(catalogIds)
      setFeedback({
        tone: 'success',
        message: `${plural(added, 'exercice ajouté', 'exercices ajoutés')} à votre bibliothèque.`,
      })
    } catch (cause) {
      setFeedback({ tone: 'error', message: errorMessage(cause) })
    } finally {
      setBulkPending(false)
    }
  }

  const noResult = (
    <EmptyState
      icon={SearchX}
      title="Aucun résultat"
      description="Aucun exercice ne correspond à la recherche et au filtre en cours."
      actions={<Button onClick={resetFilters}>Réinitialiser les filtres</Button>}
    />
  )

  return (
    <>
      <PageHeader
        title="Exercices"
        description={
          readOnly
            ? 'Exercices fictifs du mode démonstration (lecture seule).'
            : 'Votre bibliothèque personnelle et le catalogue intégré.'
        }
        actions={
          !readOnly && (
            <Button
              variant="primary"
              onClick={() => {
                setFeedback(null)
                setEditor({ mode: 'create' })
              }}
            >
              <Plus className="size-4" aria-hidden />
              Nouvel exercice
            </Button>
          )
        }
      />

      <QueryView query={exercises}>
        {(data) => {
          const editing = editor?.mode === 'edit' ? data.find((item) => item.id === editor.id) : undefined
          const archivedCount = data.filter((exercise) => exercise.archived).length
          const library = applyFilters(
            data.filter((exercise) => showArchived || !exercise.archived),
            search,
            group,
          )
          const addedIds = findAddedCatalogIds(data)
          const catalog = applyFilters([...EXERCISE_CATALOG], search, group)
          const missingIds = catalog.shown
            .filter((entry) => !addedIds.has(entry.id))
            .map((entry) => entry.id)

          return (
            <div className="space-y-4">
              {!readOnly && (
                <SegmentedControl
                  label="Source des exercices"
                  value={activeTab}
                  onChange={changeTab}
                  options={[
                    { value: 'library', label: `Ma bibliothèque (${data.length - archivedCount})` },
                    { value: 'catalog', label: `Catalogue (${EXERCISE_CATALOG.length})` },
                  ]}
                />
              )}

              {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}

              {activeTab === 'library' &&
                (data.length === 0 ? (
                  <EmptyState
                    icon={Dumbbell}
                    title="Votre bibliothèque est vide"
                    description={`Piochez dans le catalogue de ${EXERCISE_CATALOG.length} exercices courants, ou créez les vôtres. Ils seront proposés lors de la saisie de vos séances.`}
                    actions={
                      <>
                        <Button variant="primary" onClick={() => changeTab('catalog')}>
                          <BookOpen className="size-4" aria-hidden />
                          Parcourir le catalogue
                        </Button>
                        <Button onClick={() => setEditor({ mode: 'create' })}>
                          <Plus className="size-4" aria-hidden />
                          Créer un exercice
                        </Button>
                      </>
                    }
                  />
                ) : (
                  <>
                    <ExerciseFilters
                      search={search}
                      onSearchChange={setSearch}
                      group={group}
                      onGroupChange={setGroup}
                      counts={library.counts}
                    />
                    {archivedCount > 0 && (
                      <label className="flex min-h-9 w-fit items-center gap-2 text-sm text-muted">
                        <input
                          type="checkbox"
                          checked={showArchived}
                          onChange={(event) => setShowArchived(event.target.checked)}
                          className="size-4 accent-accent"
                        />
                        Afficher les {plural(archivedCount, 'exercice archivé', 'exercices archivés')}
                      </label>
                    )}
                    {library.shown.length === 0 ? (
                      noResult
                    ) : (
                      <LibraryList
                        exercises={library.shown}
                        readOnly={readOnly}
                        onOpen={(exercise) => {
                          setFeedback(null)
                          setEditor({ mode: 'edit', id: exercise.id })
                        }}
                        onFeedback={setFeedback}
                      />
                    )}
                  </>
                ))}

              {activeTab === 'catalog' && (
                <>
                  <ExerciseFilters
                    search={search}
                    onSearchChange={setSearch}
                    group={group}
                    onGroupChange={setGroup}
                    counts={catalog.counts}
                  />
                  {catalog.shown.length === 0 ? (
                    noResult
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted" aria-live="polite">
                          {missingIds.length === 0
                            ? 'Tous les exercices affichés sont déjà dans votre bibliothèque.'
                            : `${plural(missingIds.length, 'exercice affiché', 'exercices affichés')} à ajouter.`}
                        </p>
                        {missingIds.length > 1 && (
                          <Button size="sm" onClick={() => void addAll(missingIds)} disabled={bulkPending}>
                            <Plus className="size-4" aria-hidden />
                            {bulkPending ? 'Ajout…' : `Ajouter les ${missingIds.length}`}
                          </Button>
                        )}
                      </div>
                      <CatalogList entries={catalog.shown} addedIds={addedIds} onFeedback={setFeedback} />
                    </>
                  )}
                </>
              )}

              <Modal
                open={editor?.mode === 'create'}
                title="Nouvel exercice"
                onClose={() => setEditor(null)}
              >
                <ExerciseForm
                  defaultMuscleGroup={group === 'all' ? undefined : group}
                  onCancel={() => setEditor(null)}
                  onSaved={(exercise) => {
                    setEditor(null)
                    setTab('library')
                    setFeedback({
                      tone: 'success',
                      message: `« ${exercise.name} » a été ajouté à votre bibliothèque.`,
                    })
                  }}
                />
              </Modal>

              <Modal
                open={editing !== undefined}
                title="Modifier l’exercice"
                onClose={() => setEditor(null)}
              >
                {editing && (
                  <ExerciseEditor
                    key={editing.id}
                    exercise={editing}
                    onClose={() => setEditor(null)}
                    onFeedback={setFeedback}
                  />
                )}
              </Modal>
            </div>
          )
        }}
      </QueryView>
    </>
  )
}
