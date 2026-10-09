import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorState, LoadingState } from '@/components/ui/States'
import { getPreferences } from '@/db/preferences'
import { useDbQuery } from '@/hooks/useDbQuery'
import { PreferencesContext } from '@/hooks/usePreferences'
import { DemoBanner } from './DemoBanner'
import { BottomNav, MobileHeader } from './MobileNav'
import { Sidebar } from './Sidebar'

function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    // Avec une ancre (#section), c'est la page cible qui gère le défilement.
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

/**
 * Cadre de l'application. Le chargement des préférences sert aussi de test
 * d'ouverture de la base : tant qu'elle n'est pas lisible, aucune page ne s'affiche.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const preferences = useDbQuery(() => getPreferences())

  if (preferences.status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState label="Ouverture de vos données…" />
      </div>
    )
  }

  if (preferences.status === 'error') {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-4">
        <ErrorState title="Impossible d’ouvrir la base de données locale" error={preferences.error} />
        <p className="text-center text-sm text-muted">
          KEMITLOG enregistre vos données dans ce navigateur (IndexedDB). Vérifiez que le stockage
          n’est pas bloqué, par exemple par la navigation privée ou un réglage de confidentialité.
        </p>
      </div>
    )
  }

  return (
    <PreferencesContext value={preferences.data}>
      <ScrollToTop />
      <Sidebar />
      <div className="lg:pl-64">
        <MobileHeader />
        {preferences.data.dataScope === 'demo' && <DemoBanner />}
        <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 lg:px-10 lg:pt-10 lg:pb-12">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <BottomNav />
    </PreferencesContext>
  )
}
