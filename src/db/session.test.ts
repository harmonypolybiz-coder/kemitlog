import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatClock, formatSetValues } from '@/lib/format'
import { parseDuration, parseFieldTexts, SetInputError, toFieldTexts } from '@/lib/setInput'
import type { Exercise, Id } from '@/types/models'
import { createBackup, parseBackup, serializeBackup } from './backup'
import { KemitlogDatabase } from './database'
import { ValidationError } from './errors'
import { addCatalogExercises, listExercises, removeExercise, setExerciseArchived } from './exercises'
import {
  addExerciseToWorkout,
  addSet,
  adjustRest,
  deleteSet,
  finishEditing,
  finishWorkout,
  getActiveSession,
  getActiveWorkout,
  getLastPerformance,
  moveWorkoutExercise,
  removeWorkoutExercise,
  saveSet,
  startWorkout,
  startWorkoutFrom,
  stopRest,
  updateWorkoutInfo,
  updateWorkoutSchedule,
} from './session'
import { withoutDrafts } from '@/lib/stats'
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/dates'
import { enableDemoMode } from './demo/demoMode'
import { deleteWorkout, getWorkoutDetails, listCompletedWorkoutSummaries } from './workouts'

let counter = 0
let database: KemitlogDatabase
let squat: Exercise
let pullUp: Exercise
let plank: Exercise
let running: Exercise

beforeEach(async () => {
  counter += 1
  database = new KemitlogDatabase(`kemitlog-session-test-${counter}`)
  await addCatalogExercises(['back-squat', 'pull-up', 'plank', 'running'], database)
  const byCatalogId = new Map((await listExercises('user', database)).map((e) => [e.catalogId, e]))
  squat = byCatalogId.get('back-squat')!
  pullUp = byCatalogId.get('pull-up')!
  plank = byCatalogId.get('plank')!
  running = byCatalogId.get('running')!
})

afterEach(async () => {
  await database.delete()
})

async function activeSets(workoutExerciseId: Id) {
  const session = await getActiveSession(database)
  return session!.exercises.find((e) => e.workoutExercise.id === workoutExerciseId)!.sets
}

/** Séance terminée d'un exercice avec les séries données (toutes validées). */
async function completedWorkout(exerciseId: Id, sets: Array<{ weightKg: number; reps: number }>) {
  const workout = await startWorkout(database)
  const item = await addExerciseToWorkout(workout.id, exerciseId, undefined, database)
  let current = await activeSets(item.id)
  while (current.length < sets.length) {
    await addSet(item.id, database)
    current = await activeSets(item.id)
  }
  for (const [index, values] of sets.entries()) {
    await saveSet(current[index]!.id, { values, completed: true }, {}, database)
  }
  return (await finishWorkout(workout.id, database)).workout
}

describe('démarrage de séance', () => {
  it('crée une séance réelle en cours, et une seule à la fois', async () => {
    const workout = await startWorkout(database)
    expect(workout).toMatchObject({ origin: 'user', status: 'in_progress' })
    expect((await getActiveWorkout(database))?.id).toBe(workout.id)
    await expect(startWorkout(database)).rejects.toThrow(/déjà en cours/)
  })

  it('retrouve la séance en cours après réouverture de la base', async () => {
    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const [set] = await activeSets(item.id)
    await saveSet(set!.id, { values: { weightKg: 80, reps: 5 }, completed: true }, {}, database)

    database.close()
    const reopened = new KemitlogDatabase(database.name)
    const session = await getActiveSession(reopened)
    expect(session?.workout.id).toBe(workout.id)
    expect(session?.exercises[0]?.sets[0]).toMatchObject({ weightKg: 80, reps: 5, completed: true })
    reopened.close()
  })

  it('renomme la séance et gère ses notes', async () => {
    const workout = await startWorkout(database)
    await updateWorkoutInfo(workout.id, { name: '  Jambes  lourdes ', notes: 'Bonne forme' }, database)
    expect(await getActiveWorkout(database)).toMatchObject({ name: 'Jambes lourdes', notes: 'Bonne forme' })
    await updateWorkoutInfo(workout.id, { notes: '  ' }, database)
    expect('notes' in (await getActiveWorkout(database))!).toBe(false)
    await expect(updateWorkoutInfo(workout.id, { name: ' ' }, database)).rejects.toThrow(ValidationError)
  })
})

