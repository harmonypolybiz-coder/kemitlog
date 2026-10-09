import type { SetValues } from '@/db/session'
import type { TrackingType, WeightUnit, WorkoutSet } from '@/types/models'
import { KG_PER_LB, kgToUnit } from './format'

/**
 * Conversion entre les champs de saisie d'une série (texte, dans l'unité de
 * l'utilisateur) et les valeurs stockées (kilogrammes, mètres, secondes).
 */

export type SetField = 'weight' | 'reps' | 'distance' | 'duration'

export const FIELDS_BY_TRACKING: Record<TrackingType, readonly SetField[]> = {
  weight_reps: ['weight', 'reps'],
  bodyweight_reps: ['reps'],
  duration: ['duration'],
  distance_duration: ['distance', 'duration'],
}

export type SetFieldTexts = Partial<Record<SetField, string>>

export class SetInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SetInputError'
  }
}

export function fieldLabel(field: SetField, trackingType: TrackingType, unit: WeightUnit): string {
  switch (field) {
    case 'weight':
      return unit
    case 'reps':
      return 'Rép.'
    case 'distance':
      return 'km'
    case 'duration':
      return trackingType === 'duration' ? 'Durée (s)' : 'Durée (min)'
  }
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits, useGrouping: false })
}

/** Texte affiché dans un champ pour une valeur stockée (chaîne vide si absente). */
export function toFieldTexts(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'distanceM' | 'durationSec'>,
  trackingType: TrackingType,
  unit: WeightUnit,
): SetFieldTexts {
  const texts: SetFieldTexts = {}
  for (const field of FIELDS_BY_TRACKING[trackingType]) {
    texts[field] = ''
    if (field === 'weight' && set.weightKg !== undefined) {
      texts.weight = formatNumber(kgToUnit(set.weightKg, unit), unit === 'kg' ? 2 : 1)
    }
    if (field === 'reps' && set.reps !== undefined) texts.reps = String(set.reps)
    if (field === 'distance' && set.distanceM !== undefined) {
      texts.distance = formatNumber(set.distanceM / 1000, 3)
    }
    if (field === 'duration' && set.durationSec !== undefined) {
      const seconds = Math.round(set.durationSec)
      texts.duration =
        trackingType === 'duration'
          ? String(seconds)
          : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    }
  }
  return texts
}

/** Nombre positif saisi avec une virgule ou un point ; `undefined` si le champ est vide. */
function parsePositive(text: string, label: string): number | undefined {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return undefined
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new SetInputError(`${label} : valeur invalide.`)
  return Number(trimmed)
}

/**
 * Durée en secondes. « m:ss » (ou « h:mm:ss ») est toujours accepté ; un nombre seul
 * vaut des secondes pour un exercice chronométré, des minutes pour du cardio.
 */
export function parseDuration(text: string, trackingType: TrackingType): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':')
    if (parts.length > 3 || !parts.every((part) => /^\d{1,3}$/.test(part))) {
      throw new SetInputError('Durée : utilisez le format m:ss.')
    }
    return parts.reduce((total, part) => total * 60 + Number(part), 0)
  }
  const value = parsePositive(trimmed, 'Durée')
  if (value === undefined) return undefined
  return Math.round(trackingType === 'duration' ? value : value * 60)
}

/** Convertit les champs saisis en valeurs à stocker. Lève `SetInputError` si un champ est illisible. */
export function parseFieldTexts(
  texts: SetFieldTexts,
  trackingType: TrackingType,
  unit: WeightUnit,
): SetValues {
  const values: SetValues = {}
  for (const field of FIELDS_BY_TRACKING[trackingType]) {
    const text = texts[field] ?? ''
    if (field === 'weight') {
      const weight = parsePositive(text, 'Charge')
      if (weight !== undefined) {
        // Arrondi au gramme pour éviter le bruit de conversion des livres.
        values.weightKg = Math.round((unit === 'kg' ? weight : weight * KG_PER_LB) * 1000) / 1000
      }
    }
    if (field === 'reps') {
      const reps = parsePositive(text, 'Répétitions')
      if (reps !== undefined) {
        if (!Number.isInteger(reps)) throw new SetInputError('Répétitions : nombre entier attendu.')
        values.reps = reps
      }
    }
    if (field === 'distance') {
      const km = parsePositive(text, 'Distance')
      if (km !== undefined) values.distanceM = Math.round(km * 1000)
    }
    if (field === 'duration') {
      const seconds = parseDuration(text, trackingType)
      if (seconds !== undefined) values.durationSec = seconds
    }
  }
  return values
}
