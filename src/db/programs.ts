import type {
  DataOrigin,
  Id,
  Program,
  ProgramDay,
  ProgramExercise,
  Timestamp,
  Workout,
} from '@/types/models'
import { createId, db, type KemitlogDatabase } from './database'
import { ValidationError } from './errors'
import { addExerciseToWorkout, startWorkout, WORKOUT_NAME_MAX_LENGTH } from './session'

/**
 * Programmes d'entraînement. Un programme est un document unique (ses jours et
 * leurs exercices sont embarqués) : il est validé et enregistré en entier.
 */

export const PROGRAM_LIMITS = {
  nameLength: 60,
  descriptionLength: 300,
  dayNameLength: 40,
  days: 14,
  exercisesPerDay: 30,
  sets: 20,
  repsLength: 20,
  restSec: 3600,
} as const

export interface ProgramDayInput {
  /** Identifiant du jour existant ; absent pour un nouveau jour. */
  id?: Id
  name: string
  exercises: ProgramExercise[]
}

export interface ProgramInput {
  name: string
  description?: string
  days: ProgramDayInput[]
}

function clean(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

function normalizeExercise(entry: ProgramExercise, dayName: string, knownIds: Set<Id>): ProgramExercise {
  if (!knownIds.has(entry.exerciseId)) {
    throw new ValidationError(`« ${dayName} » contient un exercice qui n’existe plus.`)
  }
  if (
    !Number.isInteger(entry.targetSets) ||
    entry.targetSets < 1 ||
    entry.targetSets > PROGRAM_LIMITS.sets
  ) {
    throw new ValidationError(
      `« ${dayName} » : le nombre de séries doit être un entier entre 1 et ${PROGRAM_LIMITS.sets}.`,
    )
  }
  const targetReps = clean(entry.targetReps ?? '')
  if (targetReps.length > PROGRAM_LIMITS.repsLength) {
    throw new ValidationError(`« ${dayName} » : l’objectif de répétitions est trop long.`)
  }
  if (
    entry.restSec !== undefined &&
    (!Number.isFinite(entry.restSec) || entry.restSec < 0 || entry.restSec > PROGRAM_LIMITS.restSec)
  ) {
    throw new ValidationError(`« ${dayName} » : le temps de repos est hors limites.`)
  }
  return {
    exerciseId: entry.exerciseId,
    targetSets: entry.targetSets,
    ...(targetReps ? { targetReps } : {}),
    ...(entry.restSec !== undefined ? { restSec: Math.round(entry.restSec) } : {}),
  }
}

/** Nettoie et valide un programme complet. Lève `ValidationError` avec un message affichable. */
function normalizeProgram(
  input: ProgramInput,
  knownIds: Set<Id>,
): { name: string; description?: string; days: ProgramDay[] } {
  const name = clean(input.name)
  if (name.length === 0) throw new ValidationError('Le nom du programme est obligatoire.')
  if (name.length > PROGRAM_LIMITS.nameLength) {
    throw new ValidationError(`Le nom ne peut pas dépasser ${PROGRAM_LIMITS.nameLength} caractères.`)
  }
  const description = (input.description ?? '').trim()
  if (description.length > PROGRAM_LIMITS.descriptionLength) {
    throw new ValidationError(
      `La description ne peut pas dépasser ${PROGRAM_LIMITS.descriptionLength} caractères.`,
    )
  }
  if (input.days.length === 0) throw new ValidationError('Ajoutez au moins un jour au programme.')
  if (input.days.length > PROGRAM_LIMITS.days) {
    throw new ValidationError(`Un programme ne peut pas dépasser ${PROGRAM_LIMITS.days} jours.`)
  }

  const days = input.days.map((day, index): ProgramDay => {
    const dayName = clean(day.name)
    if (dayName.length === 0) throw new ValidationError(`Le jour ${index + 1} n’a pas de nom.`)
    if (dayName.length > PROGRAM_LIMITS.dayNameLength) {
      throw new ValidationError(
        `Le nom d’un jour ne peut pas dépasser ${PROGRAM_LIMITS.dayNameLength} caractères.`,
      )
    }
    if (day.exercises.length === 0) {
      throw new ValidationError(`« ${dayName} » ne contient aucun exercice.`)
    }
    if (day.exercises.length > PROGRAM_LIMITS.exercisesPerDay) {
      throw new ValidationError(
        `« ${dayName} » dépasse ${PROGRAM_LIMITS.exercisesPerDay} exercices.`,
      )
    }
    return {
      id: day.id ?? createId(),
      name: dayName,
      exercises: day.exercises.map((entry) => normalizeExercise(entry, dayName, knownIds)),
    }
  })

  if (new Set(days.map((day) => day.id)).size !== days.length) {
    throw new ValidationError('Deux jours du programme portent le même identifiant.')
  }
  return { name, ...(description ? { description } : {}), days }
}

// ───────────────────────────── Lecture ─────────────────────────────

export interface ProgramOverview {
  program: Program
  /** Jour suggéré : celui qui suit le dernier jour réalisé, en boucle. */
  nextDayId: Id | undefined
  /** Début de la dernière séance terminée issue du programme. */
  lastUsedAt: Timestamp | undefined
}

/** Programmes d'un périmètre, par ordre alphabétique, avec le prochain jour suggéré. */
export async function listProgramOverviews(
  origin: DataOrigin,
  database: KemitlogDatabase = db,
): Promise<ProgramOverview[]> {
  return database.transaction('r', database.programs, database.workouts, async () => {
    const programs = await database.programs.where('origin').equals(origin).toArray()
    programs.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))

    return Promise.all(
      programs.map(async (program) => {
        const done = (await database.workouts.where('programId').equals(program.id).toArray())
          .filter((workout) => workout.status === 'completed')
          .sort((a, b) => b.startedAt - a.startedAt)
        const last = done[0]
        const lastIndex = program.days.findIndex((day) => day.id === last?.programDayId)
        const next = program.days[(lastIndex + 1) % Math.max(1, program.days.length)]
        return { program, nextDayId: next?.id, lastUsedAt: last?.startedAt }
      }),
    )
  })
}

