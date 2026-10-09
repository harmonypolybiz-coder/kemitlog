import { ClipboardList, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { programEditPath, ROUTES } from '@/components/layout/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, Notice, QueryView } from '@/components/ui/States'
import { listExercises } from '@/db/exercises'
import {
  deleteProgram,
  listProgramOverviews,
  startWorkoutFromProgram,
  type ProgramOverview,
} from '@/db/programs'
import { getActiveWorkout } from '@/db/session'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatShortDate, plural } from '@/lib/format'
import { formatPlan } from '@/lib/programs'
import type { Id } from '@/types/models'

interface ProgramCardProps {
  overview: ProgramOverview
  exerciseNames: Map<Id, string>
  /** Mode démonstration : consultation seule. */
  readOnly: boolean
  /** Une séance est déjà en cours : on ne peut pas en démarrer une autre. */
  sessionActive: boolean
}

function ProgramCard({ overview, exerciseNames, readOnly, sessionActive }: ProgramCardProps) {
  const navigate = useNavigate()
  const { program, nextDayId, lastUsedAt } = overview
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const start = (dayId: Id) =>
    run(async () => {
      await startWorkoutFromProgram(program.id, dayId)
      navigate(ROUTES.training)
    })

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="font-display text-2xl leading-tight font-semibold tracking-wide uppercase">
            {program.name}
          </h2>
          {program.description && <p className="mt-1 text-sm text-muted">{program.description}</p>}
          <p className="mt-1 text-xs text-subtle">
            {plural(program.days.length, 'jour')} ·{' '}
            {lastUsedAt === undefined
              ? 'jamais réalisé'
              : `dernière séance le ${formatShortDate(lastUsedAt)}`}
          </p>
        </div>
        {!readOnly && !confirmingDelete && (
          <div className="flex gap-2">
            <ButtonLink to={programEditPath(program.id)} size="sm">
              <Pencil className="size-4" aria-hidden />
              Modifier
            </ButtonLink>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Supprimer le programme ${program.name}`}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div className="mx-4 mb-3 rounded-xl border border-danger/40 bg-danger/5 p-3 sm:mx-5">
          <p className="text-sm">
            Supprimer « {program.name} » ? Les séances déjà réalisées restent dans l’historique.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => void run(() => deleteProgram(program.id))}
              disabled={pending}
            >
              Oui, supprimer
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={pending}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-line border-t border-line">
        {program.days.map((day) => {
          const isNext = day.id === nextDayId
          return (
            <li key={day.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {day.name}
                  {isNext && !readOnly && <Badge tone="accent">Prochain</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {day.exercises
                    .map(
                      (entry) =>
                        `${exerciseNames.get(entry.exerciseId) ?? 'Exercice supprimé'} ${formatPlan(entry)}`,
                    )
                    .join(' · ')}
                </p>
              </div>
              {!readOnly && (
                <Button
                  variant={isNext ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => void start(day.id)}
                  disabled={pending || sessionActive}
                  aria-label={`Démarrer ${day.name} (${program.name})`}
                >
                  <Play className="size-4 fill-current" aria-hidden />
                  Démarrer
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {error && (
        <div className="p-4 sm:px-5">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  )
}

export default function ProgramsPage() {
  const { dataScope } = usePreferences()
  const readOnly = dataScope === 'demo'
  const state = useDbQuery(
    async () => ({
      overviews: await listProgramOverviews(dataScope),
      exercises: await listExercises(dataScope),
      active: dataScope === 'user' ? await getActiveWorkout() : undefined,
    }),
    [dataScope],
  )

  return (
    <>
      <PageHeader
        title="Programmes"
        description={
          readOnly
            ? 'Programme fictif du mode démonstration (lecture seule).'
            : 'Planifiez vos séances, puis démarrez-les en un geste.'
        }
        actions={
          !readOnly && (
            <ButtonLink to={ROUTES.newProgram} variant="primary">
              <Plus className="size-4" aria-hidden />
              Nouveau programme
            </ButtonLink>
          )
        }
      />
      <QueryView query={state}>
        {({ overviews, exercises, active }) => {
          if (overviews.length === 0) {
            const hasExercises = exercises.some((exercise) => !exercise.archived)
            return (
              <EmptyState
                icon={ClipboardList}
                title="Aucun programme"
                description={
                  hasExercises
                    ? 'Un programme regroupe vos séances types : jours, exercices, séries et répétitions visées.'
                    : 'Un programme se compose d’exercices de votre bibliothèque : ajoutez-en d’abord quelques-uns.'
                }
                actions={
                  hasExercises ? (
                    <ButtonLink to={ROUTES.newProgram} variant="primary">
                      <Plus className="size-4" aria-hidden />
                      Créer mon premier programme
                    </ButtonLink>
                  ) : (
                    <ButtonLink to={ROUTES.exercises} variant="primary">
                      Aller aux exercices
                    </ButtonLink>
                  )
                }
              />
            )
          }

          const exerciseNames = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
          return (
            <div className="space-y-4">
              {active && (
                <Card className="flex flex-wrap items-center gap-3 border-accent/40 bg-accent/5 p-4">
                  <p className="min-w-0 flex-1 basis-56 text-sm">
                    Une séance est déjà en cours (« {active.name} ») : terminez-la avant d’en démarrer une autre.
                  </p>
                  <ButtonLink to={ROUTES.training} variant="primary" size="sm">
                    Reprendre
                  </ButtonLink>
                </Card>
              )}
              {overviews.map((overview) => (
                <ProgramCard
                  key={overview.program.id}
                  overview={overview}
                  exerciseNames={exerciseNames}
                  readOnly={readOnly}
                  sessionActive={active !== undefined}
                />
              ))}
            </div>
          )
        }}
      </QueryView>
    </>
  )
}
