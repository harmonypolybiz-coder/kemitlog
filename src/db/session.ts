import Dexie from 'dexie'
import type {
  ActiveSession,
  Exercise,
  Id,
  LastPerformance,
  SetType,
  TrackingType,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/types/models'
import { createId, db, type KemitlogDatabase } from './database'
import { ValidationError } from './errors'
import { getWorkoutDetails } from './workouts'

/**
 * Journal de séance : toutes les écritures sur une séance passent ici, qu'elle soit
 * en cours ou corrigée après coup depuis l'historique. Une seule séance réelle peut
 * être en cours à la fois ; le mode démonstration n'a jamais de séance en cours.
 */

export const WORKOUT_NAME_MAX_LENGTH = 60
export const WORKOUT_NOTES_MAX_LENGTH = 1000

/** Valeurs saisies pour une série ; `undefined` signifie « champ vide ». */
export interface SetValues {
  weightKg?: number
  reps?: number
  durationSec?: number
  distanceM?: number
}

const VALUE_LIMITS: Record<keyof SetValues, { max: number; label: string; integer?: boolean }> = {
  weightKg: { max: 2000, label: 'La charge' },
  reps: { max: 10000, label: 'Le nombre de répétitions', integer: true },
  durationSec: { max: 24 * 3600, label: 'La durée' },
  distanceM: { max: 1_000_000, label: 'La distance' },
}

const VALUE_KEYS = Object.keys(VALUE_LIMITS) as Array<keyof SetValues>

function cleanValues(values: SetValues): SetValues {
  const clean: SetValues = {}
  for (const key of VALUE_KEYS) {
    const value = values[key]
    if (value === undefined) continue
    const { max, label, integer } = VALUE_LIMITS[key]
    if (!Number.isFinite(value) || value < 0 || value > max) {
      throw new ValidationError(`${label} est hors limites.`)
    }
    if (integer && !Number.isInteger(value)) {
      throw new ValidationError(`${label} doit être un nombre entier.`)
    }
    clean[key] = value
  }
  return clean
}

/** Vérifie qu'une série contient ce qu'il faut pour être validée, selon le type de suivi. */
function assertCompletable(values: SetValues, trackingType: TrackingType): void {
  const has = (value: number | undefined) => value !== undefined && value > 0
  switch (trackingType) {
    case 'weight_reps':
      if (values.weightKg === undefined) throw new ValidationError('Indiquez la charge (0 si aucune).')
      if (!has(values.reps)) throw new ValidationError('Indiquez le nombre de répétitions.')
      return
    case 'bodyweight_reps':
      if (!has(values.reps)) throw new ValidationError('Indiquez le nombre de répétitions.')
      return
    case 'duration':
      if (!has(values.durationSec)) throw new ValidationError('Indiquez la durée.')
      return
    case 'distance_duration':
      if (!has(values.distanceM) && !has(values.durationSec)) {
        throw new ValidationError('Indiquez la distance ou la durée.')
      }
      return
  }
}

function pickValues(set: SetValues): SetValues {
  const values: SetValues = {}
  for (const key of VALUE_KEYS) {
    if (set[key] !== undefined) values[key] = set[key]
  }
  return values
}

function defaultWorkoutName(now: number): string {
  const hour = new Date(now).getHours()
  if (hour < 12) return 'Séance du matin'
  if (hour < 18) return 'Séance de l’après-midi'
  return 'Séance du soir'
}

async function requireActiveWorkout(workoutId: Id, database: KemitlogDatabase): Promise<Workout> {
  const workout = await database.workouts.get(workoutId)
  if (!workout || workout.origin !== 'user' || workout.status !== 'in_progress') {
    throw new ValidationError('Cette séance n’est plus en cours.')
  }
  return workout
}

/**
 * Séance réelle modifiable : en cours, ou terminée (correction depuis l'historique).
 * Les données de démonstration ne sont jamais modifiables.
 */
async function requireEditableWorkout(workoutId: Id, database: KemitlogDatabase): Promise<Workout> {
  const workout = await database.workouts.get(workoutId)
  if (!workout || workout.origin !== 'user') {
    throw new ValidationError('Cette séance est introuvable ou ne peut pas être modifiée.')
  }
  return workout
}

// ───────────────────────────── Lecture ─────────────────────────────

export async function getActiveWorkout(database: KemitlogDatabase = db): Promise<Workout | undefined> {
  return database.workouts
    .where('status')
    .equals('in_progress')
    .filter((workout) => workout.origin === 'user')
    .first()
}

/** Séries validées de la séance terminée la plus récente contenant l'exercice. */
export async function getLastPerformance(
  exerciseId: Id,
  database: KemitlogDatabase = db,
): Promise<LastPerformance | undefined> {
  return database.transaction('r', database.sets, database.workouts, async () => {
    const sets = await database.sets
      .where('exerciseId')
      .equals(exerciseId)
      .filter((set) => set.completed && set.origin === 'user')
      .toArray()
    const workoutIds = [...new Set(sets.map((set) => set.workoutId))]
    const workouts = (await database.workouts.bulkGet(workoutIds)).filter(
      (workout): workout is Workout => workout?.status === 'completed',
    )
    const latest = workouts.sort((a, b) => b.startedAt - a.startedAt)[0]
    if (!latest) return undefined
    return {
      workout: latest,
      sets: sets
        .filter((set) => set.workoutId === latest.id)
        .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.order - b.order),
    }
  })
}

