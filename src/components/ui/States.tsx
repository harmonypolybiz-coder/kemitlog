import { LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { QueryState } from '@/hooks/useDbQuery'
import { errorMessage } from '@/lib/format'
import { Button } from './Button'

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 px-6 py-16 text-muted">
      <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  error?: unknown
  /** Action de reprise ; par défaut, recharge l'application. */
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({
  title = 'Impossible de charger ces données',
  error,
  onRetry = () => window.location.reload(),
  retryLabel = 'Recharger l’application',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-danger/40 bg-danger/5 px-6 py-10 text-center"
    >
      <TriangleAlert className="size-8 text-danger" aria-hidden />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-md text-sm text-muted">
        {error === undefined ? 'Une erreur inattendue est survenue.' : errorMessage(error)}
      </p>
      <Button onClick={onRetry} className="mt-2">
        {retryLabel}
      </Button>
    </div>
  )
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: ReactNode
  /** Actions réelles uniquement (liens ou boutons fonctionnels). */
  actions?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-raised">
        <Icon className="size-7 text-accent" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  )
}

interface QueryViewProps<T> {
  query: QueryState<T>
  loadingLabel?: string
  children: (data: T) => ReactNode
}

/** Affiche l'état de chargement ou d'erreur d'une requête, sinon son contenu. */
export function QueryView<T>({ query, loadingLabel, children }: QueryViewProps<T>) {
  if (query.status === 'loading') return <LoadingState label={loadingLabel} />
  if (query.status === 'error') return <ErrorState error={query.error} />
  return <>{children(query.data)}</>
}

export interface Feedback {
  tone: 'success' | 'error'
  message: string
}

/** Message de retour après une action (succès ou échec). */
export function Notice({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  const style =
    tone === 'success'
      ? 'border-accent/40 bg-accent/10 text-fg'
      : 'border-danger/40 bg-danger/10 text-danger'
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm ${style}`}
    >
      {children}
    </p>
  )
}
