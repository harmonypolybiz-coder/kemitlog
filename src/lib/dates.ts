import type { Timestamp } from '@/types/models'

export const DAY_MS = 24 * 60 * 60 * 1000

export function startOfDay(timestamp: Timestamp): Timestamp {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Début (minuit, heure locale) de la semaine contenant `timestamp`. */
export function startOfWeek(timestamp: Timestamp, weekStartsOn: 0 | 1): Timestamp {
  const date = new Date(startOfDay(timestamp))
  const offset = (date.getDay() - weekStartsOn + 7) % 7
  date.setDate(date.getDate() - offset)
  return date.getTime()
}

/** Décale d'un nombre de jours calendaires (insensible aux changements d'heure). */
export function addDays(timestamp: Timestamp, days: number): Timestamp {
  const date = new Date(timestamp)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

/** Valeur d'un champ `<input type="datetime-local">` (heure locale, à la minute). */
export function toDateTimeLocal(timestamp: Timestamp): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Inverse de `toDateTimeLocal` ; `NaN` si la saisie est vide ou illisible. */
export function fromDateTimeLocal(value: string): Timestamp {
  return value ? new Date(value).getTime() : Number.NaN
}
