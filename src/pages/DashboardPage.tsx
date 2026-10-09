import { CalendarCheck, CalendarClock, ClipboardList, Flame, Weight } from 'lucide-react'
import { ROUTES } from '@/components/layout/navigation'
import { ActiveWorkoutBanner } from '@/components/session/ActiveWorkoutBanner'
import { ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, QueryView } from '@/components/ui/States'
import { StatTile } from '@/components/ui/StatTile'
import { WorkoutSummaryCard } from '@/components/workouts/WorkoutSummaryCard'
import { listCompletedWorkoutSummaries } from '@/db/workouts'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { formatDate, formatRelativeDay, formatShortDate, formatVolume } from '@/lib/format'
import { computeDashboardStats } from '@/lib/stats'

const RECENT_WORKOUT_COUNT = 3

export default function DashboardPage() {
  const { dataScope, weightUnit, weekStartsOn } = usePreferences()
  const summaries = useDbQuery(() => listCompletedWorkoutSummaries(dataScope), [dataScope])
  const now = Date.now()

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={<span className="inline-block first-letter:uppercase">{formatDate(now)}</span>}
      />
      <ActiveWorkoutBanner />
      <QueryView query={summaries}>
        {(data) => {
          if (data.length === 0) {
            return (
              <EmptyState
                icon={ClipboardList}
                title="Aucune séance enregistrée"
                description="Vos statistiques apparaîtront ici dès votre première séance terminée. Commencez par créer vos exercices, ou explorez l’application avec des données de démonstration."
                actions={
                  <>
                    <ButtonLink to={ROUTES.exercises} variant="primary">
                      Créer mes exercices
                    </ButtonLink>
                    <ButtonLink to={`${ROUTES.settings}#demo`}>Voir le mode démonstration</ButtonLink>
                  </>
                }
              />
            )
          }

          const stats = computeDashboardStats(data, { now, weekStartsOn })
          return (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  icon={Flame}
                  label="Cette semaine"
                  value={String(stats.workoutsThisWeek)}
                  hint={stats.workoutsThisWeek > 1 ? 'séances terminées' : 'séance terminée'}
                />
                <StatTile
                  icon={Weight}
                  label="Volume"
                  value={formatVolume(stats.volumeThisWeekKg, weightUnit)}
                  hint="cette semaine · charge × rép."
                />
                <StatTile
                  icon={CalendarCheck}
                  label="Total"
                  value={String(stats.totalWorkouts)}
                  hint={stats.totalWorkouts > 1 ? 'séances enregistrées' : 'séance enregistrée'}
                />
                <StatTile
                  icon={CalendarClock}
                  label="Dernière"
                  value={stats.lastWorkoutAt === undefined ? '—' : formatShortDate(stats.lastWorkoutAt)}
                  hint={
                    stats.lastWorkoutAt === undefined
                      ? undefined
                      : formatRelativeDay(stats.lastWorkoutAt, now)
                  }
                />
              </div>

              <section aria-labelledby="recent-workouts">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h2
                    id="recent-workouts"
                    className="font-display text-xl font-semibold tracking-wide uppercase"
                  >
                    Dernières séances
                  </h2>
                  <ButtonLink to={ROUTES.history} variant="ghost" size="sm">
                    Tout l’historique
                  </ButtonLink>
                </div>
                <div className="space-y-3">
                  {data.slice(0, RECENT_WORKOUT_COUNT).map((summary) => (
                    <WorkoutSummaryCard key={summary.workout.id} summary={summary} />
                  ))}
                </div>
              </section>
            </div>
          )
        }}
      </QueryView>
    </>
  )
}
