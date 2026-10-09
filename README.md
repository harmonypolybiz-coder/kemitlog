# KEMITLOG

Journal d'entraînement sportif : application web responsive, installable (PWA), sans compte ni serveur. Toutes les données sont enregistrées localement dans le navigateur (IndexedDB).

## Démarrer

Prérequis : Node.js 20.19+ (développé avec Node 24).

```bash
npm install
npm run dev        # serveur de développement
npm run test       # tests (base de données, sauvegarde, démo, statistiques)
npm run build      # vérification TypeScript + build de production
npm run preview    # sert le build : c'est ici que la PWA et le mode hors ligne se testent
```

`npm run generate-pwa-assets` régénère les icônes à partir de `public/logo.svg`.

## Pile technique

React 19 · TypeScript · Vite · Tailwind CSS 4 · Dexie (IndexedDB) · Recharts · React Router · vite-plugin-pwa · Vitest.

## Architecture

```
src/
├─ types/models.ts     Modèle : Exercise, Workout, WorkoutExercise, WorkoutSet, Program, Preferences
├─ data/               Catalogue intégré d'exercices (données de référence)
├─ db/                 Schéma Dexie, dépôts (exercises, workouts, preferences), backup, demo/
├─ lib/                Fonctions pures : dates, statistiques, formatage, libellés français
├─ hooks/              useDbQuery (requête réactive avec états), usePreferences
├─ components/         layout/ (navigation), ui/ (briques), charts/, settings/, exercises/, workouts/
└─ pages/              Tableau de bord, Exercices, Entraînement, Historique (+ détail d'une séance), Progression, Programmes (+ éditeur), Paramètres
```

Règles de dépendance : `pages → components → hooks → db → types`, et `lib` ne dépend que de `types`. Les composants ne manipulent jamais Dexie directement en écriture : ils appellent les fonctions de `db/`.

### Modèle de données

- `Workout 1—n WorkoutExercise 1—n WorkoutSet`, `WorkoutExercise n—1 Exercise`, `Workout n—1 Program`.
- Identifiants UUID, dates en millisecondes, charges toujours stockées en kilogrammes.
- Les suppressions se font en cascade dans une transaction (`deleteWorkout`). Un exercice déjà utilisé est archivé plutôt que supprimé.
- Pour faire évoluer le schéma : ajouter un bloc `this.version(n)` dans `db/database.ts`, sans modifier les blocs existants.

### Données réelles et données de démonstration

Chaque enregistrement porte `origin: 'user' | 'demo'`, et l'application n'affiche qu'un périmètre à la fois (`Preferences.dataScope`).

- Le jeu de démonstration (`db/demo/demoData.ts`) est fictif, déterministe, et ses identifiants commencent par `demo-`.
- Il n'est écrit en base que pendant le mode démonstration, qui est en lecture seule et signalé par un bandeau permanent ; il est effacé dès qu'on le quitte.
- Il n'entre jamais dans les statistiques des données réelles ni dans les exports.

### Sauvegarde et restauration

`db/backup.ts` — Paramètres → Sauvegarde.

- **Export** : fichier JSON versionné (`formatVersion`) contenant uniquement les données réelles.
- **Restauration** : le fichier est entièrement validé (types, valeurs autorisées, clés étrangères) avant toute écriture, puis importé dans une transaction unique. Deux modes : *remplacer* ou *fusionner*.
- Les données restent dans le navigateur : sans export, vider les données du site les supprime. La page Paramètres permet de demander le stockage persistant.

## État d'avancement

1. **Socle** — structure, base locale, navigation, pages, mode démonstration, sauvegarde.
2. **Bibliothèque d'exercices** — catalogue intégré (`src/data/exerciseCatalog.ts`, données de référence ajoutées à la demande), création, modification, favoris, archivage, suppression, recherche et filtres.

3. **Journal de séance** — séance libre, ajout d'exercices préremplis avec la dernière performance, saisie et validation des séries, minuteur de repos, fin ou abandon de séance.

4. **Historique détaillé** — recherche et totaux mensuels, page de détail par séance, correction (nom, date, durée, séries, exercice oublié), suppression, « Refaire cette séance ».

5. **Progression par exercice** — courbe par séance, mesures adaptées au type de suivi, records, tendance, filtre de période, vue tableau.

6. **Programmes** — création et modification (jours, exercices, séries, répétitions visées, repos par exercice), démarrage d'une séance depuis un jour, suggestion du prochain jour.

Toutes les étapes prévues au départ sont réalisées.

### Règles de la bibliothèque

- Un nom d'exercice est unique dans la bibliothèque (casse et accents ignorés), archivés compris.
- Un exercice utilisé dans une séance ou un programme ne peut pas être supprimé, seulement archivé : l'historique reste lisible.
- Un exercice issu du catalogue garde son `catalogId` : il reste reconnu comme « ajouté » même renommé.
- Ne jamais renommer un `id` du catalogue ; pour en ajouter, compléter la liste.

### Règles du journal de séance

`db/session.ts` porte toutes les écritures sur la séance en cours.

- Une seule séance réelle peut être en cours ; le mode démonstration n'en a jamais.
- Chaque geste est écrit immédiatement en base : la séance et son minuteur de repos (heure de fin stockée sur la séance) survivent à une actualisation.
- Valider une série exige les valeurs du type de suivi (charge + répétitions, répétitions, durée, ou distance/durée).
- Terminer ne conserve que les séries validées ; une séance sans série validée ne peut être qu'abandonnée.
- Les statistiques ignorent les échauffements et les séances non terminées.
- Saisie (`lib/setInput.ts`) : charges dans l'unité choisie, stockées en kg ; durée en secondes pour un exercice chronométré, en minutes pour le cardio, `m:ss` accepté partout.

### Règles de l'historique

- Une séance terminée se corrige avec les mêmes fonctions que le journal (`db/session.ts`) ; aucun minuteur n'est lancé et sa date ne change que sur demande explicite.
- Pendant une correction, une série ajoutée reste un brouillon tant qu'elle n'est pas validée : les vues de lecture (`withoutDrafts`) et les statistiques l'ignorent, et « Terminer la modification » l'écarte.
- Une séance qui n'aurait plus aucune série validée ne peut pas être clôturée : il faut la supprimer.
- Les séances de démonstration ne sont ni modifiables, ni supprimables, ni reproductibles.

### Règles de la progression

- Une valeur par séance terminée, calculée sur les séries validées hors échauffement (`lib/progress.ts`, fonctions pures).
- Mesures par type de suivi : charge max, 1RM estimé et volume ; répétitions max et totales ; durée max et totale ; distance, durée et vitesse moyenne.
- Le 1RM est une **estimation** (formule d'Epley), affichée comme telle, limitée aux séries de 12 répétitions au plus.
- Les records portent sur tout l'historique ; la tendance et le graphique suivent la période choisie.
- L'exercice affiché est porté par l'adresse (`/progression?exercice=<id>`).

### Règles des programmes

- Un programme est un document unique (`db/programs.ts`) : il est validé et enregistré en entier, uniquement sur action explicite dans l'éditeur.
- Les jours gardent leur identifiant quand on les renomme ou les réordonne : le « prochain jour » suggéré reste juste.
- Le prochain jour suit le dernier jour **terminé** du programme, en boucle ; une séance seulement démarrée ne le fait pas avancer.
- Une séance issue d'un programme crée le nombre de séries du plan, préremplies avec la dernière performance, et applique le repos propre à l'exercice (à défaut, celui des préférences).
- Les exercices archivés sont ignorés au démarrage ; supprimer un programme conserve les séances déjà réalisées.
