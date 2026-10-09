import { Link, NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import {
  PRIMARY_NAV_ITEMS,
  PROGRAMS_NAV_ITEM,
  ROUTES,
  SETTINGS_NAV_ITEM,
  type NavItem,
} from './navigation'

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === ROUTES.dashboard}
      className={({ isActive }) =>
        `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
          isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-raised hover:text-fg'
        }`
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}

/** Navigation latérale, affichée à partir de la largeur « lg ». */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
      <Link to={ROUTES.dashboard} className="mb-8 self-start rounded-lg px-2" aria-label="KEMITLOG, accueil">
        <Logo />
      </Link>
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <SidebarLink key={item.path} item={item} />
        ))}
        <SidebarLink item={PROGRAMS_NAV_ITEM} />
        <div className="mt-auto border-t border-line pt-3">
          <SidebarLink item={SETTINGS_NAV_ITEM} />
        </div>
      </nav>
    </aside>
  )
}
