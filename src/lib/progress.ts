import type { Timestamp, TrackingType, WeightUnit, Workout, WorkoutSet } from '@/types/models'
import {
  formatClock,
  formatDistance,
  formatExactDuration,
  formatVolume,
  formatWeight,
  kgToUnit,
} from './format'

/**
 * Progression d'un exercice : calculs purs à partir des séries de travail
 * (validées, hors échauffement) de chaque séance terminée.
 */

/** Séries de travail d'un exercice au cours d'une séance terminée. */
export interface ExerciseSession {
  workout: Workout
  sets: WorkoutSet[]
}

/** `estimate` : charge calculée (1RM), affichée avec une précision réduite. */
export type MetricKind = 'weight' | 'estimate' | 'volume' | 'reps' | 'duration' | 'distance' | 'speed'

export interface ProgressMetric {
  id: string
  label: string
  /** Explication affichée sous le graphique : comment la valeur est calculée. */
  description: string
  kind: MetricKind
  /** Valeur de la séance, ou `undefined` si les séries ne permettent pas de la calculer. */
  compute: (sets: WorkoutSet[]) => number | undefined
}

/** Au-delà, la formule d'Epley surestime trop : la série est ignorée pour le 1RM. */
export const EPLEY_MAX_REPS = 12

/** Charge maximale théorique sur une répétition (formule d'Epley), en kilogrammes. */
export function estimateOneRepMax(weightKg: number, reps: number): number | undefined {
  if (weightKg <= 0 || reps < 1 || reps > EPLEY_MAX_REPS) return undefined
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

function max(values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined && value > 0)
  return defined.length === 0 ? undefined : Math.max(...defined)
}

function sum(values: Array<number | undefined>): number | undefined {
  const total = values.reduce<number>((acc, value) => acc + (value ?? 0), 0)
  return total > 0 ? total : undefined
}

const MAX_REPS: ProgressMetric = {
  id: 'max_reps',
  label: 'Répétitions max',
  description: 'Plus grand nombre de répétitions sur une série de la séance.',
  kind: 'reps',
  compute: (sets) => max(sets.map((set) => set.reps)),
}

const TOTAL_DURATION: ProgressMetric = {
  id: 'total_duration',
  label: 'Durée totale',
  description: 'Somme des durées de toutes les séries de la séance.',
  kind: 'duration',
  compute: (sets) => sum(sets.map((set) => set.durationSec)),
}

export const METRICS_BY_TRACKING: Record<TrackingType, readonly ProgressMetric[]> = {
  weight_reps: [
    {
      id: 'max_weight',
      label: 'Charge max',
      description: 'Charge la plus lourde soulevée sur une série de la séance.',
      kind: 'weight',
      compute: (sets) => max(sets.map((set) => ((set.reps ?? 0) > 0 ? set.weightKg : undefined))),
    },
    {
      id: 'est_1rm',
      label: '1RM estimé',
      description: `Meilleure estimation de la charge maximale sur une répétition (formule d’Epley : charge × (1 + répétitions ÷ 30)). C’est une estimation, pas une mesure ; les séries de plus de ${EPLEY_MAX_REPS} répétitions sont ignorées.`,
      kind: 'estimate',
      compute: (sets) =>
        max(sets.map((set) => estimateOneRepMax(set.weightKg ?? 0, set.reps ?? 0))),
    },
    {
      id: 'volume',
      label: 'Volume',
      description: 'Somme charge × répétitions de toutes les séries de la séance.',
      kind: 'volume',
      compute: (sets) => sum(sets.map((set) => (set.weightKg ?? 0) * (set.reps ?? 0))),
    },
  ],
  bodyweight_reps: [
    MAX_REPS,
    {
      id: 'total_reps',
      label: 'Répétitions totales',
      description: 'Somme des répétitions de toutes les séries de la séance.',
      kind: 'reps',
      compute: (sets) => sum(sets.map((set) => set.reps)),
    },
  ],
  duration: [
    {
      id: 'max_duration',
      label: 'Durée max',
      description: 'Série la plus longue de la séance.',
      kind: 'duration',
      compute: (sets) => max(sets.map((set) => set.durationSec)),
    },
    TOTAL_DURATION,
  ],
  distance_duration: [
    {
      id: 'distance',
      label: 'Distance',
      description: 'Distance totale parcourue pendant la séance.',
      kind: 'distance',
      compute: (sets) => sum(sets.map((set) => set.distanceM)),
    },
    TOTAL_DURATION,
    {
      id: 'speed',
      label: 'Vitesse moyenne',
      description:
        'Distance totale ÷ durée totale, sur les séries où les deux sont renseignées.',
      kind: 'speed',
      compute: (sets) => {
        const timed = sets.filter((set) => (set.distanceM ?? 0) > 0 && (set.durationSec ?? 0) > 0)
        const meters = sum(timed.map((set) => set.distanceM))
        const seconds = sum(timed.map((set) => set.durationSec))
        return meters === undefined || seconds === undefined
          ? undefined
          : meters / 1000 / (seconds / 3600)
      },
    },
  ],
}

