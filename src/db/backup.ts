import {
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  SET_TYPES,
  TRACKING_TYPES,
  WEIGHT_UNITS,
  WORKOUT_STATUSES,
  type Exercise,
  type Preferences,
  type Program,
  type ProgramDay,
  type ProgramExercise,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@/types/models'
import { DB_SCHEMA_VERSION, db, originTables, type KemitlogDatabase } from './database'
import { getPreferences, updatePreferences } from './preferences'

/**
 * Sauvegarde et restauration des données réelles.
 *
 * - L'export ne contient que les enregistrements `origin: 'user'` : les données
 *   de démonstration ne sortent jamais de l'application.
 * - Le fichier est versionné (`formatVersion`) pour pouvoir évoluer.
 * - La restauration valide tout le fichier avant d'écrire, puis écrit dans une
 *   transaction unique : en cas d'échec, la base reste inchangée.
 */

export const BACKUP_APP_ID = 'kemitlog'
export const BACKUP_FORMAT_VERSION = 1

export type BackupPreferences = Pick<Preferences, 'weightUnit' | 'defaultRestSec' | 'weekStartsOn'>

export interface BackupData {
  exercises: Exercise[]
  workouts: Workout[]
  workoutExercises: WorkoutExercise[]
  sets: WorkoutSet[]
  programs: Program[]
  preferences: BackupPreferences
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  formatVersion: number
  schemaVersion: number
  exportedAt: number
  data: BackupData
}

export interface BackupCounts {
  exercises: number
  workouts: number
  workoutExercises: number
  sets: number
  programs: number
}

/** `replace` efface les données réelles avant d'importer ; `merge` ajoute et écrase par identifiant. */
export type RestoreMode = 'replace' | 'merge'

export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

export function countBackup(backup: BackupFile): BackupCounts {
  const { exercises, workouts, workoutExercises, sets, programs } = backup.data
  return {
    exercises: exercises.length,
    workouts: workouts.length,
    workoutExercises: workoutExercises.length,
    sets: sets.length,
    programs: programs.length,
  }
}

// ───────────────────────────── Export ─────────────────────────────

export async function createBackup(database: KemitlogDatabase = db): Promise<BackupFile> {
  return database.transaction('r', [...originTables(database), database.preferences], async () => {
    const preferences = await getPreferences(database)
    return {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: DB_SCHEMA_VERSION,
      exportedAt: Date.now(),
      data: {
        exercises: await database.exercises.where('origin').equals('user').toArray(),
        workouts: await database.workouts.where('origin').equals('user').toArray(),
        workoutExercises: await database.workoutExercises.where('origin').equals('user').toArray(),
        sets: await database.sets.where('origin').equals('user').toArray(),
        programs: await database.programs.where('origin').equals('user').toArray(),
        preferences: {
          weightUnit: preferences.weightUnit,
          defaultRestSec: preferences.defaultRestSec,
          weekStartsOn: preferences.weekStartsOn,
        },
      },
    }
  })
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2)
}

export function backupFileName(backup: BackupFile): string {
  const date = new Date(backup.exportedAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `kemitlog-sauvegarde-${stamp}.json`
}

// ───────────────────────────── Validation ─────────────────────────────

type Raw = Record<string, unknown>

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(path: string, expected: string): never {
  throw new BackupError(`Fichier invalide : « ${path} » ${expected}.`)
}

function str(raw: Raw, key: string, path: string): string {
  const value = raw[key]
  if (typeof value !== 'string' || value.length === 0) fail(`${path}.${key}`, 'doit être un texte non vide')
  return value
}

function optStr(raw: Raw, key: string, path: string): string | undefined {
  const value = raw[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') fail(`${path}.${key}`, 'doit être un texte')
  return value
}

function num(raw: Raw, key: string, path: string): number {
  const value = raw[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${path}.${key}`, 'doit être un nombre')
  return value
}

function optNum(raw: Raw, key: string, path: string): number | undefined {
  const value = raw[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${path}.${key}`, 'doit être un nombre positif')
  }
  return value
}

function bool(raw: Raw, key: string, path: string): boolean {
  const value = raw[key]
  if (typeof value !== 'boolean') fail(`${path}.${key}`, 'doit être un booléen')
  return value
}

function optBool(raw: Raw, key: string, path: string): boolean | undefined {
  const value = raw[key]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'boolean') fail(`${path}.${key}`, 'doit être un booléen')
  return value
}

