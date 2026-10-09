import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildSeries,
  computeTrend,
  estimateOneRepMax,
  findRecord,
  formatAxisTick,
  formatMetricValue,
  METRICS_BY_TRACKING,
  toAxisValue,
  type ProgressMetric,
} from '@/lib/progress'
import type { Exercise, Id, SetType, TrackingType, WorkoutSet } from '@/types/models'
import { KemitlogDatabase } from './database'
import { enableDemoMode } from './demo/demoMode'
import { addCatalogExercises, listExercises } from './exercises'
import { getExerciseHistory, listTrainedExercises } from './progress'
import {
  addExerciseToWorkout,
  addSet,
  finishWorkout,
  saveSet,
  startWorkout,
  updateWorkoutSchedule,
  type SetValues,
} from './session'

function metric(trackingType: TrackingType, id: string): ProgressMetric {
  const found = METRICS_BY_TRACKING[trackingType].find((item) => item.id === id)
  if (!found) throw new Error(`Mesure inconnue : ${id}`)
  return found
}

function workingSet(values: SetValues): WorkoutSet {
  return {
    id: 's',
    origin: 'user',
    workoutExerciseId: 'we',
    workoutId: 'w',
    exerciseId: 'e',
    order: 0,
    type: 'normal',
    completed: true,
    createdAt: 0,
    updatedAt: 0,
    ...values,
  }
}

describe('mesures de progression', () => {
  it('estime le 1RM avec la formule d’Epley, dans ses limites', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2)
    expect(estimateOneRepMax(60, 12)).toBeCloseTo(84, 5)
    expect(estimateOneRepMax(60, 13)).toBeUndefined()
    expect(estimateOneRepMax(0, 5)).toBeUndefined()
    expect(estimateOneRepMax(60, 0)).toBeUndefined()
  })

  it('calcule charge max, 1RM estimé et volume d’une séance', () => {
    const sets = [
      workingSet({ weightKg: 80, reps: 5 }),
      workingSet({ weightKg: 85, reps: 3 }),
      workingSet({ weightKg: 60, reps: 15 }),
    ]
    expect(metric('weight_reps', 'max_weight').compute(sets)).toBe(85)
    // 80 × 5 → 93,3 ; 85 × 3 → 93,5 ; la série de 15 répétitions est ignorée.
    expect(metric('weight_reps', 'est_1rm').compute(sets)).toBeCloseTo(93.5, 5)
    expect(metric('weight_reps', 'volume').compute(sets)).toBe(400 + 255 + 900)
  })

  it('ne renvoie aucune valeur quand les séries ne le permettent pas', () => {
    expect(metric('weight_reps', 'max_weight').compute([workingSet({ weightKg: 0, reps: 10 })])).toBeUndefined()
    expect(metric('weight_reps', 'est_1rm').compute([workingSet({ weightKg: 40, reps: 20 })])).toBeUndefined()
    expect(metric('bodyweight_reps', 'max_reps').compute([])).toBeUndefined()
    expect(metric('distance_duration', 'speed').compute([workingSet({ distanceM: 5000 })])).toBeUndefined()
  })

  it('calcule répétitions, durées, distance et vitesse', () => {
    const reps = [workingSet({ reps: 9 }), workingSet({ reps: 7 })]
    expect(metric('bodyweight_reps', 'max_reps').compute(reps)).toBe(9)
    expect(metric('bodyweight_reps', 'total_reps').compute(reps)).toBe(16)

    const holds = [workingSet({ durationSec: 60 }), workingSet({ durationSec: 75 })]
    expect(metric('duration', 'max_duration').compute(holds)).toBe(75)
    expect(metric('duration', 'total_duration').compute(holds)).toBe(135)

    const runs = [workingSet({ distanceM: 5000, durationSec: 1500 }), workingSet({ distanceM: 1000 })]
    expect(metric('distance_duration', 'distance').compute(runs)).toBe(6000)
    // Seule la série chronométrée compte pour la vitesse : 5 km en 25 min.
    expect(metric('distance_duration', 'speed').compute(runs)).toBeCloseTo(12, 5)
  })

  it('trouve le record (le plus ancien en cas d’égalité) et la tendance', () => {
    const points = [60, 65, 65, 62.5].map((value, index) => ({
      workoutId: `w${index}`,
      workoutName: 'S',
      date: index * 1000,
      value,
    }))
    expect(findRecord(points)?.workoutId).toBe('w1')
    expect(computeTrend(points)).toMatchObject({ delta: 2.5, ratio: 2.5 / 60 })
    expect(computeTrend(points.slice(0, 1))).toBeUndefined()
    expect(findRecord([])).toBeUndefined()
  })

  it('formate les valeurs et les axes selon la mesure', () => {
    expect(formatMetricValue(82.5, 'weight', 'kg')).toBe('82,5 kg')
    expect(formatMetricValue(50.6667, 'estimate', 'kg')).toBe('50,7 kg')
    expect(formatMetricValue(1555, 'volume', 'kg').replace(/\s/g, ' ')).toBe('1 555 kg')
    expect(formatMetricValue(9, 'reps', 'kg')).toBe('9 rép.')
    expect(formatMetricValue(75, 'duration', 'kg')).toBe('1 min 15')
    expect(formatMetricValue(5200, 'distance', 'kg')).toBe('5,2 km')
    expect(formatMetricValue(10.44, 'speed', 'kg')).toBe('10,4 km/h')
    expect(toAxisValue(100, 'weight', 'lb')).toBeCloseTo(220.46, 2)
    expect(toAxisValue(5200, 'distance', 'kg')).toBe(5.2)
    expect(formatAxisTick(75, 'duration')).toBe('1:15')
  })
})

