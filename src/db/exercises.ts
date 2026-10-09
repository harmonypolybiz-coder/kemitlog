import { EXERCISE_CATALOG } from '@/data/exerciseCatalog'
import type { DataOrigin, Exercise, Id } from '@/types/models'
import { createId, db, type KemitlogDatabase } from './database'
import { ValidationError } from './errors'

export const EXERCISE_NAME_MAX_LENGTH = 60
export const EXERCISE_NOTES_MAX_LENGTH = 500

export { ValidationError }

export type ExerciseInput = Pick<Exercise, 'name' | 'muscleGroup' | 'equipment' | 'trackingType'> & {
  notes?: string
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0
}

/** Nettoie et valide la saisie. Lève `ValidationError` avec un message affichable. */
function normalizeInput(input: ExerciseInput): ExerciseInput {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const notes = input.notes?.trim() ?? ''
  if (name.length === 0) {
    throw new ValidationError("Le nom de l'exercice est obligatoire.")
  }
  if (name.length > EXERCISE_NAME_MAX_LENGTH) {
    throw new ValidationError(`Le nom ne peut pas dépasser ${EXERCISE_NAME_MAX_LENGTH} caractères.`)
  }
  if (notes.length > EXERCISE_NOTES_MAX_LENGTH) {
    throw new ValidationError(
      `Les notes ne peuvent pas dépasser ${EXERCISE_NOTES_MAX_LENGTH} caractères.`,
    )
  }
  return {
    name,
    muscleGroup: input.muscleGroup,
    equipment: input.equipment,
    trackingType: input.trackingType,
    ...(notes ? { notes } : {}),
  }
}

/** Le nom doit être unique dans la bibliothèque réelle (casse et accents ignorés). */
function assertUniqueName(existing: Exercise[], name: string, exceptId?: Id): void {
  const duplicate = existing.find(
    (exercise) => exercise.id !== exceptId && sameName(exercise.name, name),
  )
  if (duplicate) {
    throw new ValidationError(
      duplicate.archived
        ? `Un exercice archivé nommé « ${duplicate.name} » existe déjà : désarchivez-le ou choisissez un autre nom.`
        : `Un exercice nommé « ${duplicate.name} » existe déjà.`,
    )
  }
}

/** Exercices d'un périmètre : favoris d'abord, puis ordre alphabétique. */
export async function listExercises(
  origin: DataOrigin,
  database: KemitlogDatabase = db,
): Promise<Exercise[]> {
  const exercises = await database.exercises.where('origin').equals(origin).toArray()
  return exercises.sort(
    (a, b) =>
      Number(b.favorite ?? false) - Number(a.favorite ?? false) ||
      a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
  )
}

/** Crée un exercice personnalisé dans les données réelles. */
export async function createExercise(
  input: ExerciseInput,
  database: KemitlogDatabase = db,
): Promise<Exercise> {
  const normalized = normalizeInput(input)
  return database.transaction('rw', database.exercises, async () => {
    assertUniqueName(await listExercises('user', database), normalized.name)
    const now = Date.now()
    const exercise: Exercise = {
      id: createId(),
      origin: 'user',
      ...normalized,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    await database.exercises.add(exercise)
    return exercise
  })
}

/** Modifie un exercice réel. Son historique reste attaché à son identifiant. */
export async function updateExercise(
  id: Id,
  input: ExerciseInput,
  database: KemitlogDatabase = db,
): Promise<Exercise> {
  const normalized = normalizeInput(input)
  return database.transaction('rw', database.exercises, async () => {
    const current = await database.exercises.get(id)
    if (!current || current.origin !== 'user') {
      throw new ValidationError('Cet exercice est introuvable ou ne peut pas être modifié.')
    }
    assertUniqueName(await listExercises('user', database), normalized.name, id)

    // `notes` est retiré de l'existant pour pouvoir être effacé par une saisie vide.
    const { notes: _previousNotes, ...rest } = current
    const next: Exercise = { ...rest, ...normalized, updatedAt: Date.now() }
    await database.exercises.put(next)
    return next
  })
}

async function patchUserExercise(
  id: Id,
  patch: Partial<Pick<Exercise, 'archived' | 'favorite'>>,
  database: KemitlogDatabase,
): Promise<void> {
  await database.transaction('rw', database.exercises, async () => {
    const current = await database.exercises.get(id)
    if (!current || current.origin !== 'user') {
      throw new ValidationError('Cet exercice est introuvable ou ne peut pas être modifié.')
    }
    await database.exercises.update(id, { ...patch, updatedAt: Date.now() })
  })
}

export function setExerciseArchived(
  id: Id,
  archived: boolean,
  database: KemitlogDatabase = db,
): Promise<void> {
  return patchUserExercise(id, { archived }, database)
}

export function setExerciseFavorite(
  id: Id,
  favorite: boolean,
  database: KemitlogDatabase = db,
): Promise<void> {
  return patchUserExercise(id, { favorite }, database)
}

/**
 * Ajoute des exercices du catalogue à la bibliothèque réelle. Ceux déjà présents
 * (même entrée de catalogue ou même nom) sont ignorés : l'opération est répétable.
 */
export async function addCatalogExercises(
  catalogIds: readonly string[],
  database: KemitlogDatabase = db,
): Promise<{ added: number; skipped: number }> {
  const wanted = new Set(catalogIds)
  const entries = EXERCISE_CATALOG.filter((entry) => wanted.has(entry.id))

  return database.transaction('rw', database.exercises, async () => {
    const existing = await listExercises('user', database)
    const now = Date.now()
    const additions: Exercise[] = []
    for (const entry of entries) {
      const known = [...existing, ...additions].some(
        (exercise) => exercise.catalogId === entry.id || sameName(exercise.name, entry.name),
      )
      if (known) continue
      additions.push({
        id: createId(),
        origin: 'user',
        name: entry.name,
        muscleGroup: entry.muscleGroup,
        equipment: entry.equipment,
        trackingType: entry.trackingType,
        catalogId: entry.id,
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
    }
    await database.exercises.bulkAdd(additions)
    return { added: additions.length, skipped: entries.length - additions.length }
  })
}

export interface ExerciseUsage {
  /** Nombre de séances dans lesquelles l'exercice apparaît. */
  workouts: number
  /** Nombre de programmes qui le référencent. */
  programs: number
}

export async function getExerciseUsage(
  id: Id,
  database: KemitlogDatabase = db,
): Promise<ExerciseUsage> {
  return database.transaction('r', database.workoutExercises, database.programs, async () => {
    const workoutIds = await database.workoutExercises.where('exerciseId').equals(id).toArray()
    const programs = await database.programs
      .filter((program) =>
        program.days.some((day) => day.exercises.some((entry) => entry.exerciseId === id)),
      )
      .count()
    return { workouts: new Set(workoutIds.map((item) => item.workoutId)).size, programs }
  })
}

/**
 * Supprime un exercice s'il n'apparaît dans aucune séance ni programme ; sinon l'archive
 * pour préserver l'historique. Renvoie l'action effectuée.
 */
export async function removeExercise(
  id: Id,
  database: KemitlogDatabase = db,
): Promise<'deleted' | 'archived'> {
  return database.transaction(
    'rw',
    database.exercises,
    database.workoutExercises,
    database.programs,
    async () => {
      const usage = await getExerciseUsage(id, database)
      if (usage.workouts > 0 || usage.programs > 0) {
        await database.exercises.update(id, { archived: true, updatedAt: Date.now() })
        return 'archived'
      }
      await database.exercises.delete(id)
      return 'deleted'
    },
  )
}
