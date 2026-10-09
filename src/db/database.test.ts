import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BackupError,
  clearOrigin,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from './backup'
import { KemitlogDatabase } from './database'
import { generateDemoData } from './demo/demoData'
import { disableDemoMode, enableDemoMode } from './demo/demoMode'
import { EXERCISE_CATALOG } from '@/data/exerciseCatalog'
import { EQUIPMENT_TYPES, MUSCLE_GROUPS, TRACKING_TYPES } from '@/types/models'
import {
  addCatalogExercises,
  createExercise,
  getExerciseUsage,
  listExercises,
  removeExercise,
  setExerciseArchived,
  setExerciseFavorite,
  updateExercise,
  ValidationError,
} from './exercises'
import { getPreferences, updatePreferences } from './preferences'
import { deleteWorkout, getWorkoutDetails, listCompletedWorkoutSummaries } from './workouts'

let counter = 0
let database: KemitlogDatabase

beforeEach(() => {
  counter += 1
  database = new KemitlogDatabase(`kemitlog-test-${counter}`)
})

afterEach(async () => {
  await database.delete()
})

const benchInput = {
  name: 'Développé couché',
  muscleGroup: 'chest',
  equipment: 'barbell',
  trackingType: 'weight_reps',
} as const

/** Insère une séance réelle d'un exercice et de deux séries (dont un échauffement). */
async function seedUserWorkout() {
  const exercise = await createExercise(benchInput, database)
  const now = Date.now()
  const common = { origin: 'user', createdAt: now, updatedAt: now } as const
  await database.workouts.add({
    ...common,
    id: 'w1',
    name: 'Séance test',
    status: 'completed',
    startedAt: now - 3_600_000,
    endedAt: now,
  })
  await database.workoutExercises.add({
    ...common,
    id: 'we1',
    workoutId: 'w1',
    exerciseId: exercise.id,
    order: 0,
  })
  const set = {
    ...common,
    workoutExerciseId: 'we1',
    workoutId: 'w1',
    exerciseId: exercise.id,
    completed: true,
  } as const
  await database.sets.bulkAdd([
    { ...set, id: 's1', order: 0, type: 'warmup', weightKg: 40, reps: 10 },
    { ...set, id: 's2', order: 1, type: 'normal', weightKg: 60, reps: 8 },
  ])
  return exercise
}

describe('préférences', () => {
  it('renvoie les valeurs par défaut puis conserve les modifications', async () => {
    expect((await getPreferences(database)).weightUnit).toBe('kg')
    await updatePreferences({ weightUnit: 'lb', defaultRestSec: 120 }, database)

    // Rouvre la base : simule une nouvelle session sur les mêmes données.
    database.close()
    const reopened = new KemitlogDatabase(database.name)
    const preferences = await getPreferences(reopened)
    expect(preferences.weightUnit).toBe('lb')
    expect(preferences.defaultRestSec).toBe(120)
    reopened.close()
  })
})

describe('exercices', () => {
  it('crée, normalise et relit un exercice après réouverture de la base', async () => {
    const created = await createExercise({ ...benchInput, name: '  Développé   couché ' }, database)
    expect(created.name).toBe('Développé couché')
    expect(created.origin).toBe('user')

    database.close()
    const reopened = new KemitlogDatabase(database.name)
    expect(await listExercises('user', reopened)).toEqual([created])
    reopened.close()
  })

  it('refuse un nom vide ou en double', async () => {
    await expect(createExercise({ ...benchInput, name: '   ' }, database)).rejects.toThrow(
      ValidationError,
    )
    await createExercise(benchInput, database)
    await expect(
      createExercise({ ...benchInput, name: 'developpe COUCHE' }, database),
    ).rejects.toThrow(ValidationError)
  })

  it('supprime un exercice inutilisé mais archive un exercice présent dans une séance', async () => {
    const unused = await createExercise({ ...benchInput, name: 'Dips' }, database)
    expect(await removeExercise(unused.id, database)).toBe('deleted')

    const used = await seedUserWorkout()
    expect(await removeExercise(used.id, database)).toBe('archived')
    expect((await database.exercises.get(used.id))?.archived).toBe(true)
  })
})

describe('séances', () => {
  it('calcule le résumé sans compter les échauffements', async () => {
    await seedUserWorkout()
    const [summary] = await listCompletedWorkoutSummaries('user', database)
    expect(summary).toMatchObject({ exerciseCount: 1, setCount: 1, volumeKg: 480, durationSec: 3600 })
  })

  it('charge le détail et supprime en cascade', async () => {
    const exercise = await seedUserWorkout()
    const details = await getWorkoutDetails('w1', database)
    expect(details?.exercises[0]?.exercise?.id).toBe(exercise.id)
    expect(details?.exercises[0]?.sets.map((set) => set.id)).toEqual(['s1', 's2'])

    await deleteWorkout('w1', database)
    expect(await database.workouts.count()).toBe(0)
    expect(await database.workoutExercises.count()).toBe(0)
    expect(await database.sets.count()).toBe(0)
    expect(await database.exercises.count()).toBe(1)
  })
})

