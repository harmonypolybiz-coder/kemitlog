import { Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { adjustRest, stopRest } from '@/db/session'
import { useNow } from '@/hooks/useNow'
import { errorMessage, formatClock } from '@/lib/format'
import type { Workout } from '@/types/models'

const STEP_SEC = 15
/** Durée d'affichage de « Repos terminé » avant que la barre ne disparaisse d'elle-même. */
const FINISHED_NOTICE_MS = 30_000

const BAR_BUTTON =
  'min-h-10 rounded-lg border border-line bg-surface px-3 text-sm font-semibold tabular-nums hover:border-subtle disabled:opacity-50'

/**
 * Minuteur de repos, fixé au-dessus de la barre d'onglets. L'heure de fin vient
 * de la base : le décompte reste juste après une actualisation ou une mise en veille.
 */
export function RestTimerBar({ workout }: { workout: Workout }) {
  const now = useNow(250)
  const [error, setError] = useState<string | null>(null)
  const { restEndsAt, restDurationSec } = workout
  const remainingMs = restEndsAt === undefined ? undefined : restEndsAt - now
  const running = remainingMs !== undefined && remainingMs > 0

  // Vibration à la fin du repos, uniquement si le décompte s'est terminé sous nos yeux.
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running && restEndsAt !== undefined) {
      navigator.vibrate?.([200, 100, 200])
    }
    wasRunning.current = running
  }, [running, restEndsAt])

  if (remainingMs === undefined || remainingMs < -FINISHED_NOTICE_MS) return null

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const progress =
    running && restDurationSec ? Math.min(1, remainingMs / (restDurationSec * 1000)) : 0

  return (
    <div
      role="timer"
      aria-label="Minuteur de repos"
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-3 lg:bottom-4 lg:left-64"
    >
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <Timer className={`size-5 shrink-0 ${running ? 'text-accent' : 'text-muted'}`} aria-hidden />
          {running ? (
            <>
              <p className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium tracking-wider text-muted uppercase">
                  Repos
                </span>
                <span className="font-display text-3xl leading-none font-bold tabular-nums">
                  {formatClock(Math.ceil(remainingMs / 1000))}
                </span>
              </p>
              <button
                type="button"
                className={BAR_BUTTON}
                onClick={() => void run(() => adjustRest(workout.id, -STEP_SEC))}
                aria-label={`Retirer ${STEP_SEC} secondes de repos`}
              >
                −{STEP_SEC} s
              </button>
              <button
                type="button"
                className={BAR_BUTTON}
                onClick={() => void run(() => adjustRest(workout.id, STEP_SEC))}
                aria-label={`Ajouter ${STEP_SEC} secondes de repos`}
              >
                +{STEP_SEC} s
              </button>
              <button
                type="button"
                className={BAR_BUTTON}
                onClick={() => void run(() => stopRest(workout.id))}
              >
                Passer
              </button>
            </>
          ) : (
            <>
              <p className="min-w-0 flex-1 font-semibold">Repos terminé — c’est reparti !</p>
              <button
                type="button"
                className={BAR_BUTTON}
                onClick={() => void run(() => stopRest(workout.id))}
              >
                OK
              </button>
            </>
          )}
        </div>
        {error && (
          <p role="alert" className="px-4 pb-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="h-1 bg-line" aria-hidden>
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  )
}
