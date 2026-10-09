import { Dumbbell, FlaskConical, Play } from 'lucide-react'
import { useState } from 'react'
import { ROUTES } from '@/components/layout/navigation'
import { ActiveSessionView } from '@/components/session/ActiveSessionView'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, Notice, QueryView } from '@/components/ui/States'
import { disableDemoMode } from '@/db/demo/demoMode'
import { listExercises } from '@/db/exercises'
import { listProgramOverviews, startWorkoutFromProgram, type ProgramOverview } from '@/db/programs'
import { getActiveSession, startWorkout } from '@/db/session'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatExactDuration, plural } from '@/lib/format'
import type { Id } from '@/types/models'

/** Écran de départ : aucune séance en cours. */
function StartScreen({
  availableExercises,
  programs,
}: {
  availableExercises: number
  programs: ProgramOverview[]
}) {
  const { defaultRestSec } = usePreferences()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start(from?: { programId: Id; dayId: Id }) {
    setPending(true)
    setError(null)
    try {
      // La séance créée apparaît aussitôt : la page bascule sur le journal.
      if (from) await startWorkoutFromProgram(from.programId, from.dayId)
      else await startWorkout()
    } catch (cause) {
      setError(errorMessage(cause))
      setPending(false)
    }
  }

  if (availableExercises === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="Ajoutez d’abord des exercices"
        description="Une séance se compose d’exercices de votre bibliothèque. Piochez-en dans le catalogue ou créez les vôtres."
        actions={
          <ButtonLink to={ROUTES.exercises} variant="primary">
            Aller aux exercices
          </ButtonLink>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
    <Card className="flex flex-col items-center px-6 py-12 text-center">
      <h2 className="font-display text-3xl font-bold tracking-wide uppercase">Prêt à vous entraîner ?</h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        Démarrez une séance libre, puis ajoutez vos exercices au fil de l’eau. Chaque série validée
        est enregistrée immédiatement : vous pouvez fermer l’application et reprendre plus tard.
      </p>
      <Button variant="primary" className="mt-6 min-h-14 px-8 text-base" onClick={() => void start()} disabled={pending}>
        <Play className="size-5 fill-current" aria-hidden />
        {pending ? 'Démarrage…' : 'Démarrer une séance'}
      </Button>
      <p className="mt-5 text-xs text-subtle">
        {plural(availableExercises, 'exercice disponible', 'exercices disponibles')} · repos par défaut :{' '}
        {formatExactDuration(defaultRestSec)}
      </p>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>

    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <h2 className="font-display text-xl font-semibold tracking-wide uppercase">Mes programmes</h2>
        <ButtonLink to={programs.length === 0 ? ROUTES.newProgram : ROUTES.programs} size="sm">
          {programs.length === 0 ? 'Créer un programme' : 'Gérer'}
        </ButtonLink>
      </div>
      {programs.length === 0 ? (
        <p className="border-t border-line px-4 py-4 text-sm text-muted sm:px-5">
          Aucun programme. Créez-en un pour démarrer vos séances types en un geste.
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {programs.map(({ program, nextDayId }) => {
            const next = program.days.find((day) => day.id === nextDayId)
            if (!next) return null
            return (
              <li key={program.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <p className="min-w-0 flex-1 basis-48">
                  <span className="block truncate font-semibold">{program.name}</span>
                  <span className="block truncate text-sm text-muted">
                    Prochain : {next.name} · {plural(next.exercises.length, 'exercice')}
                  </span>
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void start({ programId: program.id, dayId: next.id })}
                  disabled={pending}
                  aria-label={`Démarrer ${next.name} (${program.name})`}
                >
                  <Play className="size-4 fill-current" aria-hidden />
                  Démarrer
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
    </div>
  )
}

function DemoNotice() {
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <EmptyState
        icon={FlaskConical}
        title="Journal indisponible en mode démonstration"
        description="Le mode démonstration est en lecture seule. Quittez-le pour enregistrer vos propres séances."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              disableDemoMode().catch((cause: unknown) => setError(errorMessage(cause)))
            }}
          >
            Quitter le mode démonstration
          </Button>
        }
      />
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </>
  )
}

function Journal() {
  const state = useDbQuery(async () => ({
    session: await getActiveSession(),
    availableExercises: (await listExercises('user')).filter((exercise) => !exercise.archived).length,
    programs: await listProgramOverviews('user'),
  }))

  return (
    <QueryView query={state} loadingLabel="Chargement de la séance…">
      {({ session, availableExercises, programs }) =>
        session ? (
          // La clé réinitialise l'état local (confirmations, notes) d'une séance à l'autre.
          <ActiveSessionView key={session.workout.id} session={session} />
        ) : (
          <StartScreen availableExercises={availableExercises} programs={programs} />
        )
      }
    </QueryView>
  )
}

export default function TrainingPage() {
  const { dataScope } = usePreferences()
  return (
    <>
      <PageHeader title="Entraînement" description="Enregistrez vos séries pendant la séance." />
      {dataScope === 'demo' ? <DemoNotice /> : <Journal />}
    </>
  )
}
