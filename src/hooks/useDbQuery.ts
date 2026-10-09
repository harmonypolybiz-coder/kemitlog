import { useLiveQuery } from 'dexie-react-hooks'

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: T }

const LOADING: QueryState<never> = { status: 'loading' }

/**
 * Requête réactive sur la base : se relance dès qu'une table lue est modifiée
 * (y compris depuis un autre onglet) et expose explicitement les états de
 * chargement et d'erreur au lieu de les laisser implicites.
 */
export function useDbQuery<T>(querier: () => Promise<T>, deps: unknown[] = []): QueryState<T> {
  const state = useLiveQuery<QueryState<T>>(async () => {
    try {
      return { status: 'success', data: await querier() }
    } catch (error) {
      console.error('[KEMITLOG] Échec de lecture de la base', error)
      return { status: 'error', error }
    }
  }, deps)
  return state ?? LOADING
}