export async function getActiveSession(database: KemitlogDatabase = db): Promise<ActiveSession | null> {
  return database.transaction(
    'r',
    database.workouts,
    database.workoutExercises,
    database.sets,
    database.exercises,
    async () => {
      const active = await getActiveWorkout(database)
      const details = active && (await getWorkoutDetails(active.id, database))
      if (!details) return null
      return {
        workout: details.workout,
        exercises: await Promise.all(
          details.exercises.map(async (entry) => ({
            ...entry,
            previous: await getLastPerformance(entry.workoutExercise.exerciseId, database),
          })),
        ),
      }
    },
  )
}

// ───────────────────────────── Séance ─────────────────────────────

export async function startWorkout(database: KemitlogDatabase = db): Promise<Workout> {
  return database.transaction('rw', database.workouts, async () => {
    if (await getActiveWorkout(database)) {
      throw new ValidationError('Une séance est déjà en cours.')
    }
    const now = Date.now()
    const workout: Workout = {
      id: createId(),
      origin: 'user',
      name: defaultWorkoutName(now),
      status: 'in_progress',
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    await database.workouts.add(workout)
    return workout
  })
}

export async function updateWorkoutInfo(
  workoutId: Id,
  patch: { name?: string; notes?: string },
  database: KemitlogDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.workouts, async () => {
    const workout = await requireEditableWorkout(workoutId, database)
    const next: Workout = { ...workout, updatedAt: Date.now() }
    if (patch.name !== undefined) {
      const name = patch.name.trim().replace(/\s+/g, ' ')
      if (name.length === 0) throw new ValidationError('Le nom de la séance est obligatoire.')
      if (name.length > WORKOUT_NAME_MAX_LENGTH) {
        throw new ValidationError(`Le nom ne peut pas dépasser ${WORKOUT_NAME_MAX_LENGTH} caractères.`)
      }
      next.name = name
    }
    if (patch.notes !== undefined) {
      const notes = patch.notes.trim()
      if (notes.length > WORKOUT_NOTES_MAX_LENGTH) {
        throw new ValidationError(
          `Les notes ne peuvent pas dépasser ${WORKOUT_NOTES_MAX_LENGTH} caractères.`,
        )
      }
      if (notes) next.notes = notes
      else delete next.notes
    }
    await database.workouts.put(next)
  })
}

export interface PruneResult {
  completedSets: number
  discardedSets: number
}

export interface FinishResult extends PruneResult {
  workout: Workout
}

