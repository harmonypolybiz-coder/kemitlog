import { Search } from 'lucide-react'
import { MUSCLE_GROUP_LABELS } from '@/lib/labels'
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/models'

export type GroupFilter = MuscleGroup | 'all'

interface ExerciseFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  group: GroupFilter
  onGroupChange: (value: GroupFilter) => void
  /** Nombre d'éléments par groupe pour la recherche en cours ; les groupes vides sont masqués. */
  counts: Partial<Record<MuscleGroup, number>>
}

function Chip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
        active
          ? 'border-accent bg-accent text-on-accent'
          : 'border-line bg-surface text-muted hover:border-subtle hover:text-fg'
      }`}
    >
      {label}
      <span className={`text-xs tabular-nums ${active ? 'opacity-70' : 'text-subtle'}`}>{count}</span>
    </button>
  )
}

export function ExerciseFilters({
  search,
  onSearchChange,
  group,
  onGroupChange,
  counts,
}: ExerciseFiltersProps) {
  const total = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Rechercher par nom, groupe ou matériel"
          aria-label="Rechercher un exercice"
          className="min-h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-base placeholder:text-subtle focus:border-accent sm:text-sm"
        />
      </div>
      {/* Défilement horizontal sur mobile, bord à bord. */}
      <div
        role="group"
        aria-label="Filtrer par groupe musculaire"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0"
      >
        <Chip active={group === 'all'} label="Tous" count={total} onClick={() => onGroupChange('all')} />
        {MUSCLE_GROUPS.filter((value) => (counts[value] ?? 0) > 0 || value === group).map((value) => (
          <Chip
            key={value}
            active={group === value}
            label={MUSCLE_GROUP_LABELS[value]}
            count={counts[value] ?? 0}
            onClick={() => onGroupChange(group === value ? 'all' : value)}
          />
        ))}
      </div>
    </div>
  )
}