function oneOf<T extends string | number>(
  raw: Raw,
  key: string,
  path: string,
  allowed: readonly T[],
): T {
  const value = raw[key]
  if (!allowed.includes(value as T)) fail(`${path}.${key}`, `doit valoir ${allowed.join(', ')}`)
  return value as T
}

function list<T>(raw: Raw, key: string, path: string, parse: (item: Raw, path: string) => T): T[] {
  const value = raw[key]
  if (!Array.isArray(value)) fail(`${path}.${key}`, 'doit être une liste')
  return value.map((item, index) => {
    const itemPath = `${path}.${key}[${index}]`
    if (!isObject(item)) fail(itemPath, 'doit être un objet')
    return parse(item, itemPath)
  })
}

/** Retire les clés `undefined` pour ne pas les stocker. */
function compact<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T
}

function base(raw: Raw, path: string) {
  return {
    id: str(raw, 'id', path),
    // Un fichier importé alimente toujours les données réelles.
    origin: 'user' as const,
    createdAt: num(raw, 'createdAt', path),
    updatedAt: num(raw, 'updatedAt', path),
  }
}

function parseExercise(raw: Raw, path: string): Exercise {
  return compact({
    ...base(raw, path),
    name: str(raw, 'name', path),
    muscleGroup: oneOf(raw, 'muscleGroup', path, MUSCLE_GROUPS),
    equipment: oneOf(raw, 'equipment', path, EQUIPMENT_TYPES),
    trackingType: oneOf(raw, 'trackingType', path, TRACKING_TYPES),
    notes: optStr(raw, 'notes', path),
    archived: bool(raw, 'archived', path),
    favorite: optBool(raw, 'favorite', path),
    catalogId: optStr(raw, 'catalogId', path),
  })
}

function parseWorkout(raw: Raw, path: string): Workout {
  return compact({
    ...base(raw, path),
    name: str(raw, 'name', path),
    status: oneOf(raw, 'status', path, WORKOUT_STATUSES),
    startedAt: num(raw, 'startedAt', path),
    endedAt: optNum(raw, 'endedAt', path),
    programId: optStr(raw, 'programId', path),
    programDayId: optStr(raw, 'programDayId', path),
    notes: optStr(raw, 'notes', path),
  })
}

function parseWorkoutExercise(raw: Raw, path: string): WorkoutExercise {
  return compact({
    ...base(raw, path),
    workoutId: str(raw, 'workoutId', path),
    exerciseId: str(raw, 'exerciseId', path),
    order: num(raw, 'order', path),
    notes: optStr(raw, 'notes', path),
    targetSets: optNum(raw, 'targetSets', path),
    targetReps: optStr(raw, 'targetReps', path),
    restSec: optNum(raw, 'restSec', path),
  })
}

function parseSet(raw: Raw, path: string): WorkoutSet {
  return compact({
    ...base(raw, path),
    workoutExerciseId: str(raw, 'workoutExerciseId', path),
    workoutId: str(raw, 'workoutId', path),
    exerciseId: str(raw, 'exerciseId', path),
    order: num(raw, 'order', path),
    type: oneOf(raw, 'type', path, SET_TYPES),
    weightKg: optNum(raw, 'weightKg', path),
    reps: optNum(raw, 'reps', path),
    durationSec: optNum(raw, 'durationSec', path),
    distanceM: optNum(raw, 'distanceM', path),
    rpe: optNum(raw, 'rpe', path),
    completed: bool(raw, 'completed', path),
    completedAt: optNum(raw, 'completedAt', path),
  })
}

function parseProgramExercise(raw: Raw, path: string): ProgramExercise {
  return compact({
    exerciseId: str(raw, 'exerciseId', path),
    targetSets: num(raw, 'targetSets', path),
    targetReps: optStr(raw, 'targetReps', path),
    restSec: optNum(raw, 'restSec', path),
  })
}

function parseProgramDay(raw: Raw, path: string): ProgramDay {
  return {
    id: str(raw, 'id', path),
    name: str(raw, 'name', path),
    exercises: list(raw, 'exercises', path, parseProgramExercise),
  }
}

function parseProgram(raw: Raw, path: string): Program {
  return compact({
    ...base(raw, path),
    name: str(raw, 'name', path),
    description: optStr(raw, 'description', path),
    days: list(raw, 'days', path, parseProgramDay),
  })
}

function parsePreferences(raw: unknown): BackupPreferences {
  if (!isObject(raw)) fail('data.preferences', 'doit être un objet')
  const path = 'data.preferences'
  return {
    weightUnit: oneOf(raw, 'weightUnit', path, WEIGHT_UNITS),
    defaultRestSec: num(raw, 'defaultRestSec', path),
    weekStartsOn: oneOf(raw, 'weekStartsOn', path, [0, 1] as const),
  }
}

