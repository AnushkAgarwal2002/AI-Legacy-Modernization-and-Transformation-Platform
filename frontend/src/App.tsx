import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { projectsApi } from './api/client'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'

// Pages
import LandingPage from './pages/LandingPage'
import ProjectList from './pages/ProjectList'
import NewProject from './pages/NewProject'
import Dashboard from './pages/Dashboard'
import FileExplorer from './pages/FileExplorer'
import Analysis from './pages/Analysis'
import Architecture from './pages/Architecture'
import Issues from './pages/Issues'
import Recommendations from './pages/Recommendations'
import ModernizationPlan from './pages/ModernizationPlan'
import Transformation from './pages/Transformation'
import Validation from './pages/Validation'
import Report from './pages/Report'

function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const { setCurrentProject, setAnalysisStatus } = useApp()

  useEffect(() => {
    if (!projectId) return
    // Clear stale project data immediately on project change
    setCurrentProject(null)
    setAnalysisStatus('not_started')
    projectsApi.get(projectId).then(p => setCurrentProject(p)).catch(() => {})
    projectsApi.dashboard(projectId).then(s => {
      setAnalysisStatus(s.analysis_status)
    }).catch(() => {})
  }, [projectId])

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<LandingPage />} />

      {/* Projects list */}
      <Route path="/projects" element={
        <AppShell><ProjectList /></AppShell>
      } />

      {/* New project */}
      <Route path="/projects/new" element={<NewProject />} />

      {/* Project workspace */}
      <Route path="/projects/:projectId" element={<ProjectLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="files" element={<FileExplorer />} />
        <Route path="analysis" element={<Analysis />} />
        <Route path="architecture" element={<Architecture />} />
        <Route path="issues" element={<Issues />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="plan" element={<ModernizationPlan />} />
        <Route path="transform" element={<Transformation />} />
        <Route path="validation" element={<Validation />} />
        <Route path="report" element={<Report />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
