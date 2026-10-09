/**
 * Modèle de données de KEMITLOG.
 *
 * Conventions :
 * - les identifiants sont des chaînes (UUID) générées côté client ;
 * - les dates sont des horodatages en millisecondes (compatibles JSON et index IndexedDB) ;
 * - les charges sont toujours stockées en kilogrammes, la conversion se fait à l'affichage ;
 * - `origin` sépare les données réelles ('user') des données de démonstration ('demo').
 */

export type Id = string
export type Timestamp = number

export type DataOrigin = 'user' | 'demo'

/** Champs communs à tous les enregistrements métier. */
export interface BaseRecord {
  id: Id
  origin: DataOrigin
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ───────────────────────────── Exercices ─────────────────────────────

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'glutes',
  'core',
  'cardio',
  'full_body',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EQUIPMENT_TYPES = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'band',
  'other',
] as const
export type Equipment = (typeof EQUIPMENT_TYPES)[number]

/** Détermine quels champs sont saisis pour chaque série de l'exercice. */
export const TRACKING_TYPES = [
  'weight_reps',
  'bodyweight_reps',
  'duration',
  'distance_duration',
] as const
export type TrackingType = (typeof TRACKING_TYPES)[number]

export interface Exercise extends BaseRecord {
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  trackingType: TrackingType
  notes?: string
  /** Un exercice archivé reste lié à l'historique mais n'est plus proposé à la saisie. */
  archived: boolean
  /** Les favoris sont listés en premier. */
  favorite?: boolean
  /** Identifiant de l'entrée du catalogue intégré dont l'exercice est issu, le cas échéant. */
  catalogId?: string
}

// ───────────────────────────── Séances ─────────────────────────────

export const WORKOUT_STATUSES = ['in_progress', 'completed'] as const
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number]

export interface Workout extends BaseRecord {
  name: string
  status: WorkoutStatus
  startedAt: Timestamp
  endedAt?: Timestamp
  /** Programme et jour dont la séance est issue, le cas échéant. */
  programId?: Id
  programDayId?: Id
  notes?: string
  /**
   * Minuteur de repos de la séance en cours : heure de fin et durée initiale.
   * Stocké en base pour survivre à une actualisation ; effacé à la fin de la séance.
   */
  restEndsAt?: Timestamp
  restDurationSec?: number
}

/** Un exercice tel qu'il a été réalisé dans une séance donnée. */
export interface WorkoutExercise extends BaseRecord {
  workoutId: Id
  exerciseId: Id
  /** Position dans la séance (0 = premier). */
  order: number
  notes?: string
  /** Objectif et repos repris du programme quand la séance en est issue. */
  targetSets?: number
  targetReps?: string
  restSec?: number
}

export const SET_TYPES = ['warmup', 'normal', 'drop', 'failure'] as const
export type SetType = (typeof SET_TYPES)[number]

export interface WorkoutSet extends BaseRecord {
  workoutExerciseId: Id
  /** Dénormalisés pour interroger l'historique d'un exercice sans jointure. */
  workoutId: Id
  exerciseId: Id
  /** Position dans l'exercice (0 = première série). */
  order: number
  type: SetType
  weightKg?: number
  reps?: number
  durationSec?: number
  distanceM?: number
  /** Effort perçu, de 1 à 10. */
  rpe?: number
  completed: boolean
  completedAt?: Timestamp
}

// ───────────────────────────── Programmes ─────────────────────────────

export interface ProgramExercise {
  exerciseId: Id
  targetSets: number
  /** Fourchette libre, par exemple « 8-12 ». */
  targetReps?: string
  restSec?: number
}

export interface ProgramDay {
  id: Id
  name: string
  exercises: ProgramExercise[]
}

export interface Program extends BaseRecord {
  name: string
  description?: string
  days: ProgramDay[]
}

// ───────────────────────────── Préférences ─────────────────────────────

export const WEIGHT_UNITS = ['kg', 'lb'] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]

export const PREFERENCES_ID = 'app'

export interface Preferences {
  id: typeof PREFERENCES_ID
  weightUnit: WeightUnit
  /** Temps de repos proposé par défaut entre deux séries. */
  defaultRestSec: number
  /** 1 = lundi, 0 = dimanche. */
  weekStartsOn: 0 | 1
  /** Périmètre affiché : données réelles ou jeu de démonstration. */
  dataScope: DataOrigin
  lastExportAt?: Timestamp
  updatedAt: Timestamp
}

/** Séance accompagnée de ses exercices et séries, pour l'affichage. */
/** Dernière séance terminée contenant un exercice, avec les séries validées. */
export interface LastPerformance {
  workout: Workout
  sets: WorkoutSet[]
}

/** Séance en cours, avec pour chaque exercice sa dernière performance connue. */
export interface ActiveSession {
  workout: Workout
  exercises: Array<WorkoutDetails['exercises'][number] & { previous: LastPerformance | undefined }>
}

export interface WorkoutDetails {
  workout: Workout
  exercises: Array<{
    workoutExercise: WorkoutExercise
    exercise: Exercise | undefined
    sets: WorkoutSet[]
  }>
}