export interface ProgressPoint {
  workoutId: string
  workoutName: string
  date: Timestamp
  /** Valeur dans l'unité de stockage (kg, répétitions, secondes, mètres, km/h). */
  value: number
}

/** Une valeur par séance, dans l'ordre chronologique. Les séances sans valeur sont omises. */
export function buildSeries(sessions: ExerciseSession[], metric: ProgressMetric): ProgressPoint[] {
  return [...sessions]
    .sort((a, b) => a.workout.startedAt - b.workout.startedAt)
    .flatMap((session) => {
      const value = metric.compute(session.sets)
      return value === undefined
        ? []
        : [
            {
              workoutId: session.workout.id,
              workoutName: session.workout.name,
              date: session.workout.startedAt,
              value,
            },
          ]
    })
}

/** Meilleure valeur de la série ; la plus ancienne en cas d'égalité (date du record). */
export function findRecord(points: ProgressPoint[]): ProgressPoint | undefined {
  return points.reduce<ProgressPoint | undefined>(
    (best, point) => (best === undefined || point.value > best.value ? point : best),
    undefined,
  )
}

export interface Trend {
  first: ProgressPoint
  last: ProgressPoint
  delta: number
  /** Variation relative (0,1 = +10 %). */
  ratio: number
}

/** Écart entre la première et la dernière séance ; `undefined` avec moins de deux points. */
export function computeTrend(points: ProgressPoint[]): Trend | undefined {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || first === last) return undefined
  const delta = last.value - first.value
  return { first, last, delta, ratio: delta / first.value }
}

// ───────────────────────────── Affichage ─────────────────────────────

/** Valeur complète avec son unité : « 82,5 kg », « 9 rép. », « 1 min 15 », « 5,2 km », « 10,4 km/h ». */
export function formatMetricValue(value: number, kind: MetricKind, unit: WeightUnit): string {
  switch (kind) {
    case 'weight':
      return formatWeight(value, unit)
    case 'estimate':
      // Une décimale suffit : afficher plus suggérerait une précision que l'estimation n'a pas.
      return `${kgToUnit(value, unit).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unit}`
    case 'volume':
      return formatVolume(value, unit)
    case 'reps':
      return `${Math.round(value).toLocaleString('fr-FR')} rép.`
    case 'duration':
      return formatExactDuration(value)
    case 'distance':
      return formatDistance(value)
    case 'speed':
      return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km/h`
  }
}

/** Valeur numérique portée par l'axe vertical, dans l'unité affichée. */
export function toAxisValue(value: number, kind: MetricKind, unit: WeightUnit): number {
  if (kind === 'weight' || kind === 'estimate' || kind === 'volume') return kgToUnit(value, unit)
  if (kind === 'distance') return value / 1000
  return value
}

export function formatAxisTick(axisValue: number, kind: MetricKind): string {
  if (kind === 'duration') return formatClock(axisValue)
  return axisValue.toLocaleString('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
}

export function axisUnitLabel(kind: MetricKind, unit: WeightUnit): string {
  switch (kind) {
    case 'weight':
    case 'estimate':
    case 'volume':
      return unit
    case 'reps':
      return 'répétitions'
    case 'duration':
      return 'min:s'
    case 'distance':
      return 'km'
    case 'speed':
      return 'km/h'
  }
}
