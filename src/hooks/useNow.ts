import { useEffect, useState } from 'react'

/**
 * Heure courante, rafraîchie à intervalle régulier. À utiliser dans de petits
 * composants (chronomètre, minuteur) pour ne pas redessiner tout l'écran.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
