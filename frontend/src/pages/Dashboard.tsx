import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, analysisApi } from '../api/client'
import { useApp } from '../context/AppContext'
import {
  AlertTriangle, Lightbulb, ListChecks, Code2,
  FileCode, TrendingUp, ShieldAlert, RefreshCw, Play,
  Zap, Search, GitBranch, ShieldCheck, FileText
} from 'lucide-react'
import ScoreBar from '../components/ScoreBar'
import AIChatPanel from '../components/AIChatPanel'
import PageHeader from '../components/PageHeader'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts'

const SCORE_LABELS: Record<string, string> = {
  maintainability:     'Maintainability',
  architecture:        'Architecture',
  technology_currency: 'Technology Currency',
  dependency_health:   'Dependency Health',
  security_posture:    'Security Posture',
  testability:         'Testability',
  documentation:       'Documentation',
  coupling:            'Coupling',
  migration_complexity:'Migration Complexity',
  modernization_risk:  'Modernization Risk',
}

const QUICK_ACTIONS = [
  { icon: Search,        label: 'Analysis',           desc: 'Technology & architecture', path: 'analysis',        color: '#5B7EFF' },
  { icon: GitBranch,     label: 'Architecture',        desc: 'System diagram',            path: 'architecture',    color: '#8B5CF6' },
  { icon: AlertTriangle, label: 'Issues',              desc: 'Technical debt',            path: 'issues',          color: '#EF4444' },
  { icon: Lightbulb,     label: 'Recommendations',     desc: 'AI suggestions',            path: 'recommendations', color: '#F59E0B' },
  { icon: ListChecks,    label: 'Modernization Plan',  desc: 'Migration tasks',           path: 'plan',            color: '#3B82F6' },
  { icon: Code2,         label: 'Transform',           desc: 'AI code proposals',         path: 'transform',       color: '#22C55E' },
  { icon: ShieldCheck,   label: 'Validation',          desc: 'Review results',            path: 'validation',      color: '#60A5FA' },
  { icon: FileText,      label: 'Report',              desc: 'Full summary',              path: 'report',          color: '#9AA0B8' },
]

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { setCurrentProject, setAnalysisStatus, setSidebarStats, analysisStatus } = useApp()
  const [project, setProject] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!projectId) return
    const [p, s] = await Promise.all([
      projectsApi.get(projectId),
      projectsApi.dashboard(projectId),
    ])
    setProject(p)
    setStats(s)
    setCurrentProject(p)
    setAnalysisStatus(s.analysis_status)
    setSidebarStats(s)
  }, [projectId])

  // Run on every mount (not just when refresh ref changes) so that navigating
  // back to the dashboard from the Plan page reflects updated task progress.
  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Poll while analysis is running
  useEffect(() => {
    if (analysisStatus !== 'running') return
    const interval = setInterval(async () => {
      const st = await analysisApi.status(projectId!)
      if (st.status !== 'running') {
        await refresh()
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [analysisStatus, projectId, refresh])

  if (loading) return (
    <div className="loading-overlay">
      <span className="spinner spinner-lg" />
      <p>Loading dashboard…</p>
    </div>
  )

  if (!project) return (
    <div className="page-body">
      <div className="alert alert-danger">Project not found</div>
    </div>
  )

  const scores = stats?.assessment_scores || {}
  const radarData = Object.entries(scores).map(([key, val]: any) => ({
    subject: SCORE_LABELS[key]?.split(' ')[0] || key,
    A: val?.score || 0,
    fullMark: 100,
  }))

  const overallScore = Object.values(scores).length > 0
    ? Math.round((Object.values(scores) as any[]).reduce((a: number, v: any) => a + (v?.score || 0), 0) / Object.values(scores).length)
    : null

  const progressPct = stats?.total_tasks > 0
    ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
    : 0

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Page header */}
      <PageHeader>
        <div style={{ minWidth: 0 }}>
          <h1 style={{
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {project.name}
          </h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {project.legacy_tech && (
              <span className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                {project.legacy_tech}
              </span>
            )}
            {project.target_tech && (
              <span className="chip" style={{
                fontFamily: 'var(--mono)', fontSize: 11,
                color: 'var(--success)', borderColor: 'rgba(52,211,153,0.3)', background: 'var(--success-dim)',
              }}>
                → {project.target_tech}
              </span>
            )}
            {project.objective && (
              <span className="chip" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {project.objective}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-sm" onClick={refresh}>
            <RefreshCw size={13} />
            Refresh
          </button>
          {stats?.analysis_status === 'not_started' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/projects/${projectId}/analysis`)}>
              <Play size={13} />
              Start Analysis
            </button>
          )}
        </div>
      </PageHeader>

      <div className="page-body">
        {/* Status alerts */}
        {stats?.analysis_status === 'running' && (
          <div className="alert alert-ai" style={{ marginBottom: 20 }}>
            <div className="ai-dot-row">
              <div className="ai-dot" />
              <div className="ai-dot" />
              <div className="ai-dot" />
            </div>
            <div>
              <strong>ModernIQ is analyzing your legacy codebase</strong>
              {' '}— examining technology stack, architecture, dependencies, and technical debt. This may take 60–120 seconds.
            </div>
          </div>
        )}
        {stats?.analysis_status === 'failed' && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <ShieldAlert size={15} />
            <div>
              Analysis failed.{' '}
              <a href="#" onClick={e => { e.preventDefault(); navigate(`/projects/${projectId}/analysis`) }}>
                Retry analysis
              </a>
            </div>
          </div>
        )}
        {stats?.analysis_status === 'not_started' && (
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <Zap size={15} style={{ flexShrink: 0 }} />
            <div>
              <strong>Analysis not started.</strong>{' '}
              Go to{' '}
              <a href="#" onClick={e => { e.preventDefault(); navigate(`/projects/${projectId}/files`) }}>
                File Explorer
              </a>{' '}
              to import code, then{' '}
              <a href="#" onClick={e => { e.preventDefault(); navigate(`/projects/${projectId}/analysis`) }}>
                run analysis
              </a>.
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: 'Files', value: stats?.total_files ?? 0, color: 'var(--accent)', icon: FileCode },
            { label: 'Issues Found', value: stats?.total_issues ?? 0, color: 'var(--danger)', icon: AlertTriangle, extra: stats?.high_priority_issues > 0 ? `${stats.high_priority_issues} high` : null },
            { label: 'Recommendations', value: stats?.total_recommendations ?? 0, color: 'var(--warning)', icon: Lightbulb },
            { label: 'Plan Tasks', value: stats?.total_tasks ?? 0, color: 'var(--purple)', icon: ListChecks },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <s.icon size={18} color={s.color} />
                {(s as any).extra && (
                  <span className="badge badge-critical">{(s as any).extra}</span>
                )}
              </div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {stats?.total_tasks > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-header">
              <div className="section-title"><TrendingUp size={13} /> Modernization Progress</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {progressPct}%
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%`, background: 'var(--success)' }} />
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--success)' }}>
                ✓ {stats.completed_tasks} tasks completed
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {stats.total_tasks - stats.completed_tasks} remaining
              </span>
              {stats.transformations_performed > 0 && (
                <span style={{ fontSize: 12, color: 'var(--ai)' }}>
                  {stats.transformations_performed} transformations
                </span>
              )}
            </div>
          </div>
        )}

        {/* Scorecard + Radar */}
        {(overallScore !== null || radarData.length > 0) && (
          <div className="grid-2" style={{ marginBottom: 20 }}>
            {overallScore !== null && (
              <div className="card">
                <div className="section-header">
                  <div className="section-title">Assessment</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                    <span style={{
                      fontSize: 26,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                      color: (overallScore ?? 0) >= 70 ? 'var(--success)'
                           : (overallScore ?? 0) >= 45 ? 'var(--warning)' : 'var(--danger)',
                    }}>
                      {overallScore}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingBottom: 2 }}>/100</span>
                  </div>
                </div>
                <div className="alert alert-warning" style={{ marginBottom: 14, fontSize: 11, padding: '6px 10px' }}>
                  AI-assisted heuristic scores — not objective measurements
                </div>
                {Object.entries(scores).slice(0, 6).map(([key, val]: any) => (
                  <ScoreBar key={key} label={SCORE_LABELS[key] || key} score={val?.score || 0} rationale={val?.rationale} />
                ))}
              </div>
            )}
            {radarData.length > 0 && (
              <div className="card">
                <div className="section-title" style={{ marginBottom: 16 }}>Health Radar</div>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                    <Radar name="Score" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Executive summary */}
        {stats?.executive_summary && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Executive Summary</div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {stats.executive_summary}
            </p>
          </div>
        )}

        {/* Quick actions */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: 16 }}>Quick Actions</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}>
            {QUICK_ACTIONS.map(a => (
              <div
                key={a.path}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onClick={() => navigate(`/projects/${projectId}/${a.path}`)}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = a.color + '50'
                  e.currentTarget.style.background = a.color + '08'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.background = 'var(--bg-elevated)'
                }}
              >
                <a.icon size={16} color={a.color} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{a.label}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{a.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AIChatPanel suggestedQuestions={[
        'What are the most critical issues in this project?',
        'What modernization approach do you recommend?',
        'What are the biggest migration risks?',
      ]} />
    </div>
  )
}
