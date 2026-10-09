import type { Equipment, MuscleGroup, TrackingType } from '@/types/models'

/**
 * Catalogue intégré d'exercices courants. Ce sont des données de référence
 * (noms et classement), pas des données de démonstration : rien n'est ajouté
 * à la bibliothèque tant que l'utilisateur ne le demande pas.
 *
 * Les identifiants sont stables : ne jamais renommer un `id` existant, il sert
 * à reconnaître les exercices déjà ajoutés.
 */
export interface CatalogExercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  trackingType: TrackingType
}

type Row = [id: string, name: string, equipment: Equipment, trackingType?: TrackingType]

function group(muscleGroup: MuscleGroup, rows: Row[]): CatalogExercise[] {
  return rows.map(([id, name, equipment, trackingType = 'weight_reps']) => ({
    id,
    name,
    muscleGroup,
    equipment,
    trackingType,
  }))
}

export const EXERCISE_CATALOG: readonly CatalogExercise[] = [
  ...group('chest', [
    ['bench-press', 'Développé couché', 'barbell'],
    ['incline-bench-press', 'Développé incliné', 'barbell'],
    ['decline-bench-press', 'Développé décliné', 'barbell'],
    ['dumbbell-bench-press', 'Développé couché haltères', 'dumbbell'],
    ['incline-dumbbell-press', 'Développé incliné haltères', 'dumbbell'],
    ['dumbbell-fly', 'Écarté couché haltères', 'dumbbell'],
    ['cable-crossover', 'Écarté à la poulie vis-à-vis', 'cable'],
    ['chest-press-machine', 'Développé pectoraux à la machine', 'machine'],
    ['pec-deck', 'Pec deck (butterfly)', 'machine'],
    ['push-up', 'Pompes', 'bodyweight', 'bodyweight_reps'],
    ['chest-dip', 'Dips', 'bodyweight', 'bodyweight_reps'],
  ]),
  ...group('back', [
    ['deadlift', 'Soulevé de terre', 'barbell'],
    ['barbell-row', 'Rowing barre', 'barbell'],
    ['t-bar-row', 'Rowing T-bar', 'barbell'],
    ['dumbbell-row', 'Rowing haltère un bras', 'dumbbell'],
    ['pull-up', 'Tractions pronation', 'bodyweight', 'bodyweight_reps'],
    ['chin-up', 'Tractions supination', 'bodyweight', 'bodyweight_reps'],
    ['lat-pulldown', 'Tirage vertical poitrine', 'cable'],
    ['seated-cable-row', 'Tirage horizontal à la poulie', 'cable'],
    ['straight-arm-pulldown', 'Pull-over à la poulie haute', 'cable'],
    ['machine-row', 'Rowing à la machine', 'machine'],
    ['back-extension', 'Extension lombaire au banc', 'bodyweight', 'bodyweight_reps'],
  ]),
  ...group('shoulders', [
    ['overhead-press', 'Développé militaire', 'barbell'],
    ['dumbbell-shoulder-press', 'Développé épaules haltères', 'dumbbell'],
    ['arnold-press', 'Développé Arnold', 'dumbbell'],
    ['lateral-raise', 'Élévations latérales', 'dumbbell'],
    ['front-raise', 'Élévations frontales', 'dumbbell'],
    ['rear-delt-fly', 'Oiseau haltères', 'dumbbell'],
    ['cable-lateral-raise', 'Élévations latérales à la poulie', 'cable'],
    ['face-pull', 'Face pull', 'cable'],
    ['shoulder-press-machine', 'Développé épaules à la machine', 'machine'],
    ['barbell-shrug', 'Shrugs barre', 'barbell'],
  ]),
  ...group('biceps', [
    ['barbell-curl', 'Curl barre', 'barbell'],
    ['ez-bar-curl', 'Curl barre EZ', 'barbell'],
    ['dumbbell-curl', 'Curl haltères', 'dumbbell'],
    ['hammer-curl', 'Curl marteau', 'dumbbell'],
    ['incline-dumbbell-curl', 'Curl incliné haltères', 'dumbbell'],
    ['concentration-curl', 'Curl concentré', 'dumbbell'],
    ['preacher-curl', 'Curl au pupitre', 'machine'],
    ['cable-curl', 'Curl à la poulie basse', 'cable'],
  ]),
  ...group('triceps', [
    ['close-grip-bench-press', 'Développé couché prise serrée', 'barbell'],
    ['skull-crusher', 'Barre au front', 'barbell'],
    ['triceps-pushdown', 'Extension triceps à la poulie haute', 'cable'],
    ['overhead-cable-extension', 'Extension triceps au-dessus de la tête à la poulie', 'cable'],
    ['overhead-dumbbell-extension', 'Extension triceps haltère au-dessus de la tête', 'dumbbell'],
    ['triceps-kickback', 'Kickback haltère', 'dumbbell'],
    ['bench-dip', 'Dips sur banc', 'bodyweight', 'bodyweight_reps'],
  ]),
  ...group('legs', [
    ['back-squat', 'Squat barre', 'barbell'],
    ['front-squat', 'Squat avant', 'barbell'],
    ['goblet-squat', 'Squat goblet', 'kettlebell'],
    ['leg-press', 'Presse à cuisses', 'machine'],
    ['hack-squat', 'Hack squat', 'machine'],
    ['walking-lunge', 'Fentes marchées', 'dumbbell'],
    ['bulgarian-split-squat', 'Squat bulgare', 'dumbbell'],
    ['romanian-deadlift', 'Soulevé de terre roumain', 'barbell'],
    ['leg-extension', 'Leg extension', 'machine'],
    ['lying-leg-curl', 'Leg curl allongé', 'machine'],
    ['seated-leg-curl', 'Leg curl assis', 'machine'],
    ['standing-calf-raise', 'Extension mollets debout', 'machine'],
    ['seated-calf-raise', 'Extension mollets assis', 'machine'],
  ]),
  ...group('glutes', [
    ['hip-thrust', 'Hip thrust', 'barbell'],
    ['glute-bridge', 'Pont fessier', 'bodyweight', 'bodyweight_reps'],
    ['cable-kickback', 'Kickback fessier à la poulie', 'cable'],
    ['hip-abduction-machine', 'Abduction de hanche à la machine', 'machine'],
    ['sumo-deadlift', 'Soulevé de terre sumo', 'barbell'],
    ['kettlebell-swing', 'Swing kettlebell', 'kettlebell'],
  ]),
  ...group('core', [
    ['plank', 'Gainage planche', 'bodyweight', 'duration'],
    ['side-plank', 'Gainage latéral', 'bodyweight', 'duration'],
    ['crunch', 'Crunch', 'bodyweight', 'bodyweight_reps'],
    ['hanging-leg-raise', 'Relevé de jambes suspendu', 'bodyweight', 'bodyweight_reps'],
    ['russian-twist', 'Rotation russe', 'bodyweight', 'bodyweight_reps'],
    ['ab-wheel', 'Roulette abdominale', 'other', 'bodyweight_reps'],
    ['cable-crunch', 'Crunch à la poulie haute', 'cable'],
    ['pallof-press', 'Pallof press', 'band'],
  ]),
  ...group('cardio', [
    ['running', 'Course à pied', 'other', 'distance_duration'],
    ['treadmill', 'Tapis de course', 'machine', 'distance_duration'],
    ['stationary-bike', "Vélo d'appartement", 'machine', 'distance_duration'],
    ['rowing-machine', 'Rameur', 'machine', 'distance_duration'],
    ['elliptical', 'Vélo elliptique', 'machine', 'duration'],
    ['jump-rope', 'Corde à sauter', 'other', 'duration'],
    ['stair-climber', 'Simulateur d’escalier', 'machine', 'duration'],
  ]),
  ...group('full_body', [
    ['burpee', 'Burpees', 'bodyweight', 'bodyweight_reps'],
    ['power-clean', 'Épaulé', 'barbell'],
    ['clean-and-jerk', 'Épaulé-jeté', 'barbell'],
    ['snatch', 'Arraché', 'barbell'],
    ['thruster', 'Thruster', 'barbell'],
    ['farmer-walk', 'Marche du fermier', 'dumbbell', 'distance_duration'],
    ['turkish-get-up', 'Relevé turc', 'kettlebell'],
  ]),
]