export async function getProgram(
  programId: Id,
  database: KemitlogDatabase = db,
): Promise<Program | undefined> {
  return database.programs.get(programId)
}

// ───────────────────────────── Écriture ─────────────────────────────

/** Crée un programme réel, ou remplace celui désigné par `programId`. */
export async function saveProgram(
  input: ProgramInput,
  programId?: Id,
  database: KemitlogDatabase = db,
): Promise<Program> {
  return database.transaction('rw', database.programs, database.exercises, async () => {
    const knownIds = new Set(
      (await database.exercises.where('origin').equals('user').primaryKeys()) as Id[],
    )
    const normalized = normalizeProgram(input, knownIds)

    const existing = (await database.programs.where('origin').equals('user').toArray()).filter(
      (program) => program.id !== programId,
    )
    if (
      existing.some(
        (program) => program.name.localeCompare(normalized.name, 'fr', { sensitivity: 'base' }) === 0,
      )
    ) {
      throw new ValidationError(`Un programme nommé « ${normalized.name} » existe déjà.`)
    }

    const now = Date.now()
    let createdAt = now
    if (programId !== undefined) {
      const current = await database.programs.get(programId)
      if (!current || current.origin !== 'user') {
        throw new ValidationError('Ce programme est introuvable ou ne peut pas être modifié.')
      }
      createdAt = current.createdAt
    }
    const program: Program = {
      id: programId ?? createId(),
      origin: 'user',
      ...normalized,
      createdAt,
      updatedAt: now,
    }
    await database.programs.put(program)
    return program
  })
}

/** Supprime un programme réel. Les séances déjà réalisées sont conservées. */
export async function deleteProgram(programId: Id, database: KemitlogDatabase = db): Promise<void> {
  await database.transaction('rw', database.programs, async () => {
    const program = await database.programs.get(programId)
    if (!program || program.origin !== 'user') {
      throw new ValidationError('Ce programme est introuvable ou ne peut pas être supprimé.')
    }
    await database.programs.delete(programId)
  })
}

/**
 * Démarre une séance à partir d'un jour de programme : les séries sont créées
 * selon le plan et préremplies avec la dernière performance. Les exercices
 * archivés ou supprimés depuis sont ignorés (`skipped`).
 */
export async function startWorkoutFromProgram(
  programId: Id,
  dayId: Id,
  database: KemitlogDatabase = db,
): Promise<{ workout: Workout; skipped: number }> {
  return database.transaction(
    'rw',
    [database.programs, database.workouts, database.workoutExercises, database.sets, database.exercises],
    async () => {
      const program = await database.programs.get(programId)
      const day = program?.days.find((item) => item.id === dayId)
      if (!program || program.origin !== 'user' || !day) {
        throw new ValidationError('Ce jour de programme est introuvable.')
      }

      const available = []
      for (const entry of day.exercises) {
        const exercise = await database.exercises.get(entry.exerciseId)
        if (exercise && !exercise.archived) available.push(entry)
      }
      if (available.length === 0) {
        throw new ValidationError('Aucun exercice de ce jour n’est disponible (tous archivés ou supprimés).')
      }

      const started = await startWorkout(database)
      const workout: Workout = {
        ...started,
        name: `${program.name} — ${day.name}`.slice(0, WORKOUT_NAME_MAX_LENGTH),
        programId,
        programDayId: dayId,
      }
      await database.workouts.put(workout)
      for (const entry of available) {
        await addExerciseToWorkout(
          workout.id,
          entry.exerciseId,
          { targetSets: entry.targetSets, targetReps: entry.targetReps, restSec: entry.restSec },
          database,
        )
      }
      return { workout, skipped: day.exercises.length - available.length }
    },
  )
}
