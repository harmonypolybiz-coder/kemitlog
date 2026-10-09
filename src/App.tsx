import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppShell } from './components/layout/AppShell'
import { ROUTES } from './components/layout/navigation'
import { UpdatePrompt } from './components/UpdatePrompt'

// Chaque page est chargée à la demande (Recharts ne pèse que sur Progression).
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ExercisesPage = lazy(() => import('./pages/ExercisesPage'))
const TrainingPage = lazy(() => import('./pages/TrainingPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const WorkoutDetailPage = lazy(() => import('./pages/WorkoutDetailPage'))
const ProgramsPage = lazy(() => import('./pages/ProgramsPage'))
const ProgramEditorPage = lazy(() => import('./pages/ProgramEditorPage'))
const ProgressPage = lazy(() => import('./pages/ProgressPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.exercises} element={<ExercisesPage />} />
            <Route path={ROUTES.training} element={<TrainingPage />} />
            <Route path={ROUTES.history} element={<HistoryPage />} />
            <Route path={`${ROUTES.history}/:workoutId`} element={<WorkoutDetailPage />} />
            <Route path={ROUTES.programs} element={<ProgramsPage />} />
            <Route path={ROUTES.newProgram} element={<ProgramEditorPage />} />
            <Route path={`${ROUTES.programs}/:programId/modifier`} element={<ProgramEditorPage />} />
            <Route path={ROUTES.progress} element={<ProgressPage />} />
            <Route path={ROUTES.settings} element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <UpdatePrompt />
    </ErrorBoundary>
  )
}
