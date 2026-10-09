import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui/Button'

/**
 * Enregistre le service worker et signale les deux moments utiles :
 * l'application est prête hors ligne, ou une nouvelle version attend d'être activée.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-2xl border border-line bg-raised p-4 shadow-2xl lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
    >
      <p className="min-w-0 flex-1 text-sm">
        {needRefresh
          ? 'Une nouvelle version de KEMITLOG est disponible.'
          : 'KEMITLOG est prêt à fonctionner hors ligne.'}
      </p>
      {needRefresh && (
        <Button variant="primary" size="sm" onClick={() => void updateServiceWorker(true)}>
          Mettre à jour
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOfflineReady(false)
          setNeedRefresh(false)
        }}
      >
        Fermer
      </Button>
    </div>
  )
}
