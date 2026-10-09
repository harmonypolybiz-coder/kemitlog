import type { LucideIcon } from 'lucide-react'
import { Card } from './Card'

interface StatTileProps {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}

export function StatTile({ icon: Icon, label, value, hint }: StatTileProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate text-xs font-medium tracking-wider uppercase">{label}</span>
      </div>
      <p className="mt-3 font-display text-4xl leading-none font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-xs text-subtle">{hint}</p>}
    </Card>
  )
}
