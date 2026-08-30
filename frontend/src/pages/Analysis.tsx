import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi, filesApi } from '../api/client'
import { useApp } from '../context/AppContext'
import { Play, RefreshCw, XCircle, AlertTriangle, Database, Layers, Package, Code2, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import AIChatPanel from '../components/AIChatPanel'
import ErrorBoundary from '../components/ErrorBoundary'
import PageHeader from '../components/PageHeader'

export default function Analysis() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { analysisStatus, setAnalysisStatus } = useApp()
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [fileCount, setFileCount] = useState(0)
  // Persist the active tab per-project so a browser refresh restores the last view.
  const tabKey = `analysis-tab-${projectId}`
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem(tabKey) || 'technology')

  const switchTab = useCallback((tab: string) => {
    sessionStorage.setItem(tabKey, tab)
    setActiveTab(tab)
  }, [tabKey])

  const load = useCallback(async () => {
    if (!projectId) return
    try {
      const [a, files] = await Promise.all([
        analysisApi.get(projectId).catch(() => null),
        filesApi.list(projectId).catch(() => []),
      ])
      setAnalysis(a)
      setFileCount(files.length)
      if (a) setAnalysisStatus(a.status)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setAnalysis(null)
    setLoading(true)
    // Restore saved tab for this project (or default to 'technology')
    setActiveTab(sessionStorage.getItem(tabKey) || 'technology')
    load()
  }, [projectId]) // reset + reload whenever project changes

  useEffect(() => {
    if (analysisStatus !== 'running') return
    const interval = setInterval(async () => {
      const st = await analysisApi.status(projectId!)
      if (st.status !== 'running') {
        await load()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [analysisStatus, projectId, load])

  const startAnalysis = async (force = false) => {
    if (!projectId) return
    if (fileCount === 0) {
      toast.error('Please import files first')
      navigate(`/projects/${projectId}/files`)
      return
    }
    setStarting(true)
    try {
      await analysisApi.start(projectId, force)
      setAnalysisStatus('running')
      toast.success('Analysis started')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to start analysis')
    } finally {
      setStarting(false)
    }
  }

  if (loading) return (
    <div className="loading-overlay">
      <span className="spinner spinner-lg" />
      <p>Loading analysis…</p>
    </div>
  )

  const tech = analysis?.technology_summary || {}
  const structure = analysis?.code_structure || {}
  const deps = analysis?.dependencies || {}
  const arch = analysis?.architecture || {}

  /** Safely convert any value to a display string — guards against the AI
   *  returning objects or numbers where string array items are expected. */
  const toStr = (v: unknown): string => {
    if (v == null) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>
      // Common shapes the model uses: {name, description}, {title}, {value}
      return String(o.name ?? o.title ?? o.label ?? o.value ?? o.description ?? JSON.stringify(v))
    }
    return String(v)
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <PageHeader>
        <h1>Application Analysis</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {analysis?.status === 'completed' && (
            <button className="btn btn-sm" onClick={() => startAnalysis(true)} disabled={starting}>
              <RefreshCw size={13} />
              Re-analyze
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => startAnalysis(false)}
            disabled={starting || analysisStatus === 'running'}
          >
            {starting || analysisStatus === 'running'
              ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Analyzing…</>
              : <><Play size={13} /> Start Analysis</>
            }
          </button>
        </div>
      </PageHeader>

      <div className="page-body">
        {analysisStatus === 'running' && (
          <div className="alert alert-ai" style={{ marginBottom: 20 }}>
            <div className="ai-dot-row">
              <div className="ai-dot" />
              <div className="ai-dot" />
              <div className="ai-dot" />
            </div>
            <div>
              <strong>ModernIQ is analyzing your legacy codebase</strong>
              {' '}— examining technology stack, architecture, dependencies, and technical debt. This typically takes 60–120 seconds.
            </div>
          </div>
        )}

        {analysisStatus === 'not_started' && (
          <div className="empty-state">
            <Zap size={44} color="var(--accent)" />
            <h3>Ready to Analyze</h3>
            <p>
              {fileCount > 0 ? `${fileCount} files ready.` : 'Import files first.'}{' '}
              Click "Start Analysis" to have IBM Bob examine your legacy codebase.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => startAnalysis()}>
              <Play size={14} />
              Start Analysis
            </button>
          </div>
        )}

        {analysisStatus === 'failed' && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }}>
            <XCircle size={15} />
            <div>
              <strong>Analysis failed.</strong> {analysis?.error_message || 'Unknown error'}.{' '}
              <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => startAnalysis(true)}>
                Retry
              </button>
            </div>
          </div>
        )}

        {analysis?.status === 'completed' && (
          <>
            <div className="tabs">
              {[
                { id: 'technology',    label: 'Technology',     icon: Code2 },
                { id: 'structure',     label: 'Code Structure', icon: Layers },
                { id: 'dependencies',  label: 'Dependencies',   icon: Package },
                { id: 'architecture',  label: 'Architecture',   icon: Database },
              ].map(t => (
                <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => switchTab(t.id)}>
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>

            <ErrorBoundary key={activeTab}>
            {activeTab === 'technology' && (
              <div className="grid-2">
                {[
                  { label: 'Languages',              items: tech.languages,               color: 'var(--accent)' },
                  { label: 'Frameworks',             items: tech.frameworks,              color: 'var(--purple)' },
                  { label: 'Libraries & Dependencies',items: tech.libraries,              color: 'var(--warning)' },
                  { label: 'Databases',              items: tech.databases,               color: 'var(--danger)' },
                  { label: 'Build Tools',            items: tech.build_tools,             color: 'var(--success)' },
                  { label: 'External Services',      items: [...(tech.external_services || []), ...(tech.apis || [])], color: 'var(--ai)' },
                ].map(section => (
                  section.items?.length > 0 && (
                    <div key={section.label} className="card">
                      <div style={{ fontSize: 11, fontWeight: 700, color: section.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                        {section.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {section.items.map((item: unknown, idx: number) => (
                          <span key={idx} className="insight-pill" style={{ color: section.color, borderColor: section.color + '30' }}>
                            {toStr(item)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                ))}
                {tech.runtime_platform && (
                  <div className="card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                      Runtime Platform
                    </div>
                    <span className="badge badge-info" style={{ fontSize: 12, padding: '4px 12px' }}>{toStr(tech.runtime_platform)}</span>
                  </div>
                )}
                {tech.deployment_assumptions?.length > 0 && (
                  <div className="card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                      Deployment Observations
                    </div>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tech.deployment_assumptions.map((d: unknown, i: number) => (
                        <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>·</span>
                          {toStr(d)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'structure' && (
              <div className="grid-2">
                {[
                  { label: 'Entry Points',        items: structure.entry_points,    color: 'var(--success)' },
                  { label: 'Important Files',     items: structure.important_files, color: 'var(--accent)' },
                  { label: 'Modules / Packages',  items: structure.modules,         color: 'var(--purple)' },
                  { label: 'Configuration Files', items: structure.config_files,    color: 'var(--warning)' },
                  { label: 'Key Classes',         items: structure.key_classes,     color: 'var(--danger)' },
                  { label: 'Key Functions',       items: structure.key_functions,   color: 'var(--ai)' },
                ].map(section => (
                  section.items?.length > 0 && (
                    <div key={section.label} className="card">
                      <div style={{ fontSize: 11, fontWeight: 700, color: section.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                        {section.label}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {section.items.map((item: unknown, idx: number) => (
                          <div key={idx} style={{
                            fontSize: 12,
                            fontFamily: 'var(--mono)',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-elevated)',
                            padding: '4px 10px',
                            borderRadius: 5,
                            border: '1px solid var(--border)',
                          }}>
                            {toStr(item)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {activeTab === 'dependencies' && (
              <div>
                {deps.deprecated?.length > 0 && (
                  <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                    <AlertTriangle size={14} />
                    <div><strong>Deprecated dependencies:</strong> {deps.deprecated.map(toStr).join(', ')}</div>
                  </div>
                )}
                {deps.risky?.length > 0 && (
                  <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                    <AlertTriangle size={14} />
                    <div><strong>Risky dependencies:</strong> {deps.risky.map(toStr).join(', ')}</div>
                  </div>
                )}
                <div className="grid-2">
                  {deps.external?.length > 0 && (
                    <div className="card">
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                        External Dependencies
                      </div>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Dependency</th>
                            <th>Version</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {deps.external.map((d: any, i: number) => (
                            <tr key={i}>
                              <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{d.name}</td>
                              <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>{d.version || '—'}</td>
                              <td>
                                <span className={`badge badge-${
                                  d.status === 'deprecated' ? 'critical' :
                                  d.status === 'outdated' ? 'high' :
                                  d.status === 'current' ? 'info' : 'neutral'
                                }`}>{d.status || 'unknown'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {deps.coupling_issues?.length > 0 && (
                    <div className="card">
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                        Coupling Issues
                      </div>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {deps.coupling_issues.map((c: unknown, i: number) => (
                          <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <AlertTriangle size={12} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                            {toStr(c)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'architecture' && (
              <div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      Detected Pattern
                    </div>
                    <span className="badge badge-purple" style={{ fontSize: 13, padding: '4px 14px' }}>
                      {toStr(arch.pattern) || 'Unknown'}
                    </span>
                  </div>
                  {arch.description && (
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontSize: 13 }}>{toStr(arch.description)}</p>
                  )}
                </div>
                {arch.components?.length > 0 && (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                      Components
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {arch.components.map((c: unknown, idx: number) => (
                        <span key={idx} className="insight-pill">{toStr(c)}</span>
                      ))}
                    </div>
                  </div>
                )}
                {arch.issues?.length > 0 && (
                  <div className="card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                      Architectural Issues
                    </div>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {arch.issues.map((issue: unknown, i: number) => (
                        <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <AlertTriangle size={13} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                          {toStr(issue)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            </ErrorBoundary>
          </>
        )}
      </div>
      <AIChatPanel suggestedQuestions={[
        'What is the biggest architectural problem in this codebase?',
        'Which dependencies need urgent updating?',
        'What is the overall modernization strategy you recommend?',
      ]} />
    </div>
  )
}
