import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Exercise } from '@/types/models'
import { createBackup, parseBackup, restoreBackup, serializeBackup } from './backup'
import { KemitlogDatabase } from './database'
import { enableDemoMode } from './demo/demoMode'
import { ValidationError } from './errors'
import { addCatalogExercises, listExercises, removeExercise, setExerciseArchived } from './exercises'
import {
  deleteProgram,
  getProgram,
  listProgramOverviews,
  saveProgram,
  startWorkoutFromProgram,
  type ProgramInput,
} from './programs'
import { finishWorkout, getActiveSession, getActiveWorkout, saveSet } from './session'
import { deleteWorkout } from './workouts'

let counter = 0
let database: KemitlogDatabase
let squat: Exercise
let bench: Exercise
let pullUp: Exercise

beforeEach(async () => {
  counter += 1
  database = new KemitlogDatabase(`kemitlog-programs-test-${counter}`)
  await addCatalogExercises(['back-squat', 'bench-press', 'pull-up'], database)
  const byCatalogId = new Map((await listExercises('user', database)).map((e) => [e.catalogId, e]))
  squat = byCatalogId.get('back-squat')!
  bench = byCatalogId.get('bench-press')!
  pullUp = byCatalogId.get('pull-up')!
})

afterEach(async () => {
  await database.delete()
})

function plan(): ProgramInput {
  return {
    name: '  Force  3 jours ',
    description: ' Cycle de base ',
    days: [
      {
        name: 'Jour A',
        exercises: [
          { exerciseId: squat.id, targetSets: 3, targetReps: ' 5 ', restSec: 180 },
          { exerciseId: bench.id, targetSets: 2 },
        ],
      },
      { name: 'Jour B', exercises: [{ exerciseId: pullUp.id, targetSets: 4, targetReps: '6-10' }] },
    ],
  }
}

/** Valide toutes les séries de la séance en cours avec les valeurs données, puis la termine. */
async function completeActive(values: { weightKg?: number; reps: number }) {
  const session = (await getActiveSession(database))!
  for (const entry of session.exercises) {
    for (const set of entry.sets) {
      const withWeight = entry.exercise?.trackingType === 'weight_reps'
      await saveSet(
        set.id,
        { values: withWeight ? { weightKg: values.weightKg ?? 50, reps: values.reps } : { reps: values.reps }, completed: true },
        {},
        database,
      )
    }
  }
  return (await finishWorkout(session.workout.id, database)).workout
}

describe('enregistrement d’un programme', () => {
  it('crée un programme normalisé et le relit après réouverture', async () => {
    const created = await saveProgram(plan(), undefined, database)
    expect(created).toMatchObject({ origin: 'user', name: 'Force 3 jours', description: 'Cycle de base' })
    expect(created.days.map((d) => d.name)).toEqual(['Jour A', 'Jour B'])
    expect(created.days[0]!.exercises[0]).toEqual({ exerciseId: squat.id, targetSets: 3, targetReps: '5', restSec: 180 })
    expect(created.days[0]!.exercises[1]).toEqual({ exerciseId: bench.id, targetSets: 2 })

    database.close()
    const reopened = new KemitlogDatabase(database.name)
    expect(await getProgram(created.id, reopened)).toEqual(created)
    reopened.close()
  })

  it('met à jour en conservant l’identité du programme et de ses jours', async () => {
    const created = await saveProgram(plan(), undefined, database)
    const [dayA, dayB] = created.days
    const updated = await saveProgram(
      {
        name: 'Force',
        days: [
          { id: dayB!.id, name: 'Tirage', exercises: dayB!.exercises },
          { id: dayA!.id, name: 'Jour A', exercises: dayA!.exercises },
          { name: 'Jour C', exercises: [{ exerciseId: bench.id, targetSets: 5 }] },
        ],
      },
      created.id,
      database,
    )
    expect(updated).toMatchObject({ id: created.id, createdAt: created.createdAt, name: 'Force' })
    expect('description' in updated).toBe(false)
    expect(updated.days.map((d) => d.id).slice(0, 2)).toEqual([dayB!.id, dayA!.id])
    expect(updated.days[2]!.id).toBeTypeOf('string')
    expect(await database.programs.count()).toBe(1)
  })

  it('rejette les programmes invalides sans rien enregistrer', async () => {
    const invalid: Array<[string, (p: ProgramInput) => void, RegExp]> = [
      ['nom vide', (p) => (p.name = ' '), /nom du programme/],
      ['aucun jour', (p) => (p.days = []), /au moins un jour/],
      ['jour sans nom', (p) => (p.days[0]!.name = ''), /pas de nom/],
      ['jour sans exercice', (p) => (p.days[1]!.exercises = []), /aucun exercice/],
      ['séries à zéro', (p) => (p.days[0]!.exercises[0]!.targetSets = 0), /nombre de séries/],
      ['séries non entières', (p) => (p.days[0]!.exercises[0]!.targetSets = 2.5), /nombre de séries/],
      ['repos négatif', (p) => (p.days[0]!.exercises[0]!.restSec = -1), /repos/],
      ['exercice inconnu', (p) => (p.days[0]!.exercises[0]!.exerciseId = 'inconnu'), /n’existe plus/],
    ]
    for (const [label, mutate, message] of invalid) {
      const input = plan()
      mutate(input)
      await expect(saveProgram(input, undefined, database), label).rejects.toThrow(message)
    }
    expect(await database.programs.count()).toBe(0)
  })

  it('refuse un nom en double et la modification d’un programme de démonstration', async () => {
    await saveProgram(plan(), undefined, database)
    await expect(saveProgram({ ...plan(), name: 'force 3 JOURS' }, undefined, database)).rejects.toThrow(/existe déjà/)

    await enableDemoMode(database)
    const demo = (await listProgramOverviews('demo', database))[0]!.program
    await expect(saveProgram(plan(), demo.id, database)).rejects.toThrow(ValidationError)
    await expect(deleteProgram(demo.id, database)).rejects.toThrow(ValidationError)
    await expect(startWorkoutFromProgram(demo.id, demo.days[0]!.id, database)).rejects.toThrow(ValidationError)
    expect((await listProgramOverviews('user', database)).map((o) => o.program.name)).toEqual(['Force 3 jours'])
  })

  it('archive plutôt que supprimer un exercice utilisé par un programme', async () => {
    await saveProgram(plan(), undefined, database)
    expect(await removeExercise(squat.id, database)).toBe('archived')
  })
})

