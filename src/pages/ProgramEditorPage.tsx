import { ArrowDown, ArrowLeft, ArrowUp, Plus, SearchX, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ROUTES } from '@/components/layout/navigation'
import { ExercisePicker } from '@/components/session/ExercisePicker'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, Notice, QueryView } from '@/components/ui/States'
import { listExercises } from '@/db/exercises'
import { getProgram, PROGRAM_LIMITS, saveProgram, type ProgramInput } from '@/db/programs'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatExactDuration } from '@/lib/format'
import { REST_CHOICES_SEC } from '@/lib/rest'
import type { Exercise, Id, Program } from '@/types/models'

/** Valeur de la liste « Repos » signifiant : utiliser le repos par défaut des préférences. */
const DEFAULT_REST = -1

interface DraftExercise {
  key: string
  exerciseId: Id
  /** Texte saisi ; converti et validé à l'enregistrement. */
  targetSets: string
  targetReps: string
  restSec: number
}

interface DraftDay {
  key: string
  /** Identifiant du jour déjà enregistré, conservé pour garder le lien avec les séances passées. */
  id?: Id
  name: string
  exercises: DraftExercise[]
}

interface Draft {
  name: string
  description: string
  days: DraftDay[]
}

function newKey(): string {
  return crypto.randomUUID()
}

function emptyDay(position: number): DraftDay {
  return { key: newKey(), name: `Jour ${position}`, exercises: [] }
}

function toDraft(program: Program | undefined): Draft {
  if (!program) return { name: '', description: '', days: [emptyDay(1)] }
  return {
    name: program.name,
    description: program.description ?? '',
    days: program.days.map((day) => ({
      key: day.id,
      id: day.id,
      name: day.name,
      exercises: day.exercises.map((entry) => ({
        key: newKey(),
        exerciseId: entry.exerciseId,
        targetSets: String(entry.targetSets),
        targetReps: entry.targetReps ?? '',
        restSec: entry.restSec ?? DEFAULT_REST,
      })),
    })),
  }
}

function toInput(draft: Draft): ProgramInput {
  return {
    name: draft.name,
    description: draft.description,
    days: draft.days.map((day) => ({
      id: day.id,
      name: day.name,
      exercises: day.exercises.map((entry) => ({
        exerciseId: entry.exerciseId,
        // Un texte non numérique donne NaN, refusé avec un message clair à l'enregistrement.
        targetSets: Number(entry.targetSets.trim() || Number.NaN),
        targetReps: entry.targetReps,
        ...(entry.restSec === DEFAULT_REST ? {} : { restSec: entry.restSec }),
      })),
    })),
  }
}

/** Déplace l'élément d'un cran ; renvoie la liste inchangée aux extrémités. */
function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  const [item] = next.splice(index, 1)
  if (item !== undefined) next.splice(target, 0, item)
  return next
}

const ICON_BUTTON =
  'flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-raised hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent'

const SMALL_INPUT =
  'min-h-11 w-full min-w-0 rounded-xl border border-line bg-canvas px-2 text-center text-base tabular-nums placeholder:text-subtle focus:border-accent sm:text-sm'

interface ProgramFormProps {
  program: Program | undefined
  exercises: Exercise[]
}

