import type { Timestamp, Workout, WorkoutDetails, WorkoutSet } from '@/types/models'
import { addDays, startOfWeek } from './dates'

/**
 * Calculs purs sur les séances. Aucune valeur n'est inventée : une statistique
 * sans donnée vaut 0 ou `undefined`, et l'interface affiche alors un état vide.
 */

export interface WorkoutSummary {
  workout: Workout
  exerciseCount: number
  setCount: number
  volumeKg: number
  durationSec: number | undefined
}

/** Une série compte dans les statistiques si elle est terminée et n'est pas un échauffement. */
export function isWorkingSet(set: WorkoutSet): boolean {
  return set.completed && set.type !== 'warmup'
}

/** Volume d'une série : charge × répétitions (0 pour les exercices sans charge). */
export function setVolumeKg(set: WorkoutSet): number {
  if (!isWorkingSet(set)) return 0
  return (set.weightKg ?? 0) * (set.reps ?? 0)
}

export function summarizeWorkout(workout: Workout, sets: WorkoutSet[]): WorkoutSummary {
  const workingSets = sets.filter(isWorkingSet)
  return {
    workout,
    exerciseCount: new Set(workingSets.map((set) => set.workoutExerciseId)).size,
    setCount: workingSets.length,
    volumeKg: workingSets.reduce((total, set) => total + setVolumeKg(set), 0),
    durationSec:
      workout.endedAt === undefined
        ? undefined
        : Math.max(0, Math.round((workout.endedAt - workout.startedAt) / 1000)),
  }
}

/**
 * Vue de lecture d'une séance : sans les séries non validées (brouillons laissés par
 * une correction interrompue) ni les exercices qui n'en ont aucune de validée.
 */
export function withoutDrafts(details: WorkoutDetails): WorkoutDetails {
  return {
    workout: details.workout,
    exercises: details.exercises
      .map((entry) => ({ ...entry, sets: entry.sets.filter((set) => set.completed) }))
      .filter((entry) => entry.sets.length > 0),
  }
}

export interface WeekBucket {
  weekStart: Timestamp
  workoutCount: number
  volumeKg: number
}

/**
 * Regroupe les séances par semaine sur les `weekCount` dernières semaines
 * (semaine en cours incluse). Les semaines sans séance sont présentes avec 0.
 */
export function bucketByWeek(
  summaries: WorkoutSummary[],
  options: { now: Timestamp; weekCount: number; weekStartsOn: 0 | 1 },
): WeekBucket[] {
  const currentWeek = startOfWeek(options.now, options.weekStartsOn)
  const buckets = new Map<Timestamp, WeekBucket>()
  for (let index = options.weekCount - 1; index >= 0; index -= 1) {
    const weekStart = addDays(currentWeek, -7 * index)
    buckets.set(weekStart, { weekStart, workoutCount: 0, volumeKg: 0 })
  }
  for (const summary of summaries) {
    const bucket = buckets.get(startOfWeek(summary.workout.startedAt, options.weekStartsOn))
    if (!bucket) continue
    bucket.workoutCount += 1
    bucket.volumeKg += summary.volumeKg
  }
  return [...buckets.values()]
}

export interface DashboardStats {
  totalWorkouts: number
  workoutsThisWeek: number
  volumeThisWeekKg: number
  lastWorkoutAt: Timestamp | undefined
}

export function computeDashboardStats(
  summaries: WorkoutSummary[],
  options: { now: Timestamp; weekStartsOn: 0 | 1 },
): DashboardStats {
  const weekStart = startOfWeek(options.now, options.weekStartsOn)
  const thisWeek = summaries.filter((summary) => summary.workout.startedAt >= weekStart)
  return {
    totalWorkouts: summaries.length,
    workoutsThisWeek: thisWeek.length,
    volumeThisWeekKg: thisWeek.reduce((total, summary) => total + summary.volumeKg, 0),
    lastWorkoutAt: summaries.reduce<Timestamp | undefined>(
      (latest, summary) =>
        latest === undefined || summary.workout.startedAt > latest
          ? summary.workout.startedAt
          : latest,
      undefined,
    ),
  }
}
