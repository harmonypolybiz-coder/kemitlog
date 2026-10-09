import { Check, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { deleteSet, saveSet } from '@/db/session'
import { errorMessage } from '@/lib/format'
import { SET_TYPE_LABELS as TYPE_LABELS } from '@/lib/labels'
import {
  fieldLabel,
  FIELDS_BY_TRACKING,
  parseFieldTexts,
  toFieldTexts,
  type SetField,
  type SetFieldTexts,
} from '@/lib/setInput'
import type { SetType, TrackingType, WeightUnit, WorkoutSet } from '@/types/models'

/** Ordre de bascule du type : du plus courant au plus rare. */
const TYPE_CYCLE: readonly SetType[] = ['normal', 'warmup', 'drop', 'failure']

const TYPE_BADGES: Record<Exclude<SetType, 'normal'>, string> = {
  warmup: 'É',
  drop: 'D',
  failure: 'X',
}

function sameTexts(a: SetFieldTexts, b: SetFieldTexts): boolean {
  return (['weight', 'reps', 'distance', 'duration'] as const).every(
    (field) => (a[field] ?? '').trim() === (b[field] ?? '').trim(),
  )
}

interface SetRowProps {
  set: WorkoutSet
  /** Numéro parmi les séries de travail (les échauffements ne sont pas numérotés). */
  workingNumber: number
  trackingType: TrackingType
  /** Série correspondante de la dernière séance, affichée en indication dans les champs. */
  previous: WorkoutSet | undefined
  unit: WeightUnit
  restSec: number
}

/**
 * Une série en cours de saisie. Les champs sont enregistrés à la sortie du champ ;
 * le bouton de validation (ou la touche Entrée) enregistre et valide en un geste.
 */
export function SetRow({ set, workingNumber, trackingType, previous, unit, restSec }: SetRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [texts, setTexts] = useState(() => toFieldTexts(set, trackingType, unit))
  const [error, setError] = useState<string | null>(null)
  // Les écritures s'enchaînent dans l'ordre. Les boutons ne sont jamais désactivés pendant
  // un enregistrement : quitter un champ en touchant « Valider » ne doit pas perdre le geste.
  const queue = useRef<Promise<void>>(Promise.resolve())

  const stored = toFieldTexts(set, trackingType, unit)
  const hints = previous ? toFieldTexts(previous, trackingType, unit) : {}

  // Reprend les valeurs enregistrées (autre onglet, changement d'unité…) sauf pendant la saisie.
  // La clé textuelle ne change que si une valeur affichée change réellement.
  const storedKey = JSON.stringify(stored)
  useEffect(() => {
    if (rowRef.current?.contains(document.activeElement)) return
    setTexts(JSON.parse(storedKey) as SetFieldTexts)
  }, [storedKey])

  function run(action: () => Promise<unknown>) {
    queue.current = queue.current.then(async () => {
      try {
        await action()
        setError(null)
      } catch (cause) {
        setError(errorMessage(cause))
      }
    })
  }

  /** Enregistre les champs s'ils ont changé ; `completed` valide ou dévalide en même temps. */
  function commit(completed?: boolean) {
    if (completed === undefined && sameTexts(texts, stored)) return
    const typed = texts
    run(async () => {
      const values = sameTexts(typed, stored) ? undefined : parseFieldTexts(typed, trackingType, unit)
      const saved = await saveSet(set.id, { values, completed }, { restSec })
      // Normalise l'affichage (« 60,0 » → « 60 »), sauf si la saisie a continué entre-temps.
      setTexts((current) =>
        sameTexts(current, typed) ? toFieldTexts(saved, trackingType, unit) : current,
      )
    })
  }

  function cycleType() {
    const next = TYPE_CYCLE[(TYPE_CYCLE.indexOf(set.type) + 1) % TYPE_CYCLE.length] ?? 'normal'
    run(() => saveSet(set.id, { type: next }))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit(set.completed ? undefined : true)
  }

  const fields: readonly SetField[] = FIELDS_BY_TRACKING[trackingType]
  const name = set.type === 'normal' ? `Série ${workingNumber}` : `Série ${TYPE_LABELS[set.type]}`

  return (
    <div ref={rowRef} className={`px-3 py-2 sm:px-4 ${set.completed ? 'bg-accent/5' : ''}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={cycleType}
          aria-label={`${name}. Changer le type de série (actuel : ${TYPE_LABELS[set.type]})`}
          title={`Type : ${TYPE_LABELS[set.type]} — toucher pour changer`}
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl font-display text-xl font-semibold tabular-nums hover:bg-raised ${
            set.type === 'normal' ? 'text-muted' : 'text-demo'
          }`}
        >
          {set.type === 'normal' ? workingNumber : TYPE_BADGES[set.type]}
        </button>

        <div className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-2">
          {fields.map((field) => (
            <input
              key={field}
              type="text"
              inputMode={field === 'reps' || field === 'duration' ? 'numeric' : 'decimal'}
              enterKeyHint="done"
              autoComplete="off"
              value={texts[field] ?? ''}
              placeholder={hints[field] || '—'}
              aria-label={`${name}, ${fieldLabel(field, trackingType, unit)}`}
              onChange={(event) => setTexts({ ...texts, [field]: event.target.value })}
              onFocus={(event) => event.target.select()}
              onBlur={() => commit()}
              onKeyDown={onKeyDown}
              className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-canvas px-2 text-center text-base font-semibold tabular-nums placeholder:font-normal placeholder:text-subtle focus:border-accent"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => commit(!set.completed)}
          aria-pressed={set.completed}
          aria-label={set.completed ? `${name} validée. Annuler la validation` : `Valider : ${name}`}
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            set.completed
              ? 'border-accent bg-accent text-on-accent'
              : 'border-line bg-raised text-muted hover:border-accent hover:text-accent'
          }`}
        >
          <Check className="size-5" strokeWidth={3} aria-hidden />
        </button>

        {/* Une série validée doit d'abord être dévalidée : pas de suppression par mégarde. */}
        <button
          type="button"
          onClick={() => run(() => deleteSet(set.id))}
          disabled={set.completed}
          aria-label={`Supprimer : ${name}`}
          title={set.completed ? 'Annulez la validation pour pouvoir supprimer' : 'Supprimer la série'}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-subtle hover:bg-raised hover:text-danger disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-subtle"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 pl-13 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