describe('historique d’un exercice', () => {
  let counter = 0
  let database: KemitlogDatabase
  let squat: Exercise
  let pullUp: Exercise

  beforeEach(async () => {
    counter += 1
    database = new KemitlogDatabase(`kemitlog-progress-test-${counter}`)
    await addCatalogExercises(['back-squat', 'pull-up'], database)
    const byCatalogId = new Map((await listExercises('user', database)).map((e) => [e.catalogId, e]))
    squat = byCatalogId.get('back-squat')!
    pullUp = byCatalogId.get('pull-up')!
  })

  afterEach(async () => {
    await database.delete()
  })

  type Planned = SetValues & { type?: SetType }

  /** Séance terminée, datée à `daysAgo` jours, avec les séries données par exercice. */
  async function session(daysAgo: number, plan: Array<[Id, Planned[]]>, finish = true) {
    const workout = await startWorkout(database)
    for (const [exerciseId, planned] of plan) {
      const item = await addExerciseToWorkout(workout.id, exerciseId, undefined, database)
      let rows = await database.sets.where('workoutExerciseId').equals(item.id).sortBy('order')
      while (rows.length < planned.length) {
        await addSet(item.id, database)
        rows = await database.sets.where('workoutExerciseId').equals(item.id).sortBy('order')
      }
      for (const [index, { type = 'normal', ...values }] of planned.entries()) {
        await saveSet(rows[index]!.id, { values, type, completed: true }, {}, database)
      }
    }
    if (!finish) return workout.id
    await finishWorkout(workout.id, database)
    await updateWorkoutSchedule(
      workout.id,
      { startedAt: Date.now() - daysAgo * 86_400_000, durationMin: 60 },
      database,
    )
    return workout.id
  }

  it('renvoie les séances dans l’ordre chronologique, sans échauffements ni séance en cours', async () => {
    const recent = await session(1, [[squat.id, [{ weightKg: 40, reps: 10, type: 'warmup' }, { weightKg: 85, reps: 5 }]]])
    const old = await session(10, [[squat.id, [{ weightKg: 80, reps: 5 }, { weightKg: 80, reps: 4 }]]])
    await session(0, [[squat.id, [{ weightKg: 200, reps: 1 }]]], false)

    const history = await getExerciseHistory(squat.id, 'user', database)
    expect(history.map((s) => s.workout.id)).toEqual([old, recent])
    expect(history.map((s) => s.sets.map((set) => set.weightKg))).toEqual([[80, 80], [85]])

    const series = buildSeries(history, metric('weight_reps', 'max_weight'))
    expect(series.map((p) => p.value)).toEqual([80, 85])
    expect(findRecord(series)?.workoutId).toBe(recent)
  })

  it('liste les exercices pratiqués, les plus fréquents d’abord', async () => {
    await session(3, [[squat.id, [{ weightKg: 80, reps: 5 }]], [pullUp.id, [{ reps: 8 }]]])
    await session(1, [[squat.id, [{ weightKg: 82.5, reps: 5 }]]])
    // Un exercice fait uniquement en échauffement n'est pas « pratiqué ».
    await session(2, [[pullUp.id, [{ reps: 5, type: 'warmup' }]], [squat.id, [{ weightKg: 80, reps: 5 }]]])

    const trained = await listTrainedExercises('user', database)
    expect(trained.map((t) => [t.exercise.name, t.sessionCount])).toEqual([
      ['Squat barre', 3],
      ['Tractions pronation', 1],
    ])
    expect(trained[0]!.lastAt).toBeGreaterThan(trained[1]!.lastAt)
  })

  it('sépare données réelles et démonstration', async () => {
    await session(1, [[squat.id, [{ weightKg: 80, reps: 5 }]]])
    await enableDemoMode(database)

    expect((await listTrainedExercises('user', database)).map((t) => t.exercise.name)).toEqual(['Squat barre'])
    const demo = await listTrainedExercises('demo', database)
    expect(demo.length).toBeGreaterThan(5)
    expect(demo.every((t) => t.exercise.origin === 'demo')).toBe(true)

    const demoSquat = demo.find((t) => t.exercise.id === 'demo-exercise-squat')!
    const history = await getExerciseHistory(demoSquat.exercise.id, 'demo', database)
    expect(history).toHaveLength(demoSquat.sessionCount)
    expect(await getExerciseHistory(squat.id, 'demo', database)).toEqual([])
  })
})
