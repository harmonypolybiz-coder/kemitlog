import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`} {...props} />
}

interface SectionCardProps {
  title: string
  description?: ReactNode
  children: ReactNode
  id?: string
}

/** Carte titrée, utilisée pour les blocs de réglages et de contenu. */
export function SectionCard({ title, description, children, id }: SectionCardProps) {
  return (
    <Card id={id} className="scroll-mt-24 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold tracking-wide uppercase">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  )
}