describe('mode démonstration', () => {
  it('génère un jeu cohérent, déterministe et sans séance future', () => {
    const now = new Date(2026, 5, 15, 12).getTime()
    const demo = generateDemoData(now)
    expect(demo).toEqual(generateDemoData(now))
    expect(demo.workouts.length).toBeGreaterThan(10)
    expect(demo.workouts.every((workout) => (workout.endedAt ?? Infinity) <= now)).toBe(true)

    const all = [...demo.exercises, ...demo.workouts, ...demo.workoutExercises, ...demo.sets, ...demo.programs]
    expect(all.every((record) => record.origin === 'demo' && record.id.startsWith('demo-'))).toBe(true)
    // Le jeu fictif doit lui-même respecter les relations vérifiées à l'import.
    const asBackup = JSON.stringify({
      app: 'kemitlog',
      formatVersion: 1,
      schemaVersion: 1,
      exportedAt: now,
      data: { ...demo, preferences: { weightUnit: 'kg', defaultRestSec: 90, weekStartsOn: 1 } },
    })
    expect(() => parseBackup(asBackup)).not.toThrow()
  })

  it("n'altère pas les données réelles et disparaît à la désactivation", async () => {
    await seedUserWorkout()
    const before = await createBackup(database)

    await enableDemoMode(database)
    expect((await getPreferences(database)).dataScope).toBe('demo')
    expect((await listExercises('demo', database)).length).toBeGreaterThan(0)
    expect(await listExercises('user', database)).toEqual(before.data.exercises)
    // L'export ignore le jeu fictif même quand le mode démo est actif.
    expect((await createBackup(database)).data).toEqual(before.data)

    await disableDemoMode(database)
    expect((await getPreferences(database)).dataScope).toBe('user')
    expect(await database.exercises.where('origin').equals('demo').count()).toBe(0)
    expect(await database.sets.where('origin').equals('demo').count()).toBe(0)
    expect((await createBackup(database)).data).toEqual(before.data)
  })
})

describe('sauvegarde et restauration', () => {
  it('restaure à l’identique après effacement (export → JSON → import)', async () => {
    await seedUserWorkout()
    await updatePreferences({ weightUnit: 'lb' }, database)
    const backup = await createBackup(database)
    const text = serializeBackup(backup)

    await clearOrigin('user', database)
    await updatePreferences({ weightUnit: 'kg' }, database)
    expect(await database.exercises.count()).toBe(0)

    const counts = await restoreBackup(parseBackup(text), 'replace', database)
    expect(counts).toEqual({ exercises: 1, workouts: 1, workoutExercises: 1, sets: 2, programs: 0 })
    expect((await createBackup(database)).data).toEqual(backup.data)
  })

  it('« remplacer » efface les données réelles absentes du fichier, « fusionner » les conserve', async () => {
    await createExercise(benchInput, database)
    const backup = parseBackup(serializeBackup(await createBackup(database)))
    await createExercise({ ...benchInput, name: 'Squat' }, database)

    await restoreBackup(backup, 'merge', database)
    expect((await listExercises('user', database)).map((e) => e.name)).toEqual([
      'Développé couché',
      'Squat',
    ])

    await restoreBackup(backup, 'replace', database)
    expect((await listExercises('user', database)).map((e) => e.name)).toEqual(['Développé couché'])
  })

  it('rejette les fichiers invalides sans modifier la base', async () => {
    await seedUserWorkout()
    const valid = await createBackup(database)

    expect(() => parseBackup('pas du json')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"autre"}')).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ ...valid, formatVersion: 99 }))).toThrow(/plus récente/)

    const orphanSet = structuredClone(valid)
    orphanSet.data.workoutExercises = []
    expect(() => parseBackup(JSON.stringify(orphanSet))).toThrow(/incohérent/)

    const badEnum = structuredClone(valid) as unknown as { data: { exercises: Array<{ muscleGroup: string }> } }
    badEnum.data.exercises[0]!.muscleGroup = 'inconnu'
    expect(() => parseBackup(JSON.stringify(badEnum))).toThrow(/muscleGroup/)

    expect((await createBackup(database)).data).toEqual(valid.data)
  })
})

