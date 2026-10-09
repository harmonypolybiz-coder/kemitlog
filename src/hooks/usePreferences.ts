import { createContext, useContext } from 'react'
import type { Preferences } from '@/types/models'

export const PreferencesContext = createContext<Preferences | null>(null)

/** Préférences courantes. Disponible sous `AppShell`, une fois la base ouverte. */
export function usePreferences(): Preferences {
  const preferences = useContext(PreferencesContext)
  if (!preferences) {
    throw new Error('usePreferences doit être utilisé à l’intérieur de AppShell.')
  }
  return preferences
}