describe('exercices de la séance', () => {
  it('ajoute une série vide quand l’exercice n’a pas d’historique', async () => {
    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const sets = await activeSets(item.id)
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ order: 0, type: 'normal', completed: false })
    expect(sets[0]!.weightKg).toBeUndefined()
  })

  it('préremplit les séries avec la dernière performance, sans les valider', async () => {
    await completedWorkout(squat.id, [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 7 }])
    const last = await completedWorkout(squat.id, [{ weightKg: 62.5, reps: 8 }, { weightKg: 62.5, reps: 6 }])

    const previous = await getLastPerformance(squat.id, database)
    expect(previous?.workout.id).toBe(last.id)

    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const sets = await activeSets(item.id)
    expect(sets.map((s) => [s.weightKg, s.reps, s.completed])).toEqual([
      [62.5, 8, false],
      [62.5, 6, false],
    ])
    // La séance en cours ne compte pas comme « dernière performance ».
    expect((await getActiveSession(database))?.exercises[0]?.previous?.workout.id).toBe(last.id)
  })

  it('refuse un exercice archivé', async () => {
    const workout = await startWorkout(database)
    await setExerciseArchived(squat.id, true, database)
    await expect(addExerciseToWorkout(workout.id, squat.id, undefined, database)).rejects.toThrow(/disponible/)
  })

  it('réordonne et retire des exercices en gardant des positions continues', async () => {
    const workout = await startWorkout(database)
    const a = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const b = await addExerciseToWorkout(workout.id, pullUp.id, undefined, database)
    const c = await addExerciseToWorkout(workout.id, plank.id, undefined, database)
    const order = async () =>
      (await getActiveSession(database))!.exercises.map((e) => [e.workoutExercise.id, e.workoutExercise.order])

    await moveWorkoutExercise(c.id, -1, database)
    expect(await order()).toEqual([[a.id, 0], [c.id, 1], [b.id, 2]])
    await moveWorkoutExercise(a.id, -1, database) // déjà en tête : sans effet
    expect(await order()).toEqual([[a.id, 0], [c.id, 1], [b.id, 2]])

    await removeWorkoutExercise(a.id, database)
    expect(await order()).toEqual([[c.id, 0], [b.id, 1]])
    expect(await database.sets.where('workoutExerciseId').equals(a.id).count()).toBe(0)
  })

  it('archive au lieu de supprimer un exercice présent dans la séance en cours', async () => {
    const workout = await startWorkout(database)
    await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    expect(await removeExercise(squat.id, database)).toBe('archived')
  })
})

