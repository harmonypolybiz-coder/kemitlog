import { PREFERENCES_ID, type Preferences } from '@/types/models'
import { db, type KemitlogDatabase } from './database'

export const DEFAULT_PREFERENCES: Preferences = {
  id: PREFERENCES_ID,
  weightUnit: 'kg',
  defaultRestSec: 90,
  weekStartsOn: 1,
  dataScope: 'user',
  updatedAt: 0,
}

/** Lecture seule : renvoie les valeurs par défaut tant que rien n'a été enregistré. */
export async function getPreferences(database: KemitlogDatabase = db): Promise<Preferences> {
  const stored = await database.preferences.get(PREFERENCES_ID)
  return { ...DEFAULT_PREFERENCES, ...stored, id: PREFERENCES_ID }
}

export type PreferencesPatch = Partial<Omit<Preferences, 'id' | 'updatedAt'>>

export async function updatePreferences(
  patch: PreferencesPatch,
  database: KemitlogDatabase = db,
): Promise<Preferences> {
  return database.transaction('rw', database.preferences, async () => {
    const next: Preferences = {
      ...(await getPreferences(database)),
      ...patch,
      updatedAt: Date.now(),
    }
    await database.preferences.put(next)
    return next
  })
}
