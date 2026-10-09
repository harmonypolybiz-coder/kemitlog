import { Link, NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import { PRIMARY_NAV_ITEMS, ROUTES, SETTINGS_NAV_ITEM } from './navigation'

/** En-tête compact (logo + accès aux paramètres), masqué quand la barre latérale est visible. */
export function MobileHeader() {
  const SettingsIcon = SETTINGS_NAV_ITEM.icon
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
      <Link to={ROUTES.dashboard} className="rounded-lg py-3" aria-label="KEMITLOG, accueil">
        <Logo />
      </Link>
      <NavLink
        to={SETTINGS_NAV_ITEM.path}
        aria-label={SETTINGS_NAV_ITEM.label}
        className={({ isActive }) =>
          `flex size-11 items-center justify-center rounded-xl transition-colors ${
            isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-raised hover:text-fg'
          }`
        }
      >
        <SettingsIcon className="size-5" aria-hidden />
      </NavLink>
    </header>
  )
}

/** Barre d'onglets fixée en bas de l'écran sur mobile et tablette. */
export function BottomNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const featured = item.path === ROUTES.training
          return (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === ROUTES.dashboard}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    isActive ? 'text-accent' : 'text-muted hover:text-fg'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-12 items-center justify-center rounded-full ${
                        featured
                          ? 'bg-accent text-on-accent'
                          : isActive
                            ? 'bg-accent/10'
                            : ''
                      }`}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    {item.shortLabel}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
