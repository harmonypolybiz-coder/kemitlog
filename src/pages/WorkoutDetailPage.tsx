import { ArrowLeft, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '@/components/layout/navigation'
import { ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, QueryView } from '@/components/ui/States'
import { WorkoutEditView } from '@/components/workouts/WorkoutEditView'
import { WorkoutReadView } from '@/components/workouts/WorkoutReadView'
import { getWorkoutDetails } from '@/db/workouts'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { formatDate, formatDuration, formatTime } from '@/lib/format'
import { withoutDrafts } from '@/lib/stats'
import type { Workout } from '@/types/models'

function describeSchedule(workout: Workout): string {
  const date = formatDate(workout.startedAt)
  if (workout.endedAt === undefined) return `${date} · ${formatTime(workout.startedAt)}`
  const duration = formatDuration((workout.endedAt - workout.startedAt) / 1000)
  return `${date} · ${formatTime(workout.startedAt)} – ${formatTime(workout.endedAt)} · ${duration}`
}

export default function WorkoutDetailPage() {
  const { workoutId = '' } = useParams()
  const { dataScope } = usePreferences()
  const details = useDbQuery(() => getWorkoutDetails(workoutId), [workoutId])
  const [editing, setEditing] = useState(false)

  return (
    <>
      <Link
        to={ROUTES.history}
        className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Historique
      </Link>

      <QueryView query={details} loadingLabel="Chargement de la séance…">
        {(data) => {
          // Seules les séances terminées du périmètre affiché ont une page de détail.
          if (!data || data.workout.status !== 'completed' || data.workout.origin !== dataScope) {
            return (
              <EmptyState
                icon={SearchX}
                title="Séance introuvable"
                description="Cette séance n’existe pas, a été supprimée, ou n’est pas encore terminée."
                actions={
                  <ButtonLink to={ROUTES.history} variant="primary">
                    Retour à l’historique
                  </ButtonLink>
                }
              />
            )
          }

          const canEdit = dataScope === 'user'
          return (
            <>
              <PageHeader
                title={editing && canEdit ? 'Modifier la séance' : data.workout.name}
                description={
                  <span className="inline-block first-letter:uppercase">
                    {describeSchedule(data.workout)}
                  </span>
                }
              />
              {editing && canEdit ? (
                <WorkoutEditView details={data} onDone={() => setEditing(false)} />
              ) : (
                <WorkoutReadView
                  details={withoutDrafts(data)}
                  readOnly={!canEdit}
                  onEdit={() => setEditing(true)}
                />
              )}
            </>
          )
        }}
      </QueryView>
    </>
  )
}
