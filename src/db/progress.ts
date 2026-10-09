import type { ExerciseSession } from '@/lib/progress'
import { isWorkingSet } from '@/lib/stats'
import type { DataOrigin, Exercise, Id, Timestamp, Workout, WorkoutSet } from '@/types/models'
import { db, type KemitlogDatabase } from './database'

/** Lectures pour la page Progression. Seules les séances terminées comptent. */

export interface TrainedExercise {
  exercise: Exercise
  sessionCount: number
  lastAt: Timestamp
}

/** Exercices ayant au moins une série de travail dans une séance terminée, les plus pratiqués d'abord. */
export async function listTrainedExercises(
  origin: DataOrigin,
  database: KemitlogDatabase = db,
): Promise<TrainedExercise[]> {
  return database.transaction('r', database.sets, database.workouts, database.exercises, async () => {
    const startedAt = new Map(
      (await database.workouts.where('origin').equals(origin).toArray())
        .filter((workout) => workout.status === 'completed')
        .map((workout) => [workout.id, workout.startedAt]),
    )
    const sessions = new Map<Id, Set<Id>>()
    await database.sets
      .where('origin')
      .equals(origin)
      .each((set) => {
        if (!isWorkingSet(set) || !startedAt.has(set.workoutId)) return
        const workouts = sessions.get(set.exerciseId)
        if (workouts) workouts.add(set.workoutId)
        else sessions.set(set.exerciseId, new Set([set.workoutId]))
      })

    const exercises = await database.exercises.bulkGet([...sessions.keys()])
    return exercises
      .filter((exercise): exercise is Exercise => exercise !== undefined)
      .map((exercise) => {
        const workoutIds = [...(sessions.get(exercise.id) ?? [])]
        return {
          exercise,
          sessionCount: workoutIds.length,
          lastAt: Math.max(...workoutIds.map((id) => startedAt.get(id) ?? 0)),
        }
      })
      .sort(
        (a, b) =>
          b.sessionCount - a.sessionCount ||
          a.exercise.name.localeCompare(b.exercise.name, 'fr', { sensitivity: 'base' }),
      )
  })
}

/** Séries de travail d'un exercice, regroupées par séance terminée, de la plus ancienne à la plus récente. */
export async function getExerciseHistory(
  exerciseId: Id,
  origin: DataOrigin,
  database: KemitlogDatabase = db,
): Promise<ExerciseSession[]> {
  return database.transaction('r', database.sets, database.workouts, async () => {
    const sets = await database.sets
      .where('exerciseId')
      .equals(exerciseId)
      .filter((set) => set.origin === origin && isWorkingSet(set))
      .toArray()

    const setsByWorkout = new Map<Id, WorkoutSet[]>()
    for (const set of sets) {
      const list = setsByWorkout.get(set.workoutId)
      if (list) list.push(set)
      else setsByWorkout.set(set.workoutId, [set])
    }

    const workouts = (await database.workouts.bulkGet([...setsByWorkout.keys()])).filter(
      (workout): workout is Workout => workout?.status === 'completed',
    )
    return workouts
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((workout) => ({
        workout,
        sets: (setsByWorkout.get(workout.id) ?? []).sort(
          (a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.order - b.order,
        ),
      }))
  })
}