describe('séries', () => {
  it('exige les valeurs requises par le type de suivi pour valider', async () => {
    const workout = await startWorkout(database)
    const cases: Array<[Exercise, object, object]> = [
      [squat, { weightKg: 80 }, { weightKg: 0, reps: 5 }],
      [pullUp, {}, { reps: 8 }],
      [plank, { reps: 3 }, { durationSec: 60 }],
      [running, {}, { distanceM: 5000 }],
    ]
    for (const [exercise, invalid, valid] of cases) {
      const item = await addExerciseToWorkout(workout.id, exercise.id, undefined, database)
      const [set] = await activeSets(item.id)
      await expect(saveSet(set!.id, { values: invalid, completed: true }, {}, database)).rejects.toThrow(ValidationError)
      expect((await database.sets.get(set!.id))?.completed).toBe(false)
      expect((await saveSet(set!.id, { values: valid, completed: true }, {}, database)).completed).toBe(true)
    }
  })

  it('refuse les valeurs hors limites ou non entières', async () => {
    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const [set] = await activeSets(item.id)
    await expect(saveSet(set!.id, { values: { weightKg: -5, reps: 5 } }, {}, database)).rejects.toThrow(/hors limites/)
    await expect(saveSet(set!.id, { values: { weightKg: 50, reps: 2.5 } }, {}, database)).rejects.toThrow(/entier/)
  })

  it('valide, dévalide et vide les champs effacés', async () => {
    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const [set] = await activeSets(item.id)

    const done = await saveSet(set!.id, { values: { weightKg: 80, reps: 5 }, completed: true }, {}, database)
    expect(done.completedAt).toBeTypeOf('number')

    // Modifier une série validée garde son heure de validation.
    const edited = await saveSet(set!.id, { values: { weightKg: 82.5, reps: 5 } }, {}, database)
    expect(edited).toMatchObject({ weightKg: 82.5, completed: true, completedAt: done.completedAt })
    // …mais on ne peut pas la vider en la laissant validée.
    await expect(saveSet(set!.id, { values: { weightKg: 82.5 } }, {}, database)).rejects.toThrow(ValidationError)

    const undone = await saveSet(set!.id, { completed: false }, {}, database)
    expect(undone.completed).toBe(false)
    expect('completedAt' in undone).toBe(false)

    const cleared = await saveSet(set!.id, { values: { reps: 5 } }, {}, database)
    expect('weightKg' in cleared).toBe(false)
  })

  it('ajoute une série copiée de la précédente et renumérote après suppression', async () => {
    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const [first] = await activeSets(item.id)
    await saveSet(first!.id, { values: { weightKg: 40, reps: 10 }, type: 'warmup', completed: true }, {}, database)

    const second = await addSet(item.id, database)
    expect(second).toMatchObject({ order: 1, weightKg: 40, reps: 10, type: 'normal', completed: false })
    const third = await addSet(item.id, database)

    await deleteSet(second.id, database)
    expect((await activeSets(item.id)).map((s) => [s.id, s.order])).toEqual([[first!.id, 0], [third.id, 1]])
  })
})

describe('minuteur de repos', () => {
  it('démarre à la validation d’une série, s’ajuste et s’arrête', async () => {
    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const [set] = await activeSets(item.id)

    const before = Date.now()
    await saveSet(set!.id, { values: { weightKg: 80, reps: 5 }, completed: true }, { restSec: 90 }, database)
    const started = (await getActiveWorkout(database))!
    expect(started.restDurationSec).toBe(90)
    expect(started.restEndsAt).toBeGreaterThanOrEqual(before + 90_000)

    // Modifier la série déjà validée ne relance pas le repos.
    await saveSet(set!.id, { values: { weightKg: 85, reps: 5 } }, { restSec: 90 }, database)
    expect((await getActiveWorkout(database))!.restEndsAt).toBe(started.restEndsAt)

    await adjustRest(workout.id, 15, database)
    expect((await getActiveWorkout(database))!.restEndsAt).toBe(started.restEndsAt! + 15_000)

    await adjustRest(workout.id, -600, database) // plus de temps restant : arrêt
    expect('restEndsAt' in (await getActiveWorkout(database))!).toBe(false)

    await saveSet(set!.id, { completed: false }, {}, database)
    await saveSet(set!.id, { completed: true }, { restSec: 0 }, database)
    expect('restEndsAt' in (await getActiveWorkout(database))!).toBe(false)
    await stopRest(workout.id, database)
  })
})