/**
 * Ne conserve que les séries validées : retire les autres ainsi que les exercices
 * sans série validée, puis renumérote. À appeler dans une transaction en écriture
 * sur `workoutExercises` et `sets`. Refuse si aucune série n'est validée.
 */
async function pruneUnvalidated(
  workoutId: Id,
  emptyMessage: string,
  database: KemitlogDatabase,
): Promise<PruneResult> {
  const sets = await database.sets.where('workoutId').equals(workoutId).toArray()
  const completed = sets.filter((set) => set.completed)
  if (completed.length === 0) throw new ValidationError(emptyMessage)

  const discarded = sets.filter((set) => !set.completed)
  await database.sets.bulkDelete(discarded.map((set) => set.id))

  const keptExerciseIds = new Set(completed.map((set) => set.workoutExerciseId))
  const workoutExercises = await database.workoutExercises
    .where('workoutId')
    .equals(workoutId)
    .sortBy('order')
  await database.workoutExercises.bulkDelete(
    workoutExercises.filter((item) => !keptExerciseIds.has(item.id)).map((item) => item.id),
  )
  const kept = workoutExercises.filter((item) => keptExerciseIds.has(item.id))
  for (const [order, item] of kept.entries()) {
    if (item.order !== order) await database.workoutExercises.update(item.id, { order })
    const itemSets = completed
      .filter((set) => set.workoutExerciseId === item.id)
      .sort((a, b) => a.order - b.order)
    for (const [setOrder, set] of itemSets.entries()) {
      if (set.order !== setOrder) await database.sets.update(set.id, { order: setOrder })
    }
  }
  return { completedSets: completed.length, discardedSets: discarded.length }
}

/**
 * Termine la séance en cours : seules les séries validées sont conservées.
 * Refuse de terminer une séance sans aucune série validée.
 */
export async function finishWorkout(
  workoutId: Id,
  database: KemitlogDatabase = db,
): Promise<FinishResult> {
  return database.transaction(
    'rw',
    database.workouts,
    database.workoutExercises,
    database.sets,
    async () => {
      const workout = await requireActiveWorkout(workoutId, database)
      const pruned = await pruneUnvalidated(
        workoutId,
        'Aucune série validée : validez au moins une série, ou abandonnez la séance.',
        database,
      )
      const now = Date.now()
      const { restEndsAt: _rest, restDurationSec: _duration, ...rest } = workout
      const finished: Workout = { ...rest, status: 'completed', endedAt: now, updatedAt: now }
      await database.workouts.put(finished)
      return { workout: finished, ...pruned }
    },
  )
}

// ───────────────────────────── Séances passées ─────────────────────────────

async function requireCompletedWorkout(workoutId: Id, database: KemitlogDatabase): Promise<Workout> {
  const workout = await requireEditableWorkout(workoutId, database)
  if (workout.status !== 'completed') {
    throw new ValidationError('Cette séance n’est pas terminée.')
  }
  return workout
}

/**
 * Clôt la correction d'une séance terminée : écarte les séries laissées non validées.
 * La date et la durée de la séance ne changent pas.
 */
export async function finishEditing(
  workoutId: Id,
  database: KemitlogDatabase = db,
): Promise<PruneResult> {
  return database.transaction(
    'rw',
    database.workouts,
    database.workoutExercises,
    database.sets,
    async () => {
      await requireCompletedWorkout(workoutId, database)
      const pruned = await pruneUnvalidated(
        workoutId,
        'Aucune série validée : validez au moins une série, ou supprimez la séance.',
        database,
      )
      await database.workouts.update(workoutId, { updatedAt: Date.now() })
      return pruned
    },
  )
}

export const WORKOUT_MAX_DURATION_MIN = 24 * 60