function ProgramForm({ program, exercises }: ProgramFormProps) {
  const navigate = useNavigate()
  const { defaultRestSec } = usePreferences()
  const [draft, setDraft] = useState(() => toDraft(program))
  const [pickerDayKey, setPickerDayKey] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const pickerDay = draft.days.find((day) => day.key === pickerDayKey)
  const restOptions = [
    { value: DEFAULT_REST, label: `Par défaut (${formatExactDuration(defaultRestSec)})` },
    ...REST_CHOICES_SEC.map((value) => ({ value: value as number, label: formatExactDuration(value) })),
  ]

  function updateDay(dayKey: string, change: (day: DraftDay) => DraftDay) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => (day.key === dayKey ? change(day) : day)),
    }))
  }

  function updateExercise(dayKey: string, exerciseKey: string, patch: Partial<DraftExercise>) {
    updateDay(dayKey, (day) => ({
      ...day,
      exercises: day.exercises.map((entry) => (entry.key === exerciseKey ? { ...entry, ...patch } : entry)),
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await saveProgram(toInput(draft), program?.id)
      navigate(ROUTES.programs)
    } catch (cause) {
      setError(errorMessage(cause))
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <TextField
          label="Nom du programme"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="Ex. Full body 3 jours"
          maxLength={PROGRAM_LIMITS.nameLength}
          required
          autoComplete="off"
        />
        <TextAreaField
          label="Description"
          hint="Facultatif."
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          maxLength={PROGRAM_LIMITS.descriptionLength}
          rows={2}
        />
      </Card>

      {draft.days.map((day, dayIndex) => (
        <Card key={day.key} className="overflow-hidden">
          <div className="flex items-end gap-2 p-4 sm:px-5">
            <TextField
              className="min-w-0 flex-1"
              label={`Jour ${dayIndex + 1}`}
              value={day.name}
              onChange={(event) => updateDay(day.key, (current) => ({ ...current, name: event.target.value }))}
              maxLength={PROGRAM_LIMITS.dayNameLength}
              required
              autoComplete="off"
            />
            <button
              type="button"
              className={ICON_BUTTON}
              disabled={dayIndex === 0}
              onClick={() => setDraft({ ...draft, days: move(draft.days, dayIndex, -1) })}
              aria-label={`Monter ${day.name || `le jour ${dayIndex + 1}`}`}
            >
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              disabled={dayIndex === draft.days.length - 1}
              onClick={() => setDraft({ ...draft, days: move(draft.days, dayIndex, 1) })}
              aria-label={`Descendre ${day.name || `le jour ${dayIndex + 1}`}`}
            >
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className={`${ICON_BUTTON} hover:text-danger`}
              disabled={draft.days.length === 1}
              onClick={() => setDraft({ ...draft, days: draft.days.filter((item) => item.key !== day.key) })}
              aria-label={`Supprimer ${day.name || `le jour ${dayIndex + 1}`}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>

          {day.exercises.length === 0 ? (
            <p className="border-t border-line px-4 py-4 text-sm text-muted sm:px-5">
              Aucun exercice pour ce jour.
            </p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {day.exercises.map((entry, index) => {
                const exercise = byId.get(entry.exerciseId)
                const name = exercise?.name ?? 'Exercice supprimé'
                return (
                  <li key={entry.key} className="space-y-2 px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-1">
                      <p className={`min-w-0 flex-1 truncate font-medium ${exercise ? '' : 'text-danger'}`}>
                        {name}
                        {exercise?.archived && <span className="text-subtle"> (archivé)</span>}
                      </p>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        disabled={index === 0}
                        onClick={() =>
                          updateDay(day.key, (current) => ({
                            ...current,
                            exercises: move(current.exercises, index, -1),
                          }))
                        }
                        aria-label={`Monter ${name}`}
                      >
                        <ArrowUp className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        disabled={index === day.exercises.length - 1}
                        onClick={() =>
                          updateDay(day.key, (current) => ({
                            ...current,
                            exercises: move(current.exercises, index, 1),
                          }))
                        }
                        aria-label={`Descendre ${name}`}
                      >
                        <ArrowDown className="size-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={`${ICON_BUTTON} hover:text-danger`}
                        onClick={() =>
                          updateDay(day.key, (current) => ({
                            ...current,
                            exercises: current.exercises.filter((item) => item.key !== entry.key),
                          }))
                        }
                        aria-label={`Retirer ${name}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                    <div className="grid grid-cols-[4.5rem_1fr_1.4fr] items-end gap-2">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Séries</span>
                        <input
                          className={SMALL_INPUT}
                          inputMode="numeric"
                          value={entry.targetSets}
                          onChange={(event) =>
                            updateExercise(day.key, entry.key, { targetSets: event.target.value })
                          }
                          aria-label={`Nombre de séries, ${name}`}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted">Répétitions visées</span>
                        <input
                          className={SMALL_INPUT}
                          value={entry.targetReps}
                          placeholder="8-12"
                          maxLength={PROGRAM_LIMITS.repsLength}
                          onChange={(event) =>
                            updateExercise(day.key, entry.key, { targetReps: event.target.value })
                          }
                          aria-label={`Répétitions visées, ${name}`}
                        />
                      </label>
                      <SelectField
                        label="Repos"
                        value={entry.restSec}
                        options={restOptions}
                        onChange={(restSec) => updateExercise(day.key, entry.key, { restSec })}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-t border-line p-3 sm:px-5">
            <Button className="w-full" onClick={() => setPickerDayKey(day.key)}>
              <Plus className="size-4" aria-hidden />
              Ajouter un exercice
            </Button>
          </div>
        </Card>
      ))}

      {draft.days.length < PROGRAM_LIMITS.days && (
        <Button
          className="w-full"
          onClick={() => setDraft({ ...draft, days: [...draft.days, emptyDay(draft.days.length + 1)] })}
        >
          <Plus className="size-4" aria-hidden />
          Ajouter un jour
        </Button>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap justify-end gap-2">
        <ButtonLink to={ROUTES.programs} variant="ghost">
          Annuler
        </ButtonLink>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Enregistrement…' : program ? 'Enregistrer les modifications' : 'Créer le programme'}
        </Button>
      </div>

      <Modal
        open={pickerDay !== undefined}
        title={pickerDay ? `Ajouter à « ${pickerDay.name || 'ce jour'} »` : 'Ajouter un exercice'}
        onClose={() => setPickerDayKey(null)}
      >
        {pickerDay && (
          <ExercisePicker
            pickedIds={pickerDay.exercises.map((entry) => entry.exerciseId)}
            onPick={(exerciseId) =>
              updateDay(pickerDay.key, (current) => ({
                ...current,
                exercises: [
                  ...current.exercises,
                  { key: newKey(), exerciseId, targetSets: '3', targetReps: '', restSec: DEFAULT_REST },
                ],
              }))
            }
            onDone={() => setPickerDayKey(null)}
          />
        )}
      </Modal>
    </form>
  )
}

export default function ProgramEditorPage() {
  const { programId } = useParams()
  const { dataScope } = usePreferences()
  const state = useDbQuery(
    async () => ({
      program: programId === undefined ? undefined : await getProgram(programId),
      exercises: await listExercises('user'),
    }),
    [programId],
  )

  return (
    <>
      <Link
        to={ROUTES.programs}
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Programmes
      </Link>
      <QueryView query={state}>
        {({ program, exercises }) => {
          const missing = programId !== undefined && (!program || program.origin !== 'user')
          if (missing || dataScope !== 'user') {
            return (
              <EmptyState
                icon={SearchX}
                title={dataScope === 'user' ? 'Programme introuvable' : 'Indisponible en mode démonstration'}
                description={
                  dataScope === 'user'
                    ? 'Ce programme n’existe pas ou a été supprimé.'
                    : 'Le mode démonstration est en lecture seule.'
                }
                actions={
                  <ButtonLink to={ROUTES.programs} variant="primary">
                    Retour aux programmes
                  </ButtonLink>
                }
              />
            )
          }
          return (
            <>
              <PageHeader
                title={program ? 'Modifier le programme' : 'Nouveau programme'}
                description="Rien n’est enregistré tant que vous n’avez pas validé en bas de page."
              />
              {/* La clé recrée le formulaire si l'on passe d'un programme à un autre. */}
              <ProgramForm key={program?.id ?? 'nouveau'} program={program} exercises={exercises} />
            </>
          )
        }}
      </QueryView>
    </>
  )
}
