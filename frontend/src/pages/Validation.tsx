import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { transformationsApi } from '../api/client'
import {
  ShieldCheck, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  PlayCircle, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AIChatPanel from '../components/AIChatPanel'
import PageHeader from '../components/PageHeader'

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string; badge: string }> = {
  ready_for_review: { icon: CheckCircle,   color: 'var(--success)', label: 'Ready for Review', badge: 'success' },
  issues_detected:  { icon: AlertTriangle, color: 'var(--warning)', label: 'Issues Detected',  badge: 'high' },
}

// Per-file progress row used during batch validation
interface BatchValJob {
  transformationId: string
  filePath: string
  status: 'pending' | 'running' | 'done' | 'error'
  error?: string
}

export default function Validation() {
  const { projectId } = useParams<{ projectId: string }>()

  const [validations, setValidations]     = useState<any[]>([])
  const [transformations, setTransformations] = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [expanded, setExpanded]           = useState<string | null>(null)

  // Batch-validate state
  const [batchJobs, setBatchJobs]         = useState<BatchValJob[]>([])
  const [batchRunning, setBatchRunning]   = useState(false)

  const loadData = useCallback(() => {
    if (!projectId) return
    return Promise.all([
      transformationsApi.validations(projectId).catch(() => []),
      transformationsApi.list(projectId).catch(() => []),
    ]).then(([v, t]) => {
      setValidations(v)
      setTransformations(t)
    })
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    loadData()?.finally(() => setLoading(false))
  }, [projectId, loadData])

  const getTransformation = (id: string) => transformations.find(t => t.id === id)

  // ── Batch validate pending transformations ────────────────────────────────
  const handleValidateAll = async () => {
    const pending = transformations.filter(t => t.validation_status === 'pending')
    if (!pending.length) {
      toast('No pending transformations to validate')
      return
    }

    const jobs: BatchValJob[] = pending.map(t => ({
      transformationId: t.id,
      filePath: t.file_path,
      status: 'pending',
    }))
    setBatchJobs(jobs)
    setBatchRunning(true)

    let successCount = 0
    let errorCount   = 0

    for (const t of pending) {
      setBatchJobs(prev => prev.map(j =>
        j.transformationId === t.id ? { ...j, status: 'running' } : j
      ))
      try {
        await transformationsApi.validate(projectId!, t.id)
        setBatchJobs(prev => prev.map(j =>
          j.transformationId === t.id ? { ...j, status: 'done' } : j
        ))
        successCount++
      } catch (e: any) {
        const msg = e.response?.data?.detail || 'Validation failed'
        setBatchJobs(prev => prev.map(j =>
          j.transformationId === t.id ? { ...j, status: 'error', error: msg } : j
        ))
        errorCount++
      }
    }

    setBatchRunning(false)

    // Refresh validation list
    await loadData()

    if (errorCount === 0) {
      toast.success(`${successCount} validation${successCount !== 1 ? 's' : ''} complete`)
    } else {
      toast(`${successCount} done, ${errorCount} failed`, { icon: '⚠' })
    }

    // Auto-clear progress after 3 s
    setTimeout(() => setBatchJobs([]), 3000)
  }

  if (loading) return (
    <div className="loading-overlay">
      <span className="spinner spinner-lg" />
      <p>Loading validations…</p>
    </div>
  )

  const readyCount   = validations.filter(v => v.overall_status === 'ready_for_review').length
  const issuesCount  = validations.filter(v => v.overall_status === 'issues_detected').length
  const pendingCount = transformations.filter(t => t.validation_status === 'pending').length

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <PageHeader>
        <div>
          <h1>Validation Center</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>
            AI assessments of transformation quality
          </p>
        </div>
        {pendingCount > 0 && (
          <button
            className="btn btn-primary"
            onClick={handleValidateAll}
            disabled={batchRunning}
            style={{ gap: 7 }}
          >
            {batchRunning
              ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Validating…</>
              : <><PlayCircle size={14} /> Validate All Pending ({pendingCount})</>
            }
          </button>
        )}
      </PageHeader>

      <div className="page-body">
        <div className="alert alert-ai" style={{ marginBottom: 20 }}>
          <ShieldCheck size={14} />
          <div>
            <strong>AI-Assisted Validation:</strong>{' '}
            Validations represent AI assessments of transformation quality — not compiled or executed test results.
            Always perform full developer testing before applying any transformation.
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{readyCount}</div>
            <div className="stat-label">Ready for Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{issuesCount}</div>
            <div className="stat-label">Issues Detected</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{pendingCount}</div>
            <div className="stat-label">Pending Validation</div>
          </div>
        </div>

        {/* Batch progress panel */}
        {batchJobs.length > 0 && (
          <div className="card" style={{ marginBottom: 20, padding: '16px 18px' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
            }}>
              <RefreshCw size={12} /> Batch Validation Progress
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {batchJobs.map(job => (
                <div
                  key={job.transformationId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 7,
                    background: job.status === 'running' ? 'var(--accent-dim)'
                              : job.status === 'done'    ? 'var(--success-dim)'
                              : job.status === 'error'   ? 'var(--danger-dim)'
                              : 'var(--bg-elevated)',
                    border: `1px solid ${
                      job.status === 'running' ? 'var(--accent-border)'
                    : job.status === 'done'    ? 'rgba(52,211,153,0.2)'
                    : job.status === 'error'   ? 'rgba(248,113,113,0.2)'
                    : 'var(--border-light)'}`,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  {job.status === 'running' && <span className="spinner" style={{ width: 13, height: 13, flexShrink: 0 }} />}
                  {job.status === 'done'    && <CheckCircle  size={13} color="var(--success)" style={{ flexShrink: 0 }} />}
                  {job.status === 'error'   && <AlertTriangle size={13} color="var(--danger)"  style={{ flexShrink: 0 }} />}
                  {job.status === 'pending' && (
                    <div style={{ width: 13, height: 13, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0, opacity: 0.4 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 500,
                      color: job.status === 'error' ? 'var(--danger)'
                           : job.status === 'done'  ? 'var(--success)'
                           : 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontFamily: 'var(--mono)',
                    }}>
                      {job.filePath.split('/').pop()}
                    </div>
                    {job.error && (
                      <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 1 }}>{job.error}</div>
                    )}
                  </div>
                  <span className={`badge badge-${
                    job.status === 'done'    ? 'success'
                  : job.status === 'error'   ? 'critical'
                  : job.status === 'running' ? 'info'
                  : 'neutral'}`}>
                    {job.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {validations.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={44} />
            <h3>No Validations Yet</h3>
            <p>
              {pendingCount > 0
                ? `${pendingCount} transformation${pendingCount !== 1 ? 's are' : ' is'} ready to validate. Click "Validate All Pending" above.`
                : 'Generate a transformation in the Transformation Workspace and run AI validation to see results here.'
              }
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {validations.map(v => {
              const trans = getTransformation(v.transformation_id)
              const cfg   = STATUS_CONFIG[v.overall_status] || STATUS_CONFIG.issues_detected
              return (
                <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div
                    style={{ padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                    onClick={() => setExpanded(e => e === v.id ? null : v.id)}
                    role="button"
                    aria-expanded={expanded === v.id}
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setExpanded(ex => ex === v.id ? null : v.id)}
                  >
                    <cfg.icon size={16} color={cfg.color} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                        {trans?.file_path?.split('/').pop() || 'Unknown file'}
                      </div>
                      {trans?.file_path && (
                        <div style={{
                          fontSize: 11, color: 'var(--text-muted)',
                          fontFamily: 'var(--mono)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {trans.file_path}
                        </div>
                      )}
                    </div>
                    <span className={`badge badge-${cfg.badge}`}>{cfg.label}</span>
                    {expanded === v.id
                      ? <ChevronDown  size={14} color="var(--text-muted)" />
                      : <ChevronRight size={14} color="var(--text-muted)" />
                    }
                  </div>

                  {expanded === v.id && (
                    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
                      <div className="grid-2" style={{ gap: 14 }}>
                        {v.errors?.length > 0 && (
                          <div>
                            <div className="section-label" style={{ color: 'var(--danger)', marginBottom: 8 }}>Errors</div>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {v.errors.map((e: string, i: number) => (
                                <li key={i} style={{ color: 'var(--danger)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                  <span style={{ flexShrink: 0, marginTop: 1 }}>•</span> {e}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {v.warnings?.length > 0 && (
                          <div>
                            <div className="section-label" style={{ color: 'var(--warning)', marginBottom: 8 }}>Warnings</div>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {v.warnings.map((w: string, i: number) => (
                                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                  <span style={{ flexShrink: 0, marginTop: 1 }}>•</span> {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {v.manual_review_items?.length > 0 && (
                          <div>
                            <div className="section-label" style={{ color: 'var(--ai)', marginBottom: 8 }}>Manual Review Required</div>
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {v.manual_review_items.map((m: string, i: number) => (
                                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                  <span style={{ flexShrink: 0, marginTop: 1 }}>→</span> {m}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {v.static_analysis?.length > 0 && (
                          <div>
                            <div className="section-label" style={{ marginBottom: 8 }}>Static Analysis</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {v.static_analysis.map((s: any, i: number) => (
                                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <span className={`badge badge-${
                                    s.severity === 'error'   ? 'critical'
                                  : s.severity === 'warning' ? 'medium'
                                  : 'neutral'}`}>
                                    {s.severity}
                                  </span>
                                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {v.notes && (
                          <div>
                            <div className="section-label" style={{ marginBottom: 8 }}>Notes</div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{v.notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="alert alert-warning" style={{ marginTop: 14, fontSize: 12 }}>
                        <AlertTriangle size={13} />
                        This validation is AI-generated. It does not represent compilation, execution, or automated test results.
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AIChatPanel suggestedQuestions={[
        'What do I need to manually test after the transformation?',
        'What validation checks are most important?',
        'Are there any integration risks I should check?',
      ]} />
    </div>
  )
}
