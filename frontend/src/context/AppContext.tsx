import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

interface Project {
  id: string
  name: string
  description?: string
  legacy_tech?: string
  target_tech?: string
  objective?: string
  status: string
  created_at: string
  metadata?: any
}

type Theme = 'dark' | 'light'

interface AppState {
  currentProject: Project | null
  setCurrentProject: (p: Project | null) => void
  analysisStatus: string
  setAnalysisStatus: (s: string) => void
  sidebarStats: any
  setSidebarStats: (s: any) => void
  theme: Theme
  toggleTheme: () => void
}

const AppContext = createContext<AppState | null>(null)

/** Apply theme to <html data-theme="..."> and persist to localStorage. */
function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem('moderniq-theme', t)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState('not_started')
  const [sidebarStats, setSidebarStats] = useState<any>(null)

  // Initialise from localStorage (default dark)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('moderniq-theme') as Theme | null
    return saved === 'light' ? 'light' : 'dark'
  })

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <AppContext.Provider value={{
      currentProject, setCurrentProject,
      analysisStatus, setAnalysisStatus,
      sidebarStats, setSidebarStats,
      theme, toggleTheme,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
