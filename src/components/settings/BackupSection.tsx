import { Download, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { SectionCard } from '@/components/ui/Card'
import { Notice } from '@/components/ui/States'
import {
  backupFileName,
  countBackup,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type BackupCounts,
  type BackupFile,
  type RestoreMode,
} from '@/db/backup'
import { updatePreferences } from '@/db/preferences'
import { usePreferences } from '@/hooks/usePreferences'
import { errorMessage, formatDateTime, plural } from '@/lib/format'

type Feedback = { tone: 'success' | 'error'; message: string }

function describeCounts(counts: BackupCounts): string {
  return [
    plural(counts.exercises, 'exercice'),
    plural(counts.workouts, 'séance'),
    plural(counts.sets, 'série'),
    plural(counts.programs, 'programme'),
  ].join(', ')
}

function downloadTextFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function BackupSection() {
  const { lastExportAt, dataScope } = usePreferences()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  /** Sauvegarde lue et validée, en attente du choix du mode de restauration. */
  const [candidate, setCandidate] = useState<{ fileName: string; backup: BackupFile } | null>(null)

  async function exportData() {
    setPending(true)
    setFeedback(null)
    try {
      const backup = await createBackup()
      downloadTextFile(backupFileName(backup), serializeBackup(backup))
      await updatePreferences({ lastExportAt: backup.exportedAt })
      setFeedback({
        tone: 'success',
        message: `Sauvegarde téléchargée : ${describeCounts(countBackup(backup))}.`,
      })
    } catch (cause) {
      setFeedback({ tone: 'error', message: errorMessage(cause) })
    } finally {
      setPending(false)
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Permet de re-sélectionner le même fichier après une erreur.
    event.target.value = ''
    if (!file) return
    setFeedback(null)
    setCandidate(null)
    try {
      setCandidate({ fileName: file.name, backup: parseBackup(await file.text()) })
    } catch (cause) {
      setFeedback({ tone: 'error', message: errorMessage(cause) })
    }
  }

  async function restore(mode: RestoreMode) {
    if (!candidate) return
    setPending(true)
    setFeedback(null)
    try {
      const counts = await restoreBackup(candidate.backup, mode)
      setCandidate(null)
      setFeedback({
        tone: 'success',
        message: `Restauration terminée (${mode === 'replace' ? 'remplacement' : 'fusion'}) : ${describeCounts(counts)}.${
          dataScope === 'demo' ? ' Quittez le mode démonstration pour voir vos données.' : ''
        }`,
      })
    } catch (cause) {
      setFeedback({
        tone: 'error',
        message: `La restauration a échoué, vos données n’ont pas été modifiées. ${errorMessage(cause)}`,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <SectionCard
      title="Sauvegarde"
      description="Vos données ne quittent jamais cet appareil. Exportez-les régulièrement pour pouvoir les restaurer ou changer d’appareil. Les données de démonstration ne sont jamais exportées."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={exportData} disabled={pending}>
            <Download className="size-4" aria-hidden />
            Exporter mes données
          </Button>
          <Button onClick={() => fileInput.current?.click()} disabled={pending}>
            <Upload className="size-4" aria-hidden />
            Restaurer une sauvegarde…
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={selectFile}
            className="sr-only"
            aria-label="Fichier de sauvegarde KEMITLOG"
            tabIndex={-1}
          />
        </div>
        <p className="text-xs text-subtle">
          {lastExportAt === undefined
            ? 'Aucun export effectué depuis cet appareil.'
            : `Dernier export : ${formatDateTime(lastExportAt)}.`}
        </p>

        {candidate && (
          <div className="rounded-xl border border-line bg-raised p-4">
            <p className="text-sm font-semibold break-all">{candidate.fileName}</p>
            <p className="mt-1 text-sm text-muted">
              Sauvegarde du {formatDateTime(candidate.backup.exportedAt)} —{' '}
              {describeCounts(countBackup(candidate.backup))}.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>
                <strong className="text-fg">Remplacer</strong> : efface toutes vos données réelles
                actuelles, puis importe le fichier.
              </li>
              <li>
                <strong className="text-fg">Fusionner</strong> : conserve vos données et ajoute celles
                du fichier (les éléments identiques sont mis à jour).
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => void restore('replace')} disabled={pending}>
                Remplacer mes données
              </Button>
              <Button onClick={() => void restore('merge')} disabled={pending}>
                Fusionner
              </Button>
              <Button variant="ghost" onClick={() => setCandidate(null)} disabled={pending}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        {feedback && <Notice tone={feedback.tone}>{feedback.message}</Notice>}
      </div>
    </SectionCard>
  )
}
