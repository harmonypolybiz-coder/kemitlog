import { FlaskConical, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SectionCard } from '@/components/ui/Card'
import { Notice, QueryView } from '@/components/ui/States'
import { clearOrigin } from '@/db/backup'
import { db } from '@/db/database'
import { disableDemoMode, enableDemoMode } from '@/db/demo/demoMode'
import { useDbQuery } from '@/hooks/useDbQuery'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatBytes, plural } from '@/lib/format'

type Feedback = { tone: 'success' | 'error'; message: string }

// ───────────────────────────── Mode démonstration ─────────────────────────────

export function DemoSection() {
  const { dataScope } = usePreferences()
  const active = dataScope === 'demo'
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setPending(true)
    setError(null)
    try {
      await (active ? disableDemoMode() : enableDemoMode())
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <SectionCard
      id="demo"
      title="Mode démonstration"
      description="Affiche un jeu de données fictif (8 semaines de séances) pour découvrir l’application. Il remplace temporairement l’affichage de vos données réelles, sans les modifier, et il est effacé dès que vous quittez la démo."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button variant={active ? 'secondary' : 'primary'} onClick={toggle} disabled={pending}>
          <FlaskConical className="size-4" aria-hidden />
          {active ? 'Quitter le mode démonstration' : 'Activer le mode démonstration'}
        </Button>
        {active && <Badge tone="demo">Démo active — lecture seule</Badge>}
      </div>
      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </SectionCard>
  )
}

// ───────────────────────────── Stockage ─────────────────────────────

interface StorageStatus {
  supported: boolean
  persisted: boolean
  usage?: number
}

async function readStorageStatus(): Promise<StorageStatus> {
  if (!navigator.storage?.persisted) return { supported: false, persisted: false }
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted(),
    navigator.storage.estimate?.() ?? Promise.resolve(undefined),
  ])
  return { supported: true, persisted, usage: estimate?.usage }
}

export function StorageSection() {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const counts = useDbQuery(async () => ({
    exercises: await db.exercises.where('origin').equals('user').count(),
    workouts: await db.workouts.where('origin').equals('user').count(),
    sets: await db.sets.where('origin').equals('user').count(),
  }))

  useEffect(() => {
    let cancelled = false
    readStorageStatus()
      .then((value) => {
        if (!cancelled) setStatus(value)
      })
      .catch(() => {
        if (!cancelled) setStatus({ supported: false, persisted: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function requestPersistence() {
    setFeedback(null)
    try {
      const granted = await navigator.storage.persist()
      setStatus(await readStorageStatus())
      setFeedback(
        granted
          ? { tone: 'success', message: 'Stockage persistant accordé par le navigateur.' }
          : {
              tone: 'error',
              message:
                'Le navigateur a refusé le stockage persistant. Il l’accorde plus facilement une fois l’application installée ; en attendant, pensez à exporter vos données.',
            },
      )
    } catch (cause) {
      setFeedback({ tone: 'error', message: errorMessage(cause) })
    }
  }

  return (
    <SectionCard
      title="Stockage local"
      description="Vos données réelles sont enregistrées dans ce navigateur (IndexedDB), sans compte ni serveur."
    >
      <div className="space-y-4">
        <QueryView query={counts} loadingLabel="Lecture du stockage…">
          {(data) => (
            <p className="text-sm tabular-nums">
              {plural(data.exercises, 'exercice')} · {plural(data.workouts, 'séance')} ·{' '}
              {plural(data.sets, 'série')}
              {status?.usage !== undefined && (
                <span className="text-subtle"> · environ {formatBytes(status.usage)} utilisés</span>
              )}
            </p>
          )}
        </QueryView>

        {status === null ? null : !status.supported ? (
          <p className="text-sm text-muted">
            Ce navigateur n’indique pas si le stockage est protégé contre le nettoyage automatique.
            Exportez régulièrement vos données.
          </p>
        ) : status.persisted ? (
          <p className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4 shrink-0 text-accent" aria-hidden />
            Stockage persistant : le navigateur ne supprimera pas vos données automatiquement.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Le stockage n’est pas marqué comme persistant : le navigateur peut effacer les données
              s’il manque d’espace.
            </p>
            <Button onClick={requestPersistence}>
              <ShieldCheck className="size-4" aria-hidden />
              Demander le stockage persistant
            </Button>
          </div>
        )}

        {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}
      </div>
    </SectionCard>
  )
}

// ───────────────────────────── Suppression ─────────────────────────────

export function DangerSection() {
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  async function erase() {
    setPending(true)
    setFeedback(null)
    try {
      await clearOrigin('user')
      setFeedback({ tone: 'success', message: 'Toutes vos données réelles ont été supprimées.' })
    } catch (cause) {
      setFeedback({ tone: 'error', message: errorMessage(cause) })
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  return (
    <SectionCard
      title="Zone sensible"
      description="Supprime définitivement vos exercices, séances, séries et programmes de cet appareil. Vos préférences sont conservées."
    >
      <div className="space-y-4">
        {confirming ? (
          <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
            <p className="text-sm">
              Cette action est irréversible. Sans export préalable, vos données seront perdues.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" onClick={erase} disabled={pending}>
                {pending ? 'Suppression…' : 'Oui, tout supprimer'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger"
            onClick={() => {
              setFeedback(null)
              setConfirming(true)
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            Supprimer toutes mes données
          </Button>
        )}
        {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}
      </div>
    </SectionCard>
  )
}
