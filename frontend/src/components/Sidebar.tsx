import React from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, Search, GitBranch, AlertTriangle,
  Lightbulb, ListChecks, Code2, ShieldCheck, FileText,
  Home, Plus, Cpu, ExternalLink
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',         path: 'dashboard' },
  { icon: FolderOpen,      label: 'File Explorer',     path: 'files' },
  { icon: Search,          label: 'Analysis',          path: 'analysis' },
  { icon: GitBranch,       label: 'Architecture',      path: 'architecture' },
  { icon: AlertTriangle,   label: 'Issues & Debt',     path: 'issues',          statKey: 'total_issues' },
  { icon: Lightbulb,       label: 'Recommendations',   path: 'recommendations', statKey: 'total_recommendations' },
  { icon: ListChecks,      label: 'Modernization Plan',path: 'plan',            statKey: 'total_tasks' },
  { icon: Code2,           label: 'Transformation',    path: 'transform' },
  { icon: ShieldCheck,     label: 'Validation',        path: 'validation' },
  { icon: FileText,        label: 'Report',            path: 'report' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams<{ projectId: string }>()
  const { currentProject, sidebarStats, analysisStatus } = useApp()

  const isActive = (path: string) => location.pathname.includes(`/${path}`)
  const goTo = (path: string) => {
    if (projectId) navigate(`/projects/${projectId}/${path}`)
  }

  const onProjects = location.pathname === '/projects'

  return (
    <div className="sidebar">
      {/* ─── Logo ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        flexShrink: 0,
      }} onClick={() => navigate('/')}>
        <div style={{
          width: 30, height: 30,
          background: 'var(--accent)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.2s ease',
        }}>
          <Cpu size={16} color="white" />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            ModernizeAI
          </div>
          <div style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}>
            Legacy Platform
          </div>
        </div>
      </div>

      {/* ─── Workspace nav ────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
        <div className="nav-section-header">Workspace</div>
        <div
          className={`nav-item ${onProjects ? 'active' : ''}`}
          onClick={() => navigate('/projects')}
        >
          <Home size={14} />
          All Projects
        </div>
        <div
          className="nav-item"
          onClick={() => navigate('/projects/new')}
          style={{ color: 'var(--accent)', opacity: 0.85 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
        >
          <Plus size={14} />
          New Project
        </div>
      </div>

      {/* ─── Current project ──────────────────────────────────────────── */}
      {currentProject && projectId && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          {/* Project context badge */}
          <div style={{ padding: '10px 14px 8px' }}>
            <div className="nav-section-header" style={{ padding: 0, paddingBottom: 6 }}>
              Current Project
            </div>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '8px 10px',
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {currentProject.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className={`dot ${
                  analysisStatus === 'completed' ? 'dot-green' :
                  analysisStatus === 'running'   ? 'dot-blue dot-pulse' :
                  analysisStatus === 'failed'    ? 'dot-red' : 'dot-gray'
                }`} />
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                }}>
                  {analysisStatus === 'completed' ? 'Analyzed' :
                   analysisStatus === 'running'   ? 'Analyzing…' :
                   analysisStatus === 'failed'    ? 'Failed' : 'Not Analyzed'}
                </span>
              </div>
            </div>
          </div>

          {/* Project nav items */}
          <div style={{ paddingBottom: 6 }}>
            <div className="nav-section-header">Analysis Workspace</div>
            {NAV_ITEMS.map(item => (
              <div
                key={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => goTo(item.path)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && goTo(item.path)}
              >
                <item.icon size={14} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.statKey && sidebarStats?.[item.statKey] > 0 && (
                  <span className="nav-count">{sidebarStats[item.statKey]}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Bottom ───────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', padding: '8px 0' }}>
        <div
          className="nav-item"
          onClick={() => window.open('http://localhost:8000/docs', '_blank')}
        >
          <ExternalLink size={13} />
          <span>API Docs</span>
        </div>

        {/* Theme toggle row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px 6px 16px',
        }}>
          <span style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            fontWeight: 600,
          }}>
            Theme
          </span>
          <ThemeToggle variant="compact" />
        </div>
      </div>
    </div>
  )
}
