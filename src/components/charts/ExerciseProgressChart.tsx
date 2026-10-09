import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DAY_MS } from '@/lib/dates'
import { formatDate, formatShortDate } from '@/lib/format'
import {
  axisUnitLabel,
  formatAxisTick,
  formatMetricValue,
  toAxisValue,
  type MetricKind,
  type ProgressPoint,
} from '@/lib/progress'
import type { WeightUnit } from '@/types/models'

interface ChartPoint extends ProgressPoint {
  /** Valeur dans l'unité affichée sur l'axe vertical. */
  axis: number
}

interface TooltipContentProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ChartPoint }>
  kind: MetricKind
  unit: WeightUnit
  recordId: string | undefined
}

function PointTooltip({ active, payload, kind, unit, recordId }: TooltipContentProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2 text-xs shadow-xl">
      <p className="text-muted first-letter:uppercase">{formatDate(point.date)}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {formatMetricValue(point.value, kind, unit)}
        {point.workoutId === recordId && <span className="font-normal text-muted"> · record</span>}
      </p>
      <p className="text-muted">{point.workoutName}</p>
    </div>
  )
}

interface ExerciseProgressChartProps {
  points: ProgressPoint[]
  /** Nom de la mesure, pour la description accessible du graphique. */
  label: string
  kind: MetricKind
  unit: WeightUnit
  /** Séance du record sur la période affichée, signalée dans l'infobulle. */
  recordId: string | undefined
}

/**
 * Une valeur par séance, placée à sa date (l'écart entre deux points reflète le
 * temps écoulé). Série unique : pas de légende, le titre de la carte la nomme.
 */
export function ExerciseProgressChart({ points, label, kind, unit, recordId }: ExerciseProgressChartProps) {
  const data: ChartPoint[] = points.map((point) => ({
    ...point,
    axis: toAxisValue(point.value, kind, unit),
  }))
  // Avec une seule séance, on ouvre l'axe d'un jour de chaque côté pour centrer le point.
  const only = data.length === 1 ? data[0] : undefined
  const domain: [number | string, number | string] = only
    ? [only.date - DAY_MS, only.date + DAY_MS]
    : ['dataMin', 'dataMax']

  return (
    <div
      className="h-64 w-full sm:h-72"
      role="img"
      aria-label={`${label} par séance, en ${axisUnitLabel(kind, unit)}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={domain}
            padding={{ left: 12, right: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={{ fill: 'var(--color-subtle)', fontSize: 11 }}
            tickMargin={8}
            minTickGap={32}
            tickFormatter={(value: number) => formatShortDate(value)}
          />
          <YAxis
            width={48}
            domain={['auto', 'auto']}
            allowDecimals={kind !== 'reps'}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-subtle)', fontSize: 11 }}
            tickFormatter={(value: number) => formatAxisTick(value, kind)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--color-subtle)', strokeDasharray: '3 3' }}
            content={<PointTooltip kind={kind} unit={unit} recordId={recordId} />}
            isAnimationActive={false}
          />
          <Line
            dataKey="axis"
            type="linear"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 5, fill: 'var(--color-accent)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: 'var(--color-accent)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