/** Corrige la date de début et la durée d'une séance terminée. */
export async function updateWorkoutSchedule(
  workoutId: Id,
  schedule: { startedAt: number; durationMin: number },
  database: KemitlogDatabase = db,
): Promise<Workout> {
  const { startedAt, durationMin } = schedule
  if (!Number.isFinite(startedAt)) throw new ValidationError('La date de la séance est invalide.')
  if (startedAt > Date.now()) throw new ValidationError('La séance ne peut pas commencer dans le futur.')
  if (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > WORKOUT_MAX_DURATION_MIN) {
    throw new ValidationError('La durée doit être comprise entre 1 minute et 24 heures.')
  }
  return database.transaction('rw', database.workouts, async () => {
    const workout = await requireCompletedWorkout(workoutId, database)
    const next: Workout = {
      ...workout,
      startedAt,
      endedAt: startedAt + Math.round(durationMin) * 60_000,
      updatedAt: Date.now(),
    }
    await database.workouts.put(next)
    return next
  })
}

/**
 * Démarre une nouvelle séance reprenant le nom et les exercices d'une séance terminée.
 * Les exercices archivés ou supprimés depuis sont ignorés (`skipped`).
 */
export async function startWorkoutFrom(
  sourceWorkoutId: Id,
  database: KemitlogDatabase = db,
): Promise<{ workout: Workout; skipped: number }> {
  return database.transaction(
    'rw',
    database.workouts,
    database.workoutExercises,
    database.sets,
    database.exercises,
    async () => {
      const source = await requireCompletedWorkout(sourceWorkoutId, database)
      const items = await database.workoutExercises
        .where('workoutId')
        .equals(source.id)
        .sortBy('order')

      const workout = await startWorkout(database)
      await database.workouts.update(workout.id, { name: source.name })
      let skipped = 0
      for (const item of items) {
        const exercise = await database.exercises.get(item.exerciseId)
        if (!exercise || exercise.archived) skipped += 1
        else await addExerciseToWorkout(workout.id, item.exerciseId, undefined, database)
      }
      return { workout: { ...workout, name: source.name }, skipped }
    },
  )
}

// ───────────────────────────── Exercices de la séance ─────────────────────────────

/** Plan repris d'un programme pour un exercice ajouté à une séance. */
export interface ExercisePlan {
  targetSets: number
  targetReps?: string
  restSec?: number
}

/**
 * Ajoute un exercice en fin de séance. Ses séries sont préremplies (non validées)
 * avec la dernière performance connue ; à défaut, une série vide est créée.
 * Avec un `plan`, le nombre de séries est celui du programme.
 */
export async function addExerciseToWorkout(
  workoutId: Id,
  exerciseId: Id,
  plan?: ExercisePlan,
  database: KemitlogDatabase = db,
): Promise<WorkoutExercise> {
  return database.transaction(
    'rw',
    database.workouts,
    database.workoutExercises,
    database.sets,
    database.exercises,
    async () => {
      await requireEditableWorkout(workoutId, database)
      const exercise = await database.exercises.get(exerciseId)
      if (!exercise || exercise.origin !== 'user' || exercise.archived) {
        throw new ValidationError('Cet exercice n’est pas disponible.')
      }

      const now = Date.now()
      const common = { origin: 'user', createdAt: now, updatedAt: now } as const
      const workoutExercise: WorkoutExercise = {
        ...common,
        id: createId(),
        workoutId,
        exerciseId,
        order: await database.workoutExercises.where('workoutId').equals(workoutId).count(),
        ...(plan
          ? {
              targetSets: plan.targetSets,
              ...(plan.targetReps ? { targetReps: plan.targetReps } : {}),
              ...(plan.restSec !== undefined ? { restSec: plan.restSec } : {}),
            }
          : {}),
      }
      await database.workoutExercises.add(workoutExercise)

      const previous = (await getLastPerformance(exerciseId, database))?.sets ?? []
      let templates: Array<{ type: SetType; values: SetValues }>
      if (plan) {
        // Le programme fixe le nombre de séries de travail : chacune reprend la série de
        // travail de même rang de la dernière séance, ou à défaut la dernière connue.
        const working = previous.filter((set) => set.type !== 'warmup')
        templates = Array.from({ length: plan.targetSets }, (_, index) => {
          const source = working[index] ?? working.at(-1)
          return { type: source?.type ?? 'normal', values: source ? pickValues(source) : {} }
        })
      } else if (previous.length > 0) {
        templates = previous.map((set) => ({ type: set.type, values: pickValues(set) }))
      } else {
        templates = [{ type: 'normal', values: {} }]
      }

      await database.sets.bulkAdd(
        templates.map((template, order) => ({
          ...common,
          ...template.values,
          id: createId(),
          workoutExerciseId: workoutExercise.id,
          workoutId,
          exerciseId,
          order,
          type: template.type,
          completed: false,
        })),
      )
      return workoutExercise
    },
  )
}

