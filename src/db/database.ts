import Dexie, { type EntityTable } from 'dexie'
import type {
  Exercise,
  Preferences,
  Program,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/models'

export const DB_NAME = 'kemitlog'

/**
 * Version du schéma IndexedDB. À incrémenter avec un nouveau bloc `version(n)`
 * (et un `.upgrade()` si les données doivent être migrées) ; ne jamais modifier
 * un bloc déjà publié.
 */
export const DB_SCHEMA_VERSION = 1

export class KemitlogDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  sets!: EntityTable<WorkoutSet, 'id'>
  programs!: EntityTable<Program, 'id'>
  preferences!: EntityTable<Preferences, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)

    // Seuls les champs interrogés sont indexés. Les clés étrangères
    // (workoutId, exerciseId, workoutExerciseId, programId) portent les relations.
    this.version(1).stores({
      exercises: 'id, origin, name, muscleGroup',
      workouts: 'id, origin, status, startedAt, programId, [origin+startedAt]',
      workoutExercises: 'id, origin, workoutId, exerciseId, [workoutId+order]',
      sets: 'id, origin, workoutId, exerciseId, [workoutExerciseId+order]',
      programs: 'id, origin, name',
      preferences: 'id',
    })
  }
}

export const db = new KemitlogDatabase()

/** Tables contenant des enregistrements métier marqués par `origin`. */
export function originTables(database: KemitlogDatabase) {
  return [
    database.exercises,
    database.workouts,
    database.workoutExercises,
    database.sets,
    database.programs,
  ] as const
}

export function createId(): string {
  return crypto.randomUUID()
}
