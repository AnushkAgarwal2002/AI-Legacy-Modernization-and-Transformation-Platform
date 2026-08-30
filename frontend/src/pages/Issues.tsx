import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi } from '../api/client'
import { AlertTriangle, ChevronDown, ChevronRight, Code2 } from 'lucide-react'
import toast from 'react-hot-toast'
import AIChatPanel from '../components/AIChatPanel'
import PageHeader from '../components/PageHeader'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const SEV_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: 'var(--danger)',   bg: 'var(--danger-dim)',  border: 'rgba(248,113,113,0.3)' },
  high:     { color: '#fb923c',         bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)' },
  medium:   { color: 'var(--warning)', bg: 'var(--warning-dim)', border: 'rgba(251,191,36,0.3)' },
  low:      { color: 'var(--success)',  bg: 'var(--success-dim)', border: 'rgba(52,211,153,0.3)' },
}

export default function Issues() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ severity: '', category: '', status: '' })
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    setIssues([])
    setLoading(true)
    setExpanded(null)
    analysisApi.issues(projectId).then(setIssues).catch(() => setIssues([])).finally(() => setLoading(false))
  }, [projectId])

  const updateStatus = async (issueId: string, status: string) => {
    await analysisApi.updateIssue(projectId!, issueId, { status })
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status } : i))
    toast.success('Status updated')
  }

  const filtered = issues
    .filter(i => !filter.severity || i.severity === filter.severity)
    .filter(i => !filter.category || i.category === filter.category)
    .filter(i => !filter.status || i.status === filter.status)
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))

  const categories = [...new Set(issues.map(i => i.category).filter(Boolean))]
  const counts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high:     issues.filter(i => i.severity === 'high').length,
    medium:   issues.filter(i => i.severity === 'medium').length,
    low:      issues.filter(i => i.severity === 'low').length,
  }

  if (loading) return (
    <div className="loading-overlay">
      <span className="spinner spinner-lg" />
      <p>Loading issues…</p>
    </div>
  )

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <PageHeader>
        <h1>Issues & Technical Debt</h1>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {filtered.length} of {issues.length} issues
        </div>
      </PageHeader>

      <div className="page-body">
        {issues.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={44} />
            <h3>No Issues Found</h3>
            <p>Run analysis to discover technical debt and issues.</p>
          </div>
        ) : (
          <>
            {/* Severity summary cards */}
            <div className="grid-4" style={{ marginBottom: 20 }}>
              {(Object.entries(counts) as [string, number][]).map(([sev, count]) => {
                const cfg = SEV_CONFIG[sev]
                return (
                  <div
                    key={sev}
                    className="stat-card"
                    style={{
                      cursor: 'pointer',
                      borderColor: filter.severity === sev ? cfg.color : undefined,
                      background: filter.severity === sev ? cfg.bg : undefined,
                    }}
                    onClick={() => setFilter(f => ({ ...f, severity: f.severity === sev ? '' : sev }))}
                  >
                    <div className="stat-value" style={{ color: cfg.color }}>{count}</div>
                    <div className="stat-label" style={{ textTransform: 'capitalize' }}>{sev}</div>
                  </div>
                )
              })}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="form-input" style={{ width: 160 }} value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}>
                <option value="">All Severities</option>
                {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
              </select>
              <select className="form-input" style={{ width: 190 }} value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="form-input" style={{ width: 150 }} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="wont_fix">Won't Fix</option>
              </select>
              {(filter.severity || filter.category || filter.status) && (
                <button className="btn btn-sm" onClick={() => setFilter({ severity: '', category: '', status: '' })}>
                  Clear filters
                </button>
              )}
            </div>

            {/* Issue list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(issue => {
                const sev = SEV_CONFIG[issue.severity] || SEV_CONFIG.low
                return (
                  <div key={issue.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                      style={{ padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                      onClick={() => setExpanded(e => e === issue.id ? null : issue.id)}
                    >
                      {/* Severity stripe */}
                      <div style={{
                        width: 3,
                        alignSelf: 'stretch',
                        background: sev.color,
                        borderRadius: 2,
                        flexShrink: 0,
                        minHeight: 20,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{issue.title}</span>
                          <span className={`badge badge-${
                            issue.severity === 'critical' ? 'critical' :
                            issue.severity === 'high' ? 'high' :
                            issue.severity === 'medium' ? 'medium' : 'low'
                          }`}>
                            {issue.severity}
                          </span>
                          {issue.category && (
                            <span className="badge badge-neutral">{issue.category}</span>
                          )}
                          {issue.file_path && (
                            <span style={{
                              fontSize: 11, fontFamily: 'var(--mono)',
                              color: 'var(--text-muted)',
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border)',
                              borderRadius: 4, padding: '1px 6px',
                            }}>
                              {issue.file_path.split('/').pop()}
                            </span>
                          )}
                        </div>
                        {issue.description && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                            {issue.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <select
                          className="form-input"
                          style={{ width: 130, fontSize: 12, padding: '4px 28px 4px 8px' }}
                          value={issue.status}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); updateStatus(issue.id, e.target.value) }}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="wont_fix">Won't Fix</option>
                        </select>
                        {expanded === issue.id
                          ? <ChevronDown size={14} color="var(--text-muted)" />
                          : <ChevronRight size={14} color="var(--text-muted)" />
                        }
                      </div>
                    </div>

                    {expanded === issue.id && (
                      <div style={{ padding: '0 16px 16px 31px', borderTop: '1px solid var(--border-light)' }}>
                        <div className="grid-2" style={{ marginTop: 14, gap: 12 }}>
                          {issue.evidence && (
                            <div>
                              <div className="section-label" style={{ marginBottom: 6 }}>Evidence</div>
                              <div className="code-block" style={{ maxHeight: 120, fontSize: 11 }}>{issue.evidence}</div>
                            </div>
                          )}
                          {issue.why_matters && (
                            <div>
                              <div className="section-label" style={{ marginBottom: 6 }}>Why It Matters</div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{issue.why_matters}</p>
                            </div>
                          )}
                          {issue.recommended_action && (
                            <div>
                              <div className="section-label" style={{ color: 'var(--success)', marginBottom: 6 }}>Recommended Action</div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{issue.recommended_action}</p>
                            </div>
                          )}
                          <div>
                            <div className="section-label" style={{ marginBottom: 6 }}>Metrics</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span className="chip">Complexity: {issue.complexity}</span>
                              <span className="chip">Risk: {issue.risk}</span>
                              <span className="chip">Priority: {issue.priority}</span>
                            </div>
                          </div>
                        </div>
                        {issue.file_path && (
                          <div style={{ marginTop: 12 }}>
                            <button
                              className="btn btn-sm"
                              onClick={() => navigate(`/projects/${projectId}/transform?file=${encodeURIComponent(issue.file_path)}`)}
                            >
                              <Code2 size={12} />
                              Transform this file
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <AIChatPanel suggestedQuestions={[
        'Which security issues are most urgent to fix?',
        'How do I fix the SQL injection vulnerability?',
        'What is the quickest way to reduce technical debt?',
      ]} />
    </div>
  )
}