describe('séance issue d’un programme', () => {
  it('crée les séries du plan, avec objectif et repos de l’exercice', async () => {
    const program = await saveProgram(plan(), undefined, database)
    const dayA = program.days[0]!
    const { workout, skipped } = await startWorkoutFromProgram(program.id, dayA.id, database)
    expect(skipped).toBe(0)
    expect(workout).toMatchObject({
      name: 'Force 3 jours — Jour A',
      status: 'in_progress',
      programId: program.id,
      programDayId: dayA.id,
    })

    const session = (await getActiveSession(database))!
    expect(session.exercises.map((e) => [e.exercise?.name, e.sets.length])).toEqual([
      ['Squat barre', 3],
      ['Développé couché', 2],
    ])
    expect(session.exercises[0]!.workoutExercise).toMatchObject({ targetSets: 3, targetReps: '5', restSec: 180 })
    expect('restSec' in session.exercises[1]!.workoutExercise).toBe(false)
    expect(session.exercises[0]!.sets.every((s) => !s.completed && s.weightKg === undefined)).toBe(true)

    await expect(startWorkoutFromProgram(program.id, dayA.id, database)).rejects.toThrow(/déjà en cours/)
  })

  it('préremplit avec la dernière performance, en respectant le nombre de séries du plan', async () => {
    const program = await saveProgram(plan(), undefined, database)
    const dayA = program.days[0]!
    await startWorkoutFromProgram(program.id, dayA.id, database)
    await completeActive({ weightKg: 80, reps: 5 })

    // Le plan passe à 4 séries de squat : la 4e reprend la dernière série connue.
    await saveProgram(
      { ...plan(), days: [{ id: dayA.id, name: 'Jour A', exercises: [{ exerciseId: squat.id, targetSets: 4 }] }] },
      program.id,
      database,
    )
    await startWorkoutFromProgram(program.id, dayA.id, database)
    const sets = (await getActiveSession(database))!.exercises[0]!.sets
    expect(sets.map((s) => [s.weightKg, s.reps, s.completed])).toEqual(Array(4).fill([80, 5, false]))
  })

  it('suggère le jour suivant, en boucle, d’après les séances terminées', async () => {
    const program = await saveProgram(plan(), undefined, database)
    const [dayA, dayB] = program.days
    const next = async () => (await listProgramOverviews('user', database))[0]!

    expect(await next()).toMatchObject({ nextDayId: dayA!.id, lastUsedAt: undefined })

    // Une séance seulement démarrée ne fait pas avancer le programme.
    await startWorkoutFromProgram(program.id, dayA!.id, database)
    expect((await next()).nextDayId).toBe(dayA!.id)
    const first = await completeActive({ reps: 5 })
    expect(await next()).toMatchObject({ nextDayId: dayB!.id, lastUsedAt: first.startedAt })

    await startWorkoutFromProgram(program.id, dayB!.id, database)
    await completeActive({ reps: 8 })
    expect((await next()).nextDayId).toBe(dayA!.id)
  })

  it('ignore les exercices archivés et refuse un jour sans exercice disponible', async () => {
    const program = await saveProgram(plan(), undefined, database)
    const [dayA, dayB] = program.days
    await setExerciseArchived(bench.id, true, database)
    expect((await startWorkoutFromProgram(program.id, dayA!.id, database)).skipped).toBe(1)
    await deleteWorkout((await getActiveWorkout(database))!.id, database)

    await setExerciseArchived(pullUp.id, true, database)
    await expect(startWorkoutFromProgram(program.id, dayB!.id, database)).rejects.toThrow(/Aucun exercice/)
    expect(await getActiveWorkout(database)).toBeUndefined()
  })

  it('conserve les séances réalisées quand le programme est supprimé', async () => {
    const program = await saveProgram(plan(), undefined, database)
    await startWorkoutFromProgram(program.id, program.days[1]!.id, database)
    const done = await completeActive({ reps: 8 })

    await deleteProgram(program.id, database)
    expect(await listProgramOverviews('user', database)).toEqual([])
    expect((await database.workouts.get(done.id))?.status).toBe('completed')
  })

  it('sauvegarde et restaure programmes et objectifs de séance', async () => {
    const program = await saveProgram(plan(), undefined, database)
    await startWorkoutFromProgram(program.id, program.days[0]!.id, database)
    await completeActive({ weightKg: 60, reps: 5 })

    const backup = await createBackup(database)
    const restored = parseBackup(serializeBackup(backup))
    expect(restored.data.programs).toEqual(backup.data.programs)
    // L'export n'a pas d'ordre garanti : on cible l'exercice par son identifiant.
    const restoredSquat = restored.data.workoutExercises.find((item) => item.exerciseId === squat.id)
    expect(restoredSquat).toMatchObject({ targetSets: 3, targetReps: '5', restSec: 180 })
    await restoreBackup(restored, 'replace', database)
    expect((await createBackup(database)).data).toEqual(backup.data)
  })
})