async function requireWorkoutExercise(
  workoutExerciseId: Id,
  database: KemitlogDatabase,
): Promise<WorkoutExercise> {
  const workoutExercise = await database.workoutExercises.get(workoutExerciseId)
  if (!workoutExercise) throw new ValidationError('Cet exercice ne fait plus partie de la séance.')
  await requireEditableWorkout(workoutExercise.workoutId, database)
  return workoutExercise
}

export async function removeWorkoutExercise(
  workoutExerciseId: Id,
  database: KemitlogDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    database.workouts,
    database.workoutExercises,
    database.sets,
    async () => {
      const removed = await requireWorkoutExercise(workoutExerciseId, database)
      await database.sets
        .where('[workoutExerciseId+order]')
        .between([removed.id, Dexie.minKey], [removed.id, Dexie.maxKey])
        .delete()
      await database.workoutExercises.delete(removed.id)
      const remaining = await database.workoutExercises
        .where('workoutId')
        .equals(removed.workoutId)
        .sortBy('order')
      for (const [order, item] of remaining.entries()) {
        if (item.order !== order) await database.workoutExercises.update(item.id, { order })
      }
    },
  )
}

/** Déplace un exercice d'un cran vers le haut (-1) ou le bas (+1). Sans effet aux extrémités. */
export async function moveWorkoutExercise(
  workoutExerciseId: Id,
  direction: -1 | 1,
  database: KemitlogDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.workouts, database.workoutExercises, async () => {
    const moved = await requireWorkoutExercise(workoutExerciseId, database)
    const siblings = await database.workoutExercises
      .where('workoutId')
      .equals(moved.workoutId)
      .sortBy('order')
    const index = siblings.findIndex((item) => item.id === moved.id)
    const neighbour = siblings[index + direction]
    if (!neighbour) return
    await database.workoutExercises.update(moved.id, { order: neighbour.order })
    await database.workoutExercises.update(neighbour.id, { order: moved.order })
  })
}

// ───────────────────────────── Séries ─────────────────────────────

async function listSets(workoutExerciseId: Id, database: KemitlogDatabase): Promise<WorkoutSet[]> {
  return database.sets
    .where('[workoutExerciseId+order]')
    .between([workoutExerciseId, Dexie.minKey], [workoutExerciseId, Dexie.maxKey])
    .toArray()
}

/** Ajoute une série non validée, préremplie avec les valeurs de la série précédente. */
export async function addSet(
  workoutExerciseId: Id,
  database: KemitlogDatabase = db,
): Promise<WorkoutSet> {
  return database.transaction(
    'rw',
    database.workouts,
    database.workoutExercises,
    database.sets,
    async () => {
      const workoutExercise = await requireWorkoutExercise(workoutExerciseId, database)
      const existing = await listSets(workoutExerciseId, database)
      const last = existing.at(-1)
      const now = Date.now()
      const set: WorkoutSet = {
        ...(last ? pickValues(last) : {}),
        id: createId(),
        origin: 'user',
        workoutExerciseId,
        workoutId: workoutExercise.workoutId,
        exerciseId: workoutExercise.exerciseId,
        order: existing.length,
        // Une série ajoutée après un échauffement est une série de travail.
        type: last && last.type !== 'warmup' ? last.type : 'normal',
        completed: false,
        createdAt: now,
        updatedAt: now,
      }
      await database.sets.add(set)
      return set
    },
  )
}

