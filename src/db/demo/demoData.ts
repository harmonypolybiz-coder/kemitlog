import { addDays, startOfWeek } from '@/lib/dates'
import type {
  Equipment,
  Exercise,
  MuscleGroup,
  Program,
  Timestamp,
  TrackingType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/models'

/**
 * Jeu de démonstration : entièrement fictif, généré de façon déterministe et
 * marqué `origin: 'demo'`. Tous les identifiants commencent par « demo- ».
 * Il n'est jamais mélangé aux données réelles ni inclus dans les exports.
 */

export interface DemoDataset {
  exercises: Exercise[]
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  sets: WorkoutSet[]
  programs: Program[]
}

interface DemoExerciseSpec {
  key: string
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  trackingType: TrackingType
  /** Charge de départ (kg) et gain par semaine, pour les exercices chargés. */
  startKg?: number
  weeklyGainKg?: number
  /** Répétitions (ou secondes pour `duration`) visées par série. */
  target: number
}

const EXERCISES: DemoExerciseSpec[] = [
  { key: 'squat', name: 'Squat barre', muscleGroup: 'legs', equipment: 'barbell', trackingType: 'weight_reps', startKg: 70, weeklyGainKg: 2.5, target: 6 },
  { key: 'bench', name: 'Développé couché', muscleGroup: 'chest', equipment: 'barbell', trackingType: 'weight_reps', startKg: 55, weeklyGainKg: 1.25, target: 8 },
  { key: 'deadlift', name: 'Soulevé de terre', muscleGroup: 'back', equipment: 'barbell', trackingType: 'weight_reps', startKg: 90, weeklyGainKg: 2.5, target: 5 },
  { key: 'ohp', name: 'Développé militaire', muscleGroup: 'shoulders', equipment: 'barbell', trackingType: 'weight_reps', startKg: 35, weeklyGainKg: 0.625, target: 8 },
  { key: 'row', name: 'Rowing barre', muscleGroup: 'back', equipment: 'barbell', trackingType: 'weight_reps', startKg: 50, weeklyGainKg: 1.25, target: 10 },
  { key: 'pullup', name: 'Tractions', muscleGroup: 'back', equipment: 'bodyweight', trackingType: 'bodyweight_reps', target: 7 },
  { key: 'legpress', name: 'Presse à cuisses', muscleGroup: 'legs', equipment: 'machine', trackingType: 'weight_reps', startKg: 120, weeklyGainKg: 5, target: 10 },
  { key: 'curl', name: 'Curl haltères', muscleGroup: 'biceps', equipment: 'dumbbell', trackingType: 'weight_reps', startKg: 12, weeklyGainKg: 0.25, target: 12 },
  { key: 'triceps', name: 'Extension triceps à la poulie', muscleGroup: 'triceps', equipment: 'cable', trackingType: 'weight_reps', startKg: 20, weeklyGainKg: 0.625, target: 12 },
  { key: 'plank', name: 'Gainage', muscleGroup: 'core', equipment: 'bodyweight', trackingType: 'duration', target: 60 },
]

const DAYS = [
  { key: 'a', name: 'Séance A — Squat & poussée', weekday: 0, exercises: ['squat', 'bench', 'row', 'triceps', 'plank'] },
  { key: 'b', name: 'Séance B — Soulevé & tirage', weekday: 2, exercises: ['deadlift', 'ohp', 'pullup', 'curl'] },
  { key: 'c', name: 'Séance C — Jambes & haut du corps', weekday: 4, exercises: ['legpress', 'bench', 'pullup', 'ohp', 'plank'] },
] as const

const WEEK_COUNT = 8
const SETS_PER_EXERCISE = 3
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/** Générateur pseudo-aléatoire à graine fixe (mulberry32) : le jeu est reproductible. */
function createRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundToPlate(kg: number): number {
  return Math.round(kg / 2.5) * 2.5
}

export function generateDemoData(now: Timestamp = Date.now()): DemoDataset {
  const random = createRandom(20240601)
  const firstWeek = addDays(startOfWeek(now, 1), -7 * (WEEK_COUNT - 1))
  const createdAt = firstWeek

  const exercises: Exercise[] = EXERCISES.map((spec) => ({
    id: `demo-exercise-${spec.key}`,
    origin: 'demo',
    name: spec.name,
    muscleGroup: spec.muscleGroup,
    equipment: spec.equipment,
    trackingType: spec.trackingType,
    archived: false,
    createdAt,
    updatedAt: createdAt,
  }))

  const program: Program = {
    id: 'demo-program-fullbody',
    origin: 'demo',
    name: 'Full body 3 jours',
    description: 'Programme fictif utilisé par le mode démonstration.',
    days: DAYS.map((day) => ({
      id: `demo-day-${day.key}`,
      name: day.name,
      exercises: day.exercises.map((key) => ({
        exerciseId: `demo-exercise-${key}`,
        targetSets: SETS_PER_EXERCISE,
        restSec: 120,
      })),
    })),
    createdAt,
    updatedAt: createdAt,
  }

  const workouts: Workout[] = []
  const workoutExercises: WorkoutExercise[] = []
  const sets: WorkoutSet[] = []

  for (let week = 0; week < WEEK_COUNT; week += 1) {
    for (const day of DAYS) {
      const startedAt =
        addDays(firstWeek, week * 7 + day.weekday) +
        18 * HOUR_MS +
        Math.floor(random() * 45) * MINUTE_MS
      // Une séance manquée de temps en temps, et rien dans le futur.
      const skipped = random() < 0.12
      const endedAt = startedAt + (50 + Math.floor(random() * 25)) * MINUTE_MS
      if (skipped || endedAt > now) continue

      const workoutId = `demo-workout-${week}-${day.key}`
      workouts.push({
        id: workoutId,
        origin: 'demo',
        name: day.name,
        status: 'completed',
        startedAt,
        endedAt,
        programId: program.id,
        programDayId: `demo-day-${day.key}`,
        createdAt: startedAt,
        updatedAt: endedAt,
      })

      day.exercises.forEach((key, exerciseOrder) => {
        const spec = EXERCISES.find((exercise) => exercise.key === key)
        if (!spec) return
        const workoutExerciseId = `${workoutId}-${key}`
        workoutExercises.push({
          id: workoutExerciseId,
          origin: 'demo',
          workoutId,
          exerciseId: `demo-exercise-${key}`,
          order: exerciseOrder,
          createdAt: startedAt,
          updatedAt: endedAt,
        })

        const weightKg =
          spec.startKg === undefined
            ? undefined
            : roundToPlate(spec.startKg + (spec.weeklyGainKg ?? 0) * week)

        for (let order = 0; order < SETS_PER_EXERCISE; order += 1) {
          // La fatigue fait perdre une répétition (ou quelques secondes) sur les dernières séries.
          const fatigue = order === SETS_PER_EXERCISE - 1 && random() < 0.5 ? 1 : 0
          const progress = spec.trackingType === 'weight_reps' ? 0 : Math.floor(week / 3)
          const completedAt = startedAt + (exerciseOrder * 12 + order * 3 + 4) * MINUTE_MS
          const amount =
            spec.trackingType === 'duration'
              ? spec.target + week * 5 - fatigue * 10
              : spec.target + progress - fatigue

          sets.push({
            id: `${workoutExerciseId}-${order}`,
            origin: 'demo',
            workoutExerciseId,
            workoutId,
            exerciseId: `demo-exercise-${key}`,
            order,
            type: 'normal',
            ...(weightKg === undefined ? {} : { weightKg }),
            ...(spec.trackingType === 'duration' ? { durationSec: amount } : { reps: amount }),
            completed: true,
            completedAt,
            createdAt: completedAt,
            updatedAt: completedAt,
          })
        }
      })
    }
  }

  return { exercises, workouts, workoutExercises, sets, programs: [program] }
}
