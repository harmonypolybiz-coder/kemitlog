import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate, kgToUnit, plural } from '@/lib/format'
import type { WeekBucket } from '@/lib/stats'
import type { WeightUnit } from '@/types/models'

interface ChartPoint {
  weekStart: number
  label: string
  volume: number
  workoutCount: number
}

interface TooltipContentProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ChartPoint }>
  unit: WeightUnit
}

function VolumeTooltip({ active, payload, unit }: TooltipContentProps) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-xl border border-line bg-raised px-3 py-2 text-xs shadow-xl">
      <p className="text-muted">Semaine du {point.label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {point.volume.toLocaleString('fr-FR')} {unit}
      </p>
      <p className="text-muted">{plural(point.workoutCount, 'séance')}</p>
    </div>
  )
}

interface WeeklyVolumeChartProps {
  buckets: WeekBucket[]
  unit: WeightUnit
}

/** Volume hebdomadaire (une seule série : le titre de la carte la nomme, sans légende). */
export function WeeklyVolumeChart({ buckets, unit }: WeeklyVolumeChartProps) {
  const points: ChartPoint[] = buckets.map((bucket) => ({
    weekStart: bucket.weekStart,
    label: formatShortDate(bucket.weekStart),
    volume: Math.round(kgToUnit(bucket.volumeKg, unit)),
    workoutCount: bucket.workoutCount,
  }))

  return (
    <div className="h-64 w-full sm:h-72" role="img" aria-label={`Volume par semaine en ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={{ fill: 'var(--color-subtle)', fontSize: 11 }}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-subtle)', fontSize: 11 }}
            tickFormatter={(value: number) =>
              value.toLocaleString('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
            }
          />
          <Tooltip
            cursor={{ fill: 'var(--color-fg)', fillOpacity: 0.05 }}
            content={<VolumeTooltip unit={unit} />}
            isAnimationActive={false}
          />
          <Bar
            dataKey="volume"
            fill="var(--color-accent)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
