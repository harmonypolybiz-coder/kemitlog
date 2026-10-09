import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { disableDemoMode } from '@/db/demo/demoMode'
import { errorMessage } from '@/lib/format'

/** Bandeau permanent tant que l'application affiche le jeu de démonstration. */
export function DemoBanner() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function quit() {
    setPending(true)
    setError(null)
    try {
      await disableDemoMode()
    } catch (cause) {
      setError(errorMessage(cause))
      setPending(false)
    }
  }

  return (
    <div role="status" className="border-b border-demo/30 bg-demo/10 px-4 py-2.5 text-sm lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
        <FlaskConical className="size-4 shrink-0 text-demo" aria-hidden />
        <p className="min-w-0 flex-1">
          <strong className="font-semibold text-demo">Mode démonstration.</strong>{' '}
          <span className="text-muted">
            Toutes les données affichées sont fictives. Vos données réelles sont intactes et masquées.
          </span>
        </p>
        <button
          type="button"
          onClick={quit}
          disabled={pending}
          className="min-h-9 rounded-lg border border-demo/50 px-3 font-semibold text-demo hover:bg-demo/15 disabled:opacity-50"
        >
          {pending ? 'Fermeture…' : 'Quitter la démo'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mx-auto mt-1 max-w-5xl text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
