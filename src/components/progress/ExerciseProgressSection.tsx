import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExerciseProgressChart } from '@/components/charts/ExerciseProgressChart'
import { EXERCISE_PARAM, workoutPath } from '@/components/layout/navigation'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { SelectField } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { QueryView } from '@/components/ui/States'
import { StatTile } from '@/components/ui/StatTile'
import { getExerciseHistory, listTrainedExercises } from '@/db/progress'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { DAY_MS } from '@/lib/dates'
import { formatDate, formatShortDate, plural } from '@/lib/format'
import { MUSCLE_GROUP_LABELS } from '@/lib/labels'
import {
  buildSeries,
  computeTrend,
  findRecord,
  formatMetricValue,
  METRICS_BY_TRACKING,
  type ExerciseSession,
  type ProgressMetric,
  type ProgressPoint,
} from '@/lib/progress'
import type { Exercise } from '@/types/models'

type Period = '3m' | '1y' | 'all'
type View = 'chart' | 'table'

const PERIODS: Array<{ value: Period; label: string; days?: number }> = [
  { value: '3m', label: '3 mois', days: 92 },
  { value: '1y', label: '1 an', days: 366 },
  { value: 'all', label: 'Tout' },
]

const VIEWS: Array<{ value: View; label: string }> = [
  { value: 'chart', label: 'Graphique' },
  { value: 'table', label: 'Tableau' },
]

function describeTrend(points: ProgressPoint[], metric: ProgressMetric, unit: 'kg' | 'lb'): string | null {
  const trend = computeTrend(points)
  if (!trend) return null
  const since = `depuis le ${formatShortDate(trend.first.date)}`
  if (trend.delta === 0) return `Stable ${since}.`
  const amount = formatMetricValue(Math.abs(trend.delta), metric.kind, unit)
  const percent = Math.abs(trend.ratio).toLocaleString('fr-FR', {
    style: 'percent',
    maximumFractionDigits: 1,
  })
  return `${trend.delta > 0 ? '+' : '−'} ${amount} (${percent}) ${since}.`
}

function ExerciseProgress({ exercise, sessions }: { exercise: Exercise; sessions: ExerciseSession[] }) {
  const { weightUnit } = usePreferences()
  const metrics = METRICS_BY_TRACKING[exercise.trackingType]
  const [metricId, setMetricId] = useState(metrics[0]?.id ?? '')
  const [period, setPeriod] = useState<Period>('all')
  const [view, setView] = useState<View>('chart')

  const metric = metrics.find((item) => item.id === metricId) ?? metrics[0]
  if (!metric) return null

  const days = PERIODS.find((option) => option.value === period)?.days
  const since = days === undefined ? -Infinity : Date.now() - days * DAY_MS
  const allPoints = buildSeries(sessions, metric)
  const points = allPoints.filter((point) => point.date >= since)
  const record = findRecord(points)
  const trend = describeTrend(points, metric, weightUnit)

  return (
    <div className="space-y-5">
      {/* Records : toujours calculés sur tout l'historique, quelle que soit la période affichée. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((item) => {
          const best = findRecord(buildSeries(sessions, item))
          return (
            <StatTile
              key={item.id}
              icon={Trophy}
              label={`Record · ${item.label}`}
              value={best ? formatMetricValue(best.value, item.kind, weightUnit) : '—'}
              hint={best ? `le ${formatShortDate(best.date)}` : 'pas encore de valeur'}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl
          label="Mesure"
          value={metric.id}
          onChange={setMetricId}
          options={metrics.map((item) => ({ value: item.id, label: item.label }))}
        />
        <SegmentedControl label="Période" value={period} onChange={setPeriod} options={PERIODS} />
        <div className="sm:ml-auto">
          <SegmentedControl label="Affichage" value={view} onChange={setView} options={VIEWS} />
        </div>
      </div>

      {points.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          {allPoints.length === 0
            ? `Aucune séance ne permet de calculer « ${metric.label} » pour cet exercice.`
            : 'Aucune séance sur cette période. Élargissez la période pour voir vos données.'}
        </p>
      ) : view === 'chart' ? (
        <ExerciseProgressChart
          points={points}
          label={metric.label}
          kind={metric.kind}
          unit={weightUnit}
          recordId={record?.workoutId}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-xs tracking-wider text-muted uppercase">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Séance
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  {metric.label}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...points].reverse().map((point) => (
                <tr key={point.workoutId}>
                  <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                    <Link to={workoutPath(point.workoutId)} className="hover:text-accent">
                      <span className="block first-letter:uppercase">{formatDate(point.date)}</span>
                      <span className="block text-xs text-subtle">{point.workoutName}</span>
                    </Link>
                  </th>
                  <td className="py-2.5 text-right">
                    {point.workoutId === record?.workoutId && (
                      <span className="mr-2">
                        <Badge tone="accent">Record</Badge>
                      </span>
                    )}
                    {formatMetricValue(point.value, metric.kind, weightUnit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1 text-sm">
        {points.length === 1 && (
          <p className="text-muted">Une seule séance : il en faut au moins deux pour dégager une tendance.</p>
        )}
        {trend && <p className="font-medium tabular-nums">{trend}</p>}
        <p className="text-subtle">{metric.description}</p>
      </div>
    </div>
  )
}

/** Progression d'un exercice choisi. Le choix est porté par l'adresse (`?exercice=`), donc partageable. */
export function ExerciseProgressSection() {
  const { dataScope } = usePreferences()
  const [params, setParams] = useSearchParams()
  const requestedId = params.get(EXERCISE_PARAM)

  const state = useDbQuery(async () => {
    const trained = await listTrainedExercises(dataScope)
    const selected = trained.find((item) => item.exercise.id === requestedId) ?? trained[0]
    return {
      trained,
      selected,
      sessions: selected ? await getExerciseHistory(selected.exercise.id, dataScope) : [],
    }
  }, [dataScope, requestedId])

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="font-display text-xl font-semibold tracking-wide uppercase">
        Progression par exercice
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted">
        Une valeur par séance terminée, calculée sur les séries validées hors échauffement.
      </p>
      <QueryView query={state} loadingLabel="Calcul de la progression…">
        {({ trained, selected, sessions }) =>
          !selected ? (
            <p className="text-sm text-muted">
              Aucun exercice n’a encore de série de travail validée dans une séance terminée.
            </p>
          ) : (
            <div className="space-y-5">
              <SelectField
                label="Exercice"
                hint={`${MUSCLE_GROUP_LABELS[selected.exercise.muscleGroup]} · ${plural(selected.sessionCount, 'séance')} · dernière le ${formatShortDate(selected.lastAt)}`}
                value={selected.exercise.id}
                options={trained.map((item) => ({
                  value: item.exercise.id,
                  label: `${item.exercise.name} (${item.sessionCount})`,
                }))}
                onChange={(id) => setParams({ [EXERCISE_PARAM]: id }, { replace: true })}
              />
              {/* La clé réinitialise mesure et période quand on change d'exercice. */}
              <ExerciseProgress key={selected.exercise.id} exercise={selected.exercise} sessions={sessions} />
            </div>
          )
        }
      </QueryView>
    </Card>
  )
}
