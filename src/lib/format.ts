import type { Timestamp, WeightUnit, WorkoutSet } from '@/types/models'
import { DAY_MS, startOfDay } from './dates'

const LOCALE = 'fr-FR'
export const KG_PER_LB = 0.45359237

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

/** Charge d'une série : « 62,5 kg ». */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = kgToUnit(kg, unit)
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: unit === 'kg' ? 2 : 1 })} ${unit}`
}

/** Volume total, arrondi à l'unité : « 12 480 kg ». */
export function formatVolume(kg: number, unit: WeightUnit): string {
  return `${Math.round(kgToUnit(kg, unit)).toLocaleString(LOCALE)} ${unit}`
}

/** Durée courte et exacte, à la seconde : « 45 s », « 1 min 30 », « 2 min ». */
export function formatExactDuration(seconds: number): string {
  const total = Math.round(seconds)
  if (total < 60) return `${total} s`
  const rest = total % 60
  const minutes = Math.floor(total / 60)
  return rest === 0 ? `${minutes} min` : `${minutes} min ${String(rest).padStart(2, '0')}`
}

/** Durée d'une séance, arrondie à la minute : « 45 s », « 58 min », « 1 h 05 ». */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** Chronomètre : « 4:05 », « 1:02:45 ». */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const pad = (value: number) => String(value).padStart(2, '0')
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(total % 60)}`
    : `${minutes}:${pad(total % 60)}`
}

export function formatDistance(meters: number): string {
  return meters >= 1000
    ? `${(meters / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 2 })} km`
    : `${Math.round(meters)} m`
}

/** Contenu d'une série : « 60 kg × 8 rép. », « 9 rép. », « 1 min 30 », « 5 km × 25 min ». */
export function formatSetValues(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'distanceM' | 'durationSec'>,
  unit: WeightUnit,
): string {
  const parts: string[] = []
  if (set.weightKg !== undefined) parts.push(formatWeight(set.weightKg, unit))
  if (set.reps !== undefined) parts.push(`${set.reps} rép.`)
  if (set.distanceM !== undefined) parts.push(formatDistance(set.distanceM))
  if (set.durationSec !== undefined) parts.push(formatExactDuration(set.durationSec))
  return parts.join(' × ') || '—'
}

export function formatDate(timestamp: Timestamp): string {
  return new Date(timestamp).toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Heure seule : « 18:30 ». */
export function formatTime(timestamp: Timestamp): string {
  return new Date(timestamp).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(timestamp: Timestamp): string {
  return new Date(timestamp).toLocaleString(LOCALE, { dateStyle: 'long', timeStyle: 'short' })
}

export function formatShortDate(timestamp: Timestamp): string {
  return new Date(timestamp).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

export function formatMonth(timestamp: Timestamp): string {
  return new Date(timestamp).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}

/** « aujourd'hui », « hier », « il y a 5 jours »… */
export function formatRelativeDay(timestamp: Timestamp, now: Timestamp = Date.now()): string {
  const days = Math.round((startOfDay(timestamp) - startOfDay(now)) / DAY_MS)
  return new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' }).format(days, 'day')
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} Ko`
  return `${(bytes / 1024 ** 2).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} Mo`
}

export function plural(count: number, singular: string, pluralForm: string = `${singular}s`): string {
  return `${count.toLocaleString(LOCALE)} ${count > 1 ? pluralForm : singular}`
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
}
