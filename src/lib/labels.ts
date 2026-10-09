import type { Equipment, MuscleGroup, SetType, TrackingType, WeightUnit } from '@/types/models'

/** Libellés français des valeurs du modèle. */

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Pectoraux',
  back: 'Dos',
  shoulders: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Jambes',
  glutes: 'Fessiers',
  core: 'Abdominaux',
  cardio: 'Cardio',
  full_body: 'Corps entier',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barre',
  dumbbell: 'Haltères',
  machine: 'Machine',
  cable: 'Poulie',
  bodyweight: 'Poids du corps',
  kettlebell: 'Kettlebell',
  band: 'Élastique',
  other: 'Autre',
}

export const TRACKING_TYPE_LABELS: Record<TrackingType, string> = {
  weight_reps: 'Charge × répétitions',
  bodyweight_reps: 'Répétitions au poids du corps',
  duration: 'Durée',
  distance_duration: 'Distance et durée',
}

export const SET_TYPE_LABELS: Record<SetType, string> = {
  normal: 'normale',
  warmup: 'échauffement',
  drop: 'dégressive',
  failure: 'jusqu’à l’échec',
}

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  kg: 'Kilogrammes (kg)',
  lb: 'Livres (lb)',
}
