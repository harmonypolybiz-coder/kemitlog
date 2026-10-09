import { History, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import { ROUTES } from '@/components/layout/navigation'
import { Button, ButtonLink } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, QueryView } from '@/components/ui/States'
import { WorkoutSummaryCard } from '@/components/workouts/WorkoutSummaryCard'
import { listCompletedWorkoutSummaries, type WorkoutListItem } from '@/db/workouts'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { formatMonth, formatVolume, plural } from '@/lib/format'
import { matchesSearch } from '@/lib/search'

interface MonthGroup {
  month: string
  items: WorkoutListItem[]
  volumeKg: number
}

/** Regroupe les séances (déjà triées par date décroissante) par mois. */
function groupByMonth(summaries: WorkoutListItem[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const summary of summaries) {
    const month = formatMonth(summary.workout.startedAt)
    let current = groups.at(-1)
    if (current?.month !== month) {
      current = { month, items: [], volumeKg: 0 }
      groups.push(current)
    }
    current.items.push(summary)
    current.volumeKg += summary.volumeKg
  }
  return groups
}

export default function HistoryPage() {
  const { dataScope, weightUnit } = usePreferences()
  const summaries = useDbQuery(() => listCompletedWorkoutSummaries(dataScope), [dataScope])
  const [search, setSearch] = useState('')

  return (
    <>
      <PageHeader title="Historique" description="Toutes vos séances terminées, de la plus récente à la plus ancienne." />
      <QueryView query={summaries}>
        {(data) => {
          if (data.length === 0) {
            return (
              <EmptyState
                icon={History}
                title="Votre historique est vide"
                description="Chaque séance terminée sera listée ici, avec ses exercices, ses séries et son volume."
                actions={
                  dataScope === 'user' && (
                    <ButtonLink to={ROUTES.training} variant="primary">
                      Aller à l’entraînement
                    </ButtonLink>
                  )
                }
              />
            )
          }

          const shown = data.filter((summary) =>
            matchesSearch(`${summary.workout.name} ${summary.exerciseNames.join(' ')}`, search),
          )
          return (
            <div className="space-y-6">
              <div>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher une séance ou un exercice"
                    aria-label="Rechercher dans l’historique"
                    className="min-h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-base placeholder:text-subtle focus:border-accent sm:text-sm"
                  />
                </div>
                <p className="mt-2 text-xs text-subtle" aria-live="polite">
                  {plural(shown.length, 'séance')}
                  {search.trim() && ` sur ${data.length}`}
                </p>
              </div>

              {shown.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Aucun résultat"
                  description={`Aucune séance ne correspond à « ${search.trim()} ».`}
                  actions={<Button onClick={() => setSearch('')}>Effacer la recherche</Button>}
                />
              ) : (
                groupByMonth(shown).map((group) => (
                  <section key={group.month} aria-label={group.month}>
                    <div className="mb-3 flex items-baseline justify-between gap-4">
                      <h2 className="font-display text-xl font-semibold tracking-wide uppercase">
                        {group.month}
                      </h2>
                      <span className="text-xs text-subtle tabular-nums">
                        {plural(group.items.length, 'séance')} · {formatVolume(group.volumeKg, weightUnit)}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((summary) => (
                        <WorkoutSummaryCard key={summary.workout.id} summary={summary} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )
        }}
      </QueryView>
    </>
  )
}