describe('fin de séance', () => {
  it('refuse de terminer sans série validée', async () => {
    const workout = await startWorkout(database)
    await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    await expect(finishWorkout(workout.id, database)).rejects.toThrow(/Aucune série validée/)
    expect((await getActiveWorkout(database))?.id).toBe(workout.id)
  })

  it('ne garde que les séries validées et alimente l’historique', async () => {
    const workout = await startWorkout(database)
    const empty = await addExerciseToWorkout(workout.id, pullUp.id, undefined, database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const [first] = await activeSets(item.id)
    const second = await addSet(item.id, database)
    const third = await addSet(item.id, database)
    await saveSet(first!.id, { values: { weightKg: 100, reps: 5 }, completed: true }, { restSec: 120 }, database)
    await saveSet(third.id, { values: { weightKg: 100, reps: 4 }, completed: true }, {}, database)

    const result = await finishWorkout(workout.id, database)
    expect(result).toMatchObject({ completedSets: 2, discardedSets: 2 })
    expect(result.workout.status).toBe('completed')
    expect(result.workout.endedAt).toBeTypeOf('number')
    expect('restEndsAt' in result.workout).toBe(false)

    expect(await getActiveWorkout(database)).toBeUndefined()
    expect(await database.workoutExercises.get(empty.id)).toBeUndefined()
    expect(await database.sets.get(second.id)).toBeUndefined()
    expect((await database.workoutExercises.get(item.id))?.order).toBe(0)
    expect((await database.sets.get(third.id))?.order).toBe(1)

    const [summary] = await listCompletedWorkoutSummaries('user', database)
    expect(summary).toMatchObject({ exerciseCount: 1, setCount: 2, volumeKg: 900 })

    // Une séance terminée ne peut plus être terminée ni chronométrée une seconde fois.
    await expect(finishWorkout(workout.id, database)).rejects.toThrow(/plus en cours/)
    await expect(adjustRest(workout.id, 15, database)).rejects.toThrow(/plus en cours/)
  })

  it('abandonne une séance sans laisser de trace', async () => {
    const workout = await startWorkout(database)
    await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    await deleteWorkout(workout.id, database)
    expect(await database.workouts.count()).toBe(0)
    expect(await database.workoutExercises.count()).toBe(0)
    expect(await database.sets.count()).toBe(0)
    await expect(startWorkout(database)).resolves.toBeDefined()
  })

  it('sauvegarde une séance en cours avec son minuteur', async () => {
    const workout = await startWorkout(database)
    const item = await addExerciseToWorkout(workout.id, squat.id, undefined, database)
    const [set] = await activeSets(item.id)
    await saveSet(set!.id, { values: { weightKg: 80, reps: 5 }, completed: true }, { restSec: 90 }, database)

    const restored = parseBackup(serializeBackup(await createBackup(database)))
    expect(restored.data.workouts[0]).toMatchObject({ status: 'in_progress' })
    expect(restored.data.sets[0]).toMatchObject({ weightKg: 80, reps: 5, completed: true })
  })
})

describe('historique : correction d’une séance terminée', () => {
  it('corrige une série sans relancer de minuteur ni changer la durée', async () => {
    const done = await completedWorkout(squat.id, [{ weightKg: 60, reps: 8 }])
    const [set] = await database.sets.where('workoutId').equals(done.id).toArray()

    const fixed = await saveSet(set!.id, { values: { weightKg: 65, reps: 8 } }, { restSec: 90 }, database)
    expect(fixed).toMatchObject({ weightKg: 65, completed: true })
    const after = await database.workouts.get(done.id)
    expect(after).toMatchObject({ status: 'completed', endedAt: done.endedAt })
    expect('restEndsAt' in after!).toBe(false)
    expect((await listCompletedWorkoutSummaries('user', database))[0]?.volumeKg).toBe(520)
  })

  it('ajoute un exercice oublié et écarte les brouillons à la clôture', async () => {
    const done = await completedWorkout(squat.id, [{ weightKg: 60, reps: 8 }])
    const forgotten = await addExerciseToWorkout(done.id, pullUp.id, undefined, database)
    const [draft] = await database.sets.where('workoutExerciseId').equals(forgotten.id).toArray()
    const unused = await addExerciseToWorkout(done.id, plank.id, undefined, database)

    // Tant que la série n'est pas validée, la vue de lecture et les totaux l'ignorent.
    const before = withoutDrafts((await getWorkoutDetails(done.id, database))!)
    expect(before.exercises.map((e) => e.exercise?.name)).toEqual(['Squat barre'])
    expect((await listCompletedWorkoutSummaries('user', database))[0]).toMatchObject({ setCount: 1, exerciseNames: ['Squat barre'] })

    await saveSet(draft!.id, { values: { reps: 10 }, completed: true }, {}, database)
    expect(await finishEditing(done.id, database)).toEqual({ completedSets: 2, discardedSets: 1 })
    expect(await database.workoutExercises.get(unused.id)).toBeUndefined()
    expect((await listCompletedWorkoutSummaries('user', database))[0]).toMatchObject({
      setCount: 2,
      exerciseNames: ['Squat barre', 'Tractions pronation'],
    })
    expect(await getActiveWorkout(database)).toBeUndefined()
  })

  it('refuse de clore une correction qui ne laisse aucune série validée', async () => {
    const done = await completedWorkout(squat.id, [{ weightKg: 60, reps: 8 }])
    const [set] = await database.sets.where('workoutId').equals(done.id).toArray()
    await saveSet(set!.id, { completed: false }, {}, database)
    await expect(finishEditing(done.id, database)).rejects.toThrow(/supprimez la séance/)
    expect(await database.sets.count()).toBe(1)
  })

  it('corrige la date et la durée, dans des limites raisonnables', async () => {
    const done = await completedWorkout(squat.id, [{ weightKg: 60, reps: 8 }])
    const startedAt = new Date(2026, 8, 1, 18, 30).getTime()

    const moved = await updateWorkoutSchedule(done.id, { startedAt, durationMin: 75 }, database)
    expect(moved).toMatchObject({ startedAt, endedAt: startedAt + 75 * 60_000 })
    expect((await listCompletedWorkoutSummaries('user', database))[0]?.durationSec).toBe(4500)

    await expect(updateWorkoutSchedule(done.id, { startedAt: Date.now() + 3_600_000, durationMin: 60 }, database)).rejects.toThrow(/futur/)
    await expect(updateWorkoutSchedule(done.id, { startedAt, durationMin: 0 }, database)).rejects.toThrow(/durée/)
    await expect(updateWorkoutSchedule(done.id, { startedAt: Number.NaN, durationMin: 60 }, database)).rejects.toThrow(/invalide/)

    const active = await startWorkout(database)
    await expect(updateWorkoutSchedule(active.id, { startedAt, durationMin: 60 }, database)).rejects.toThrow(/pas terminée/)
  })

  it('fait suivre la « dernière performance » quand on redate une séance', async () => {
    const older = await completedWorkout(squat.id, [{ weightKg: 60, reps: 8 }])
    const newer = await completedWorkout(squat.id, [{ weightKg: 70, reps: 5 }])
    expect((await getLastPerformance(squat.id, database))?.workout.id).toBe(newer.id)

    await updateWorkoutSchedule(newer.id, { startedAt: older.startedAt - 86_400_000, durationMin: 60 }, database)
    expect((await getLastPerformance(squat.id, database))?.workout.id).toBe(older.id)
  })

  it('refuse de modifier une séance de démonstration', async () => {
    await enableDemoMode(database)
    const demo = (await database.workouts.where('origin').equals('demo').first())!
    const demoSet = (await database.sets.where('workoutId').equals(demo.id).first())!
    await expect(saveSet(demoSet.id, { values: { weightKg: 1, reps: 1 } }, {}, database)).rejects.toThrow(/ne peut pas être modifiée/)
    await expect(updateWorkoutInfo(demo.id, { name: 'x' }, database)).rejects.toThrow(ValidationError)
    await expect(startWorkoutFrom(demo.id, database)).rejects.toThrow(ValidationError)
  })

  it('refait une séance avec les mêmes exercices, sauf ceux archivés', async () => {
    const workout = await startWorkout(database)
    await updateWorkoutInfo(workout.id, { name: 'Jambes' }, database)
    for (const exercise of [squat, pullUp]) {
      const item = await addExerciseToWorkout(workout.id, exercise.id, undefined, database)
      const [set] = await activeSets(item.id)
      await saveSet(set!.id, { values: { weightKg: 50, reps: 8 }, completed: true }, {}, database)
    }
    await finishWorkout(workout.id, database)
    await setExerciseArchived(pullUp.id, true, database)

    const again = await startWorkoutFrom(workout.id, database)
    expect(again).toMatchObject({ skipped: 1, workout: { name: 'Jambes', status: 'in_progress' } })
    const session = (await getActiveSession(database))!
    expect(session.workout.name).toBe('Jambes')
    expect(session.exercises.map((e) => e.exercise?.name)).toEqual(['Squat barre'])
    expect(session.exercises[0]?.sets[0]).toMatchObject({ weightKg: 50, reps: 8, completed: false })

    await expect(startWorkoutFrom(workout.id, database)).rejects.toThrow(/déjà en cours/)
  })

  it('convertit les dates des champs de saisie', () => {
    const timestamp = new Date(2026, 8, 1, 7, 5).getTime()
    expect(toDateTimeLocal(timestamp)).toBe('2026-09-01T07:05')
    expect(fromDateTimeLocal('2026-09-01T07:05')).toBe(timestamp)
    expect(fromDateTimeLocal('')).toBeNaN()
  })
})

describe('saisie des séries', () => {
  it('convertit les charges selon l’unité', () => {
    expect(parseFieldTexts({ weight: '62,5', reps: '8' }, 'weight_reps', 'kg')).toEqual({ weightKg: 62.5, reps: 8 })
    const inLb = parseFieldTexts({ weight: '135', reps: '5' }, 'weight_reps', 'lb')
    expect(inLb.weightKg).toBeCloseTo(61.235, 3)
    // Aller-retour sans dérive d'affichage.
    expect(toFieldTexts(inLb, 'weight_reps', 'lb')).toEqual({ weight: '135', reps: '5' })
    expect(toFieldTexts({ weightKg: 62.5, reps: 8 }, 'weight_reps', 'kg')).toEqual({ weight: '62,5', reps: '8' })
  })

  it('laisse les champs vides non définis et rejette les saisies illisibles', () => {
    expect(parseFieldTexts({ weight: '', reps: ' ' }, 'weight_reps', 'kg')).toEqual({})
    expect(toFieldTexts({}, 'weight_reps', 'kg')).toEqual({ weight: '', reps: '' })
    expect(() => parseFieldTexts({ weight: 'abc' }, 'weight_reps', 'kg')).toThrow(SetInputError)
    expect(() => parseFieldTexts({ weight: '-5' }, 'weight_reps', 'kg')).toThrow(SetInputError)
    expect(() => parseFieldTexts({ reps: '7,5' }, 'bodyweight_reps', 'kg')).toThrow(/entier/)
  })

  it('lit les durées en secondes, en minutes ou au format m:ss', () => {
    expect(parseDuration('90', 'duration')).toBe(90)
    expect(parseDuration('1:30', 'duration')).toBe(90)
    expect(parseDuration('25', 'distance_duration')).toBe(1500)
    expect(parseDuration('25:30', 'distance_duration')).toBe(1530)
    expect(parseDuration('1:02:03', 'distance_duration')).toBe(3723)
    expect(parseDuration('', 'duration')).toBeUndefined()
    expect(() => parseDuration('1:x', 'duration')).toThrow(SetInputError)

    expect(parseFieldTexts({ distance: '5,2', duration: '25:30' }, 'distance_duration', 'kg')).toEqual({ distanceM: 5200, durationSec: 1530 })
    expect(toFieldTexts({ distanceM: 5200, durationSec: 1530 }, 'distance_duration', 'kg')).toEqual({ distance: '5,2', duration: '25:30' })
    expect(toFieldTexts({ durationSec: 90 }, 'duration', 'kg')).toEqual({ duration: '90' })
  })

  it('formate chronomètre et contenu de série', () => {
    expect([5, 245, 3765].map(formatClock)).toEqual(['0:05', '4:05', '1:02:45'])
    expect(formatSetValues({ weightKg: 60, reps: 8 }, 'kg')).toBe('60 kg × 8 rép.')
    expect(formatSetValues({ distanceM: 5200, durationSec: 1530 }, 'kg')).toBe('5,2 km × 25 min 30')
    expect(formatSetValues({}, 'kg')).toBe('—')
  })
})
