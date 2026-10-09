import { TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { WeeklyVolumeChart } from '@/components/charts/WeeklyVolumeChart'
import { ExerciseProgressSection } from '@/components/progress/ExerciseProgressSection'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState, QueryView } from '@/components/ui/States'
import { listCompletedWorkoutSummaries } from '@/db/workouts'
import { useDbQuery } from '@/hooks/useDbQuery'
import { useNow } from '@/hooks/useNow'
import { usePreferences } from '@/hooks/usePreferences'
import { formatShortDate, formatVolume } from '@/lib/format'
import { bucketByWeek } from '@/lib/stats'

const WEEK_COUNT = 12

type View = 'chart' | 'table'

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'chart', label: 'Graphique' },
  { value: 'table', label: 'Tableau' },
]

export default function ProgressPage() {
  const { dataScope, weightUnit, weekStartsOn } = usePreferences()
  const summaries = useDbQuery(() => listCompletedWorkoutSummaries(dataScope), [dataScope])
  const [view, setView] = useState<View>('chart')
  const now = useNow(60_000)

  return (
    <>
      <PageHeader title="Progression" description="L’évolution de votre charge de travail dans le temps." />
      <QueryView query={summaries}>
        {(data) => {
          if (data.length === 0) {
            return (
              <EmptyState
                icon={TrendingUp}
                title="Pas encore de données à tracer"
                description="Les graphiques sont calculés uniquement à partir de vos séances terminées. Ils apparaîtront ici après votre première séance."
              />
            )
          }

          const buckets = bucketByWeek(data, { now, weekCount: WEEK_COUNT, weekStartsOn })
          return (
            <div className="space-y-5">
            <Card className="p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-wide uppercase">
                    Volume par semaine
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Charge × répétitions des séries terminées, hors échauffement — {WEEK_COUNT}{' '}
                    dernières semaines, en {weightUnit}.
                  </p>
                </div>
                <SegmentedControl label="Affichage" value={view} options={VIEWS} onChange={setView} />
              </div>

              {view === 'chart' ? (
                <WeeklyVolumeChart buckets={buckets} unit={weightUnit} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-line text-left text-xs tracking-wider text-muted uppercase">
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Semaine du
                        </th>
                        <th scope="col" className="py-2 pr-4 text-right font-medium">
                          Séances
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Volume
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {[...buckets].reverse().map((bucket) => (
                        <tr key={bucket.weekStart}>
                          <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                            {formatShortDate(bucket.weekStart)}
                          </th>
                          <td className="py-2.5 pr-4 text-right">{bucket.workoutCount}</td>
                          <td className="py-2.5 text-right">
                            {formatVolume(bucket.volumeKg, weightUnit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <ExerciseProgressSection />
            </div>
          )
        }}
      </QueryView>
    </>
  )
}
