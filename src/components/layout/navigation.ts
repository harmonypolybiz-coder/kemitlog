import {
  ClipboardList,
  Dumbbell,
  History,
  LayoutDashboard,
  Settings,
  Timer,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  /** Libellé court pour la barre d'onglets mobile. */
  shortLabel: string
  icon: LucideIcon
}

export const ROUTES = {
  dashboard: '/',
  exercises: '/exercices',
  training: '/entrainement',
  history: '/historique',
  progress: '/progression',
  settings: '/parametres',
  programs: '/programmes',
  newProgram: '/programmes/nouveau',
} as const

/** Adresse de la page de détail d'une séance terminée. */
export function workoutPath(workoutId: string): string {
  return `${ROUTES.history}/${encodeURIComponent(workoutId)}`
}

/** Adresse de l'éditeur d'un programme existant. */
export function programEditPath(programId: string): string {
  return `${ROUTES.programs}/${encodeURIComponent(programId)}/modifier`
}

/** Paramètre d'adresse désignant l'exercice affiché sur la page Progression. */
export const EXERCISE_PARAM = 'exercice'

/** Adresse de la progression d'un exercice. */
export function exerciseProgressPath(exerciseId: string): string {
  return `${ROUTES.progress}?${EXERCISE_PARAM}=${encodeURIComponent(exerciseId)}`
}

export const SETTINGS_NAV_ITEM: NavItem = {
  path: ROUTES.settings,
  label: 'Paramètres',
  shortLabel: 'Réglages',
  icon: Settings,
}

/** Entrées principales, dans l'ordre de la barre mobile (Entraînement au centre). */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { path: ROUTES.dashboard, label: 'Tableau de bord', shortLabel: 'Accueil', icon: LayoutDashboard },
  { path: ROUTES.exercises, label: 'Exercices', shortLabel: 'Exercices', icon: Dumbbell },
  { path: ROUTES.training, label: 'Entraînement', shortLabel: 'Séance', icon: Timer },
  { path: ROUTES.history, label: 'Historique', shortLabel: 'Historique', icon: History },
  { path: ROUTES.progress, label: 'Progression', shortLabel: 'Progrès', icon: TrendingUp },
]

/** Entrée affichée dans la barre latérale ; sur mobile, on y accède depuis Entraînement. */
export const PROGRAMS_NAV_ITEM: NavItem = {
  path: ROUTES.programs,
  label: 'Programmes',
  shortLabel: 'Programmes',
  icon: ClipboardList,
}