export interface SetPatch {
  /** Remplace toutes les valeurs saisies (un champ absent est vidé). */
  values?: SetValues
  type?: SetType
  completed?: boolean
}

/**
 * Enregistre une série. La valider (`completed: true`) exige les valeurs requises par
 * le type de suivi et démarre le minuteur de repos (`restSec`, 0 pour ne pas le lancer).
 */
export async function saveSet(
  setId: Id,
  patch: SetPatch,
  options: { restSec?: number } = {},
  database: KemitlogDatabase = db,
): Promise<WorkoutSet> {
  return database.transaction(
    'rw',
    database.workouts,
    database.sets,
    database.exercises,
    async () => {
      const current = await database.sets.get(setId)
      if (!current) throw new ValidationError('Cette série n’existe plus.')
      const workout = await requireEditableWorkout(current.workoutId, database)

      const { weightKg: _w, reps: _r, durationSec: _d, distanceM: _m, completedAt, ...base } = current
      const values = patch.values ? cleanValues(patch.values) : pickValues(current)
      const completed = patch.completed ?? current.completed
      if (completed) {
        const exercise: Exercise | undefined = await database.exercises.get(current.exerciseId)
        assertCompletable(values, exercise?.trackingType ?? 'weight_reps')
      }

      const now = Date.now()
      const next: WorkoutSet = {
        ...base,
        ...values,
        type: patch.type ?? current.type,
        completed,
        ...(completed ? { completedAt: current.completed ? (completedAt ?? now) : now } : {}),
        updatedAt: now,
      }
      await database.sets.put(next)

      const justCompleted = completed && !current.completed
      // Le repos ne concerne que la séance en cours, pas la correction d'une séance passée.
      if (justCompleted && workout.status === 'in_progress' && options.restSec && options.restSec > 0) {
        await database.workouts.update(workout.id, {
          restEndsAt: now + options.restSec * 1000,
          restDurationSec: options.restSec,
        })
      }
      return next
    },
  )
}

export async function deleteSet(setId: Id, database: KemitlogDatabase = db): Promise<void> {
  await database.transaction('rw', database.workouts, database.sets, async () => {
    const removed = await database.sets.get(setId)
    if (!removed) return
    await requireEditableWorkout(removed.workoutId, database)
    await database.sets.delete(setId)
    const remaining = await listSets(removed.workoutExerciseId, database)
    for (const [order, set] of remaining.entries()) {
      if (set.order !== order) await database.sets.update(set.id, { order })
    }
  })
}

// ───────────────────────────── Minuteur de repos ─────────────────────────────

/** Allonge ou raccourcit le repos en cours ; l'arrête s'il ne reste plus de temps. */
export async function adjustRest(
  workoutId: Id,
  deltaSec: number,
  database: KemitlogDatabase = db,
): Promise<void> {
  await database.transaction('rw', database.workouts, async () => {
    const workout = await requireActiveWorkout(workoutId, database)
    const now = Date.now()
    if (workout.restEndsAt === undefined || workout.restEndsAt <= now) return
    const endsAt = workout.restEndsAt + deltaSec * 1000
    if (endsAt <= now) {
      await stopRest(workoutId, database)
      return
    }
    await database.workouts.update(workoutId, {
      restEndsAt: endsAt,
      restDurationSec: Math.max(0, (workout.restDurationSec ?? 0) + deltaSec),
    })
  })
}

export async function stopRest(workoutId: Id, database: KemitlogDatabase = db): Promise<void> {
  await database.transaction('rw', database.workouts, async () => {
    const workout = await requireActiveWorkout(workoutId, database)
    const { restEndsAt: _rest, restDurationSec: _duration, ...rest } = workout
    await database.workouts.put(rest)
  })
}
