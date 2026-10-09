import Dexie from 'dexie'
import { summarizeWorkout, type WorkoutSummary } from '@/lib/stats'
import type { DataOrigin, Id, WorkoutDetails, WorkoutSet } from '@/types/models'
import { db, type KemitlogDatabase } from './database'

export interface WorkoutListItem extends WorkoutSummary {
  /** Exercices ayant au moins une série validée, dans l'ordre de la séance, sans doublon. */
  exerciseNames: string[]
}

/** Séances terminées d'un périmètre, de la plus récente à la plus ancienne, avec leurs totaux. */
export async function listCompletedWorkoutSummaries(
  origin: DataOrigin,
  database: KemitlogDatabase = db,
): Promise<WorkoutListItem[]> {
  return database.transaction(
    'r',
    database.workouts,
    database.workoutExercises,
    database.sets,
    database.exercises,
    async () => {
      const workouts = await database.workouts
        .where('[origin+startedAt]')
        .between([origin, Dexie.minKey], [origin, Dexie.maxKey])
        .reverse()
        .filter((workout) => workout.status === 'completed')
        .toArray()

      const sets = await database.sets.where('origin').equals(origin).toArray()
      const setsByWorkout = new Map<Id, WorkoutSet[]>()
      for (const set of sets) {
        const list = setsByWorkout.get(set.workoutId)
        if (list) list.push(set)
        else setsByWorkout.set(set.workoutId, [set])
      }

      const exerciseNames = new Map(
        (await database.exercises.where('origin').equals(origin).toArray()).map((exercise) => [
          exercise.id,
          exercise.name,
        ]),
      )
      const workoutExercises = await database.workoutExercises.where('origin').equals(origin).sortBy('order')

      return workouts.map((workout) => {
        const workoutSets = setsByWorkout.get(workout.id) ?? []
        const performed = new Set(
          workoutSets.filter((set) => set.completed).map((set) => set.workoutExerciseId),
        )
        const names = workoutExercises
          .filter((item) => item.workoutId === workout.id && performed.has(item.id))
          .map((item) => exerciseNames.get(item.exerciseId) ?? 'Exercice supprimé')
        return { ...summarizeWorkout(workout, workoutSets), exerciseNames: [...new Set(names)] }
      })
    },
  )
}

/** Charge une séance avec ses exercices (dans l'ordre) et leurs séries. */
export async function getWorkoutDetails(
  workoutId: Id,
  database: KemitlogDatabase = db,
): Promise<WorkoutDetails | undefined> {
  return database.transaction(
    'r',
    database.workouts,
    database.workoutExercises,
    database.sets,
    database.exercises,
    async () => {
      const workout = await database.workouts.get(workoutId)
      if (!workout) return undefined

      const workoutExercises = await database.workoutExercises
        .where('[workoutId+order]')
        .between([workoutId, Dexie.minKey], [workoutId, Dexie.maxKey])
        .toArray()

      const exercises = await Promise.all(
        workoutExercises.map(async (workoutExercise) => ({
          workoutExercise,
          exercise: await database.exercises.get(workoutExercise.exerciseId),
          sets: await database.sets
            .where('[workoutExerciseId+order]')
            .between([workoutExercise.id, Dexie.minKey], [workoutExercise.id, Dexie.maxKey])
            .toArray(),
        })),
      )

      return { workout, exercises }
    },
  )
}

/** Supprime une séance ainsi que ses exercices de séance et ses séries. */
export async function deleteWorkout(workoutId: Id, database: KemitlogDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    database.workouts,
    database.workoutExercises,
    database.sets,
    async () => {
      await database.sets.where('workoutId').equals(workoutId).delete()
      await database.workoutExercises.where('workoutId').equals(workoutId).delete()
      await database.workouts.delete(workoutId)
    },
  )
}
