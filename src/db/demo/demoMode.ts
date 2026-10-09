import { clearOrigin } from '../backup'
import { db, originTables, type KemitlogDatabase } from '../database'
import { updatePreferences } from '../preferences'
import { generateDemoData } from './demoData'

/**
 * Active le mode démonstration : (re)génère le jeu fictif et bascule l'affichage
 * dessus. Les données réelles ne sont ni lues ni modifiées.
 */
export async function enableDemoMode(database: KemitlogDatabase = db): Promise<void> {
  const demo = generateDemoData()
  await database.transaction('rw', [...originTables(database), database.preferences], async () => {
    await clearOrigin('demo', database)
    await database.exercises.bulkAdd(demo.exercises)
    await database.programs.bulkAdd(demo.programs)
    await database.workouts.bulkAdd(demo.workouts)
    await database.workoutExercises.bulkAdd(demo.workoutExercises)
    await database.sets.bulkAdd(demo.sets)
    await updatePreferences({ dataScope: 'demo' }, database)
  })
}

/** Quitte le mode démonstration et efface le jeu fictif de la base. */
export async function disableDemoMode(database: KemitlogDatabase = db): Promise<void> {
  await database.transaction('rw', [...originTables(database), database.preferences], async () => {
    await clearOrigin('demo', database)
    await updatePreferences({ dataScope: 'user' }, database)
  })
}
