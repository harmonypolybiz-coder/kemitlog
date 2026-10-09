import { ROUTES } from '@/components/layout/navigation'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getActiveWorkout } from '@/db/session'
import { useDbQuery } from '@/hooks/useDbQuery'
import { useNow } from '@/hooks/useNow'
import { usePreferences } from '@/hooks/usePreferences'
import { formatDuration } from '@/lib/format'
import type { Workout } from '@/types/models'

function Banner({ workout }: { workout: Workout }) {
  const now = useNow(30_000)
  return (
    <Card className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-accent/40 bg-accent/5 p-4">
      <span className="relative flex size-3 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-3 rounded-full bg-accent" />
      </span>
      <p className="min-w-0 flex-1 basis-48">
        <span className="block font-semibold">Séance en cours : {workout.name}</span>
        <span className="block text-sm text-muted">
          Commencée il y a {formatDuration(Math.max(0, (now - workout.startedAt) / 1000))}
        </span>
      </p>
      <ButtonLink to={ROUTES.training} variant="primary">
        Reprendre
      </ButtonLink>
    </Card>
  )
}

/** Rappel de la séance réelle en cours, s'il y en a une. Rien en mode démonstration. */
export function ActiveWorkoutBanner() {
  const { dataScope } = usePreferences()
  const active = useDbQuery(() => getActiveWorkout())
  if (dataScope !== 'user' || active.status !== 'success' || !active.data) return null
  return <Banner workout={active.data} />
}
