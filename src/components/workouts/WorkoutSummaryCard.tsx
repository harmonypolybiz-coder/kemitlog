import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { workoutPath } from '@/components/layout/navigation'
import type { WorkoutListItem } from '@/db/workouts'
import { usePreferences } from '@/hooks/usePreferences'
import { formatDate, formatDuration, formatVolume, plural } from '@/lib/format'

/** Résumé d'une séance terminée, cliquable vers sa page de détail. */
export function WorkoutSummaryCard({ summary }: { summary: WorkoutListItem }) {
  const { weightUnit } = usePreferences()
  const { workout } = summary

  return (
    <Link
      to={workoutPath(workout.id)}
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-4 transition-colors hover:border-subtle sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{workout.name}</p>
        <p className="mt-0.5 text-sm text-muted first-letter:uppercase">
          {formatDate(workout.startedAt)}
          {summary.durationSec !== undefined && ` · ${formatDuration(summary.durationSec)}`}
        </p>
        {summary.exerciseNames.length > 0 && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{summary.exerciseNames.join(' · ')}</p>
        )}
        <p className="mt-1.5 text-xs text-subtle tabular-nums">
          {plural(summary.exerciseCount, 'exercice')} · {plural(summary.setCount, 'série')} ·{' '}
          {formatVolume(summary.volumeKg, weightUnit)}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  )
}