describe('bibliothèque d’exercices', () => {
  it('modifie un exercice, efface ses notes et conserve son identifiant', async () => {
    const created = await createExercise({ ...benchInput, notes: 'Prise large' }, database)
    expect(created.notes).toBe('Prise large')

    const updated = await updateExercise(
      created.id,
      { name: ' Développé incliné ', muscleGroup: 'chest', equipment: 'dumbbell', trackingType: 'weight_reps', notes: '  ' },
      database,
    )
    expect(updated).toMatchObject({ id: created.id, name: 'Développé incliné', equipment: 'dumbbell' })
    expect('notes' in updated).toBe(false)
    expect(await database.exercises.get(created.id)).toEqual(updated)
  })

  it('refuse un renommage en doublon mais accepte de garder son propre nom', async () => {
    const bench = await createExercise(benchInput, database)
    const squat = await createExercise({ ...benchInput, name: 'Squat' }, database)

    await expect(updateExercise(squat.id, { ...benchInput, name: 'développé couché' }, database)).rejects.toThrow(ValidationError)
    await expect(updateExercise(bench.id, { ...benchInput, notes: 'ok' }, database)).resolves.toMatchObject({ notes: 'ok' })

    await setExerciseArchived(bench.id, true, database)
    await expect(createExercise(benchInput, database)).rejects.toThrow(/archivé/)
  })

  it('refuse de modifier un exercice de démonstration', async () => {
    await enableDemoMode(database)
    const [demo] = await listExercises('demo', database)
    await expect(updateExercise(demo!.id, benchInput, database)).rejects.toThrow(ValidationError)
    await expect(setExerciseFavorite(demo!.id, true, database)).rejects.toThrow(ValidationError)
  })

  it('archive, désarchive et trie les favoris en premier', async () => {
    const bench = await createExercise(benchInput, database)
    const squat = await createExercise({ ...benchInput, name: 'Squat' }, database)

    await setExerciseFavorite(squat.id, true, database)
    expect((await listExercises('user', database)).map((e) => e.name)).toEqual(['Squat', 'Développé couché'])

    await setExerciseArchived(bench.id, true, database)
    expect((await database.exercises.get(bench.id))?.archived).toBe(true)
    await setExerciseArchived(bench.id, false, database)
    expect((await database.exercises.get(bench.id))?.archived).toBe(false)
  })

  it('compte les séances qui utilisent un exercice', async () => {
    const used = await seedUserWorkout()
    const unused = await createExercise({ ...benchInput, name: 'Dips' }, database)
    expect(await getExerciseUsage(used.id, database)).toEqual({ workouts: 1, programs: 0 })
    expect(await getExerciseUsage(unused.id, database)).toEqual({ workouts: 0, programs: 0 })
  })
})

describe('catalogue intégré', () => {
  it('a des identifiants et des noms uniques, et des valeurs valides', () => {
    expect(new Set(EXERCISE_CATALOG.map((e) => e.id)).size).toBe(EXERCISE_CATALOG.length)
    expect(new Set(EXERCISE_CATALOG.map((e) => e.name.toLowerCase())).size).toBe(EXERCISE_CATALOG.length)
    for (const entry of EXERCISE_CATALOG) {
      expect(MUSCLE_GROUPS).toContain(entry.muscleGroup)
      expect(EQUIPMENT_TYPES).toContain(entry.equipment)
      expect(TRACKING_TYPES).toContain(entry.trackingType)
      expect(entry.name.length).toBeLessThanOrEqual(60)
    }
    // Chaque groupe musculaire propose au moins un exercice.
    expect(new Set(EXERCISE_CATALOG.map((e) => e.muscleGroup)).size).toBe(MUSCLE_GROUPS.length)
  })

  it('ajoute des exercices réels sans créer de doublon', async () => {
    // Un exercice personnalisé du même nom qu'une entrée du catalogue.
    await createExercise(benchInput, database)

    const first = await addCatalogExercises(['bench-press', 'back-squat', 'plank', 'inconnu'], database)
    expect(first).toEqual({ added: 2, skipped: 1 })

    const again = await addCatalogExercises(['back-squat', 'plank'], database)
    expect(again).toEqual({ added: 0, skipped: 2 })

    const exercises = await listExercises('user', database)
    expect(exercises).toHaveLength(3)
    expect(exercises.every((e) => e.origin === 'user')).toBe(true)
    expect(exercises.find((e) => e.catalogId === 'plank')).toMatchObject({ trackingType: 'duration', muscleGroup: 'core' })
  })

  it('reconnaît un exercice du catalogue même après renommage', async () => {
    await addCatalogExercises(['back-squat'], database)
    const [squat] = await listExercises('user', database)
    await updateExercise(squat!.id, { ...benchInput, name: 'Mon squat', muscleGroup: 'legs' }, database)
    expect(await addCatalogExercises(['back-squat'], database)).toEqual({ added: 0, skipped: 1 })
  })

  it('conserve favori et origine catalogue dans une sauvegarde', async () => {
    await addCatalogExercises(['back-squat'], database)
    const [squat] = await listExercises('user', database)
    await setExerciseFavorite(squat!.id, true, database)

    const backup = await createBackup(database)
    await clearOrigin('user', database)
    await restoreBackup(parseBackup(serializeBackup(backup)), 'replace', database)
    expect((await listExercises('user', database))[0]).toMatchObject({ favorite: true, catalogId: 'back-squat' })
  })
})
