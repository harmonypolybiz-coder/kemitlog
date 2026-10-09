import { describe, expect, it } from 'vitest'
import type { Workout, WorkoutSet } from '@/types/models'
import { startOfWeek } from './dates'
import { formatDuration, formatExactDuration } from './format'
import { bucketByWeek, computeDashboardStats, summarizeWorkout } from './stats'

// Mercredi 17 juin 2026, midi.
const NOW = new Date(2026, 5, 17, 12).getTime()

function workout(id: string, startedAt: number): Workout {
  return {
    id,
    origin: 'user',
    name: id,
    status: 'completed',
    startedAt,
    endedAt: startedAt + 30 * 60_000,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
}

function set(id: string, workoutId: string, weightKg: number, reps: number): WorkoutSet {
  return {
    id,
    origin: 'user',
    workoutExerciseId: `${workoutId}-we`,
    workoutId,
    exerciseId: 'e',
    order: 0,
    type: 'normal',
    weightKg,
    reps,
    completed: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('startOfWeek', () => {
  it('respecte le premier jour de la semaine', () => {
    expect(new Date(startOfWeek(NOW, 1)).getDate()).toBe(15) // lundi
    expect(new Date(startOfWeek(NOW, 0)).getDate()).toBe(14) // dimanche
  })
})

describe('statistiques', () => {
  const monday = new Date(2026, 5, 15, 18).getTime()
  const lastWeek = new Date(2026, 5, 10, 18).getTime()
  const summaries = [
    summarizeWorkout(workout('a', monday), [set('1', 'a', 100, 5), set('2', 'a', 100, 5)]),
    summarizeWorkout(workout('b', lastWeek), [set('3', 'b', 50, 10)]),
  ]

  it('ignore les séries non terminées', () => {
    const summary = summarizeWorkout(workout('c', monday), [
      { ...set('4', 'c', 80, 5), completed: false },
    ])
    expect(summary).toMatchObject({ setCount: 0, volumeKg: 0, exerciseCount: 0 })
  })

  it('calcule le tableau de bord de la semaine en cours', () => {
    expect(computeDashboardStats(summaries, { now: NOW, weekStartsOn: 1 })).toEqual({
      totalWorkouts: 2,
      workoutsThisWeek: 1,
      volumeThisWeekKg: 1000,
      lastWorkoutAt: monday,
    })
  })

  it('renvoie des statistiques vides sans séance', () => {
    expect(computeDashboardStats([], { now: NOW, weekStartsOn: 1 })).toEqual({
      totalWorkouts: 0,
      workoutsThisWeek: 0,
      volumeThisWeekKg: 0,
      lastWorkoutAt: undefined,
    })
  })

  it('regroupe par semaine en gardant les semaines vides', () => {
    const buckets = bucketByWeek(summaries, { now: NOW, weekCount: 4, weekStartsOn: 1 })
    expect(buckets.map((bucket) => bucket.volumeKg)).toEqual([0, 0, 500, 1000])
    expect(buckets.map((bucket) => bucket.workoutCount)).toEqual([0, 0, 1, 1])
  })
})

describe('formatage des durées', () => {
  it('garde les secondes pour les temps de repos', () => {
    expect([45, 60, 90, 150].map(formatExactDuration)).toEqual(['45 s', '1 min', '1 min 30', '2 min 30'])
  })

  it('arrondit la durée des séances à la minute', () => {
    expect([58 * 60 + 20, 65 * 60].map(formatDuration)).toEqual(['58 min', '1 h 05'])
  })
})
