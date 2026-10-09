import type { ProgramExercise } from '@/types/models'

/** Objectif d'un exercice de programme : « 3 × 8-12 », ou « 3 séries » sans répétitions visées. */
export function formatPlan(entry: Pick<ProgramExercise, 'targetSets' | 'targetReps'>): string {
  if (entry.targetReps) return `${entry.targetSets} × ${entry.targetReps}`
  return `${entry.targetSets} ${entry.targetSets > 1 ? 'séries' : 'série'}`
}