function assertUniqueIds(records: Array<{ id: string }>, label: string): Set<string> {
  const ids = new Set<string>()
  for (const record of records) {
    if (ids.has(record.id)) {
      throw new BackupError(`Fichier invalide : identifiant en double dans ${label} (${record.id}).`)
    }
    ids.add(record.id)
  }
  return ids
}

/** Vérifie que chaque clé étrangère pointe vers un enregistrement présent dans le fichier. */
function assertReferences(data: BackupData): void {
  const exerciseIds = assertUniqueIds(data.exercises, 'les exercices')
  const workoutIds = assertUniqueIds(data.workouts, 'les séances')
  const workoutExerciseIds = assertUniqueIds(data.workoutExercises, 'les exercices de séance')
  assertUniqueIds(data.sets, 'les séries')
  assertUniqueIds(data.programs, 'les programmes')

  const broken = (what: string, id: string): never => {
    throw new BackupError(`Fichier incohérent : ${what} (${id}).`)
  }

  for (const item of data.workoutExercises) {
    if (!workoutIds.has(item.workoutId)) broken('exercice de séance sans séance', item.id)
    if (!exerciseIds.has(item.exerciseId)) broken('exercice de séance sans exercice', item.id)
  }
  for (const set of data.sets) {
    if (!workoutExerciseIds.has(set.workoutExerciseId)) broken('série sans exercice de séance', set.id)
    if (!workoutIds.has(set.workoutId)) broken('série sans séance', set.id)
    if (!exerciseIds.has(set.exerciseId)) broken('série sans exercice', set.id)
  }
  for (const program of data.programs) {
    for (const day of program.days) {
      for (const entry of day.exercises) {
        if (!exerciseIds.has(entry.exerciseId)) broken('programme avec exercice inconnu', program.id)
      }
    }
  }
}

/** Analyse et valide le contenu d'un fichier de sauvegarde. Lève `BackupError` avec un message lisible. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError("Ce fichier n'est pas un fichier JSON valide.")
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP_ID) {
    throw new BackupError("Ce fichier n'est pas une sauvegarde KEMITLOG.")
  }

  const formatVersion = num(raw, 'formatVersion', 'sauvegarde')
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      "Cette sauvegarde provient d'une version plus récente de KEMITLOG. Mettez l'application à jour avant de la restaurer.",
    )
  }

  const data = raw.data
  if (!isObject(data)) fail('data', 'doit être un objet')

  const parsed: BackupData = {
    exercises: list(data, 'exercises', 'data', parseExercise),
    workouts: list(data, 'workouts', 'data', parseWorkout),
    workoutExercises: list(data, 'workoutExercises', 'data', parseWorkoutExercise),
    sets: list(data, 'sets', 'data', parseSet),
    programs: list(data, 'programs', 'data', parseProgram),
    preferences: parsePreferences(data.preferences),
  }
  assertReferences(parsed)

  return {
    app: BACKUP_APP_ID,
    formatVersion,
    schemaVersion: num(raw, 'schemaVersion', 'sauvegarde'),
    exportedAt: num(raw, 'exportedAt', 'sauvegarde'),
    data: parsed,
  }
}

// ───────────────────────────── Restauration ─────────────────────────────

export async function restoreBackup(
  backup: BackupFile,
  mode: RestoreMode,
  database: KemitlogDatabase = db,
): Promise<BackupCounts> {
  const { data } = backup
  await database.transaction('rw', [...originTables(database), database.preferences], async () => {
    if (mode === 'replace') {
      await clearOrigin('user', database)
      await updatePreferences(data.preferences, database)
    }
    await database.exercises.bulkPut(data.exercises)
    await database.workouts.bulkPut(data.workouts)
    await database.workoutExercises.bulkPut(data.workoutExercises)
    await database.sets.bulkPut(data.sets)
    await database.programs.bulkPut(data.programs)
  })
  return countBackup(backup)
}

/** Supprime tous les enregistrements d'un périmètre, sans toucher à l'autre. */
export async function clearOrigin(
  origin: 'user' | 'demo',
  database: KemitlogDatabase = db,
): Promise<void> {
  await database.transaction('rw', originTables(database), async () => {
    for (const table of originTables(database)) {
      await table.where('origin').equals(origin).delete()
    }
  })
}
