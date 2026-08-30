import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { filesApi, transformationsApi } from '../api/client'
import {
  Code2, Zap, AlertTriangle, CheckCircle, List,
  Square, CheckSquare, MinusSquare, ChevronRight, ChevronDown, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AIChatPanel from '../components/AIChatPanel'
import PageHeader from '../components/PageHeader'

// ─── Types ───────────────────────────────────────────────────────────────────
interface BatchJob {
  path: string
  status: 'pending' | 'running' | 'done' | 'error'
  error?: string
  transformationId?: string
}

function buildTree(files: any[]) {
  return files
    .filter(f => f.is_supported && !f.is_binary)
    .sort((a, b) => a.path.localeCompare(b.path))
}

// ─── Indeterminate checkbox ───────────────────────────────────────────────────
function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ width: 13, height: 13, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
        aria-label={label}
      />
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
    </label>
  )
}

// ─── Batch progress overlay ───────────────────────────────────────────────────
function BatchProgress({
  jobs,
  onClose,
}: {
  jobs: BatchJob[]
  onClose: () => void
}) {
  const done  = jobs.filter(j => j.status === 'done').length
  const error = jobs.filter(j => j.status === 'error').length
  const total = jobs.length
  const pct   = total > 0 ? Math.round(((done + error) / total) * 100) : 0
  const allDone = done + error === total

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(8,13,24,0.92)',
      zIndex: 30,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '28px 32px',
        width: '100%',
        maxWidth: 520,
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {allDone ? 'Batch Transform Complete' : 'Transforming Files…'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {done} done · {error} error{error !== 1 ? 's' : ''} · {total - done - error} remaining
            </div>
          </div>
          {allDone && (
            <button className="btn-icon" onClick={onClose} aria-label="Close">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{done + error}/{total} files</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${pct}%`,
                background: error > 0 && allDone ? 'var(--warning)' : 'var(--success)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* File list */}
        <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {jobs.map(job => (
            <div
              key={job.path}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px',
                borderRadius: 7,
                background: job.status === 'running' ? 'var(--accent-dim)'
                          : job.status === 'done'    ? 'var(--success-dim)'
                          : job.status === 'error'   ? 'var(--danger-dim)'
                          : 'var(--bg-elevated)',
                border: `1px solid ${
                  job.status === 'running' ? 'var(--accent-border)'
                : job.status === 'done'    ? 'rgba(52,211,153,0.2)'
                : job.status === 'error'   ? 'rgba(248,113,113,0.2)'
                : 'var(--border-light)'
                }`,
                transition: 'background 0.2s, border-color 0.2s',
              }}
            >
              {job.status === 'running' && (
                <span className="spinner" style={{ width: 13, height: 13, flexShrink: 0 }} />
              )}
              {job.status === 'done' && (
                <CheckCircle size={13} color="var(--success)" style={{ flexShrink: 0 }} />
              )}
              {job.status === 'error' && (
                <AlertTriangle size={13} color="var(--danger)" style={{ flexShrink: 0 }} />
              )}
              {job.status === 'pending' && (
                <div style={{
                  width: 13, height: 13, borderRadius: '50%',
                  background: 'var(--text-muted)', flexShrink: 0, opacity: 0.4,
                }} />
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
                  {job.path.split('/').pop()}
                </div>
                {job.error && (
                  <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 1 }}>{job.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {allDone && (
          <button className="btn btn-primary" onClick={onClose} style={{ justifyContent: 'center' }}>
            {error === 0 ? 'Done — Review Results' : `Done (${error} failed — check history)`}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Transformation() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()

  const [files, setFiles]           = useState<any[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [instruction, setInstruction]     = useState('')
  const [targetTech, setTargetTech]       = useState('')

  // Single-file view state
  const [viewFile, setViewFile]           = useState<string>(searchParams.get('file') || '')
  const [transformation, setTransformation] = useState<any>(null)
  const [validating, setValidating]         = useState(false)
  const [validation, setValidation]         = useState<any>(null)
  const [activeTab, setActiveTab]           = useState<'diff' | 'explanation' | 'risks'>('diff')

  // Batch state
  const [batchJobs, setBatchJobs]   = useState<BatchJob[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const isBatchMode = selectedFiles.size > 1 || (selectedFiles.size === 1 && !transformation)
  const abortRef = useRef(false)

  // History
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    if (!projectId) return
    setFiles([])
    setHistory([])
    setSelectedFiles(new Set())
    setTransformation(null)
    setValidation(null)
    setBatchJobs([])
    filesApi.list(projectId).then(f => {
      setFiles(f)
      const fp = searchParams.get('file')
      if (fp) {
        setSelectedFiles(new Set([fp]))
        setViewFile(fp)
      }
    })
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const loadHistory = useCallback(async () => {
    if (!projectId) return
    transformationsApi.list(projectId).then(setHistory).catch(() => {})
  }, [projectId])

  const supportedFiles = buildTree(files)
  const allSelected    = supportedFiles.length > 0 && supportedFiles.every(f => selectedFiles.has(f.path))
  const someSelected   = supportedFiles.some(f => selectedFiles.has(f.path)) && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(supportedFiles.map(f => f.path)))
    }
    // Clear single-file view when toggling all
    setTransformation(null)
    setValidation(null)
  }

  const toggleFile = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
    // Switching to single-file view
    if (selectedFiles.size === 0 || (selectedFiles.size === 1 && selectedFiles.has(path))) {
      setTransformation(null)
      setValidation(null)
    }
    setViewFile(path)
  }

  // ── Single-file transform ─────────────────────────────────────────────────
  const transformSingle = async () => {
    const path = viewFile || Array.from(selectedFiles)[0]
    if (!path) { toast.error('Select a file first'); return }
    setTransformation(null)
    setValidation(null)

    // Re-use batch overlay with a single job for consistent UX
    const jobs: BatchJob[] = [{ path, status: 'running' }]
    setBatchJobs(jobs)
    setBatchRunning(true)
    try {
      const result = await transformationsApi.create(projectId!, {
        file_path: path,
        instruction: instruction || undefined,
        target_tech: targetTech || undefined,
      })
      setBatchJobs([{ path, status: 'done', transformationId: result.id }])
      setTransformation(result)
      setViewFile(path)
      setActiveTab('diff')
      await loadHistory()
      toast.success('Transformation generated — review before accepting')
    } catch (e: any) {
      setBatchJobs([{ path, status: 'error', error: e.response?.data?.detail || 'Failed' }])
      toast.error(e.response?.data?.detail || 'Transformation failed')
    } finally {
      setBatchRunning(false)
    }
  }

  // ── Batch transform ───────────────────────────────────────────────────────
  const transformBatch = async () => {
    const paths = Array.from(selectedFiles)
    if (!paths.length) { toast.error('Select at least one file'); return }

    abortRef.current = false
    setTransformation(null)
    setValidation(null)

    const jobs: BatchJob[] = paths.map(p => ({ path: p, status: 'pending' }))
    setBatchJobs(jobs)
    setBatchRunning(true)

    for (let i = 0; i < paths.length; i++) {
      if (abortRef.current) break
      const path = paths[i]

      // Mark as running
      setBatchJobs(prev => prev.map(j => j.path === path ? { ...j, status: 'running' } : j))

      try {
        const result = await transformationsApi.create(projectId!, {
          file_path: path,
          instruction: instruction || undefined,
          target_tech: targetTech || undefined,
        })
        setBatchJobs(prev => prev.map(j =>
          j.path === path ? { ...j, status: 'done', transformationId: result.id } : j
        ))
      } catch (e: any) {
        const msg = e.response?.data?.detail || 'Failed'
        setBatchJobs(prev => prev.map(j =>
          j.path === path ? { ...j, status: 'error', error: msg } : j
        ))
      }
    }

    setBatchRunning(false)
    await loadHistory()
    toast.success(`Batch complete — ${paths.length} file${paths.length > 1 ? 's' : ''} processed`)
  }

  const handleTransformClick = () => {
    if (selectedFiles.size > 1) {
      transformBatch()
    } else {
      transformSingle()
    }
  }

  const closeBatchOverlay = async () => {
    setBatchJobs([])
    await loadHistory()
    // If only one job succeeded, show its result
    const succeeded = batchJobs.filter(j => j.status === 'done')
    if (succeeded.length === 1 && succeeded[0].transformationId) {
      const t = await transformationsApi.get(projectId!, succeeded[0].transformationId).catch(() => null)
      if (t) {
        setTransformation(t)
        setViewFile(t.file_path)
        setActiveTab('diff')
      }
    }
  }

  // ── Single validate ────────────────────────────────────────────────────────
  const validateSingle = async () => {
    if (!transformation) return
    setValidating(true)
    try {
      const result = await transformationsApi.validate(projectId!, transformation.id)
      setValidation(result)
      toast.success('AI validation complete')
    } catch {
      toast.error('Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const isSingleMode = selectedFiles.size <= 1

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Batch progress overlay */}
      {batchJobs.length > 0 && (
        <BatchProgress
          jobs={batchJobs}
          onClose={closeBatchOverlay}
        />
      )}

      <PageHeader>
        <h1>Transformation Workspace</h1>
        <div className="alert alert-warning" style={{ margin: 0, padding: '6px 12px', fontSize: 11 }}>
          <AlertTriangle size={12} />
          AI proposals — developer review required before acceptance
        </div>
      </PageHeader>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ─── Left panel ───────────────────────────────────────────────── */}
        <div style={{
          width: 292,
          borderRight: '1px solid var(--border)',
          overflow: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0,
        }}>

          {/* File picker — multi-select list */}
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div className="form-label" style={{ margin: 0 }}>Files to Transform</div>
              {supportedFiles.length > 0 && (
                <IndeterminateCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  label="All"
                />
              )}
            </div>

            {supportedFiles.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                No supported files found
              </div>
            ) : (
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
                maxHeight: 260,
                overflowY: 'auto',
              }}>
                {supportedFiles.map((f, idx) => {
                  const isChecked = selectedFiles.has(f.path)
                  const isView    = viewFile === f.path
                  return (
                    <label
                      key={f.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '7px 10px',
                        cursor: 'pointer',
                        background: isView && isChecked ? 'var(--accent-dim)'
                                  : isChecked           ? 'rgba(79,124,255,0.06)'
                                  : 'transparent',
                        borderBottom: idx < supportedFiles.length - 1 ? '1px solid var(--border-light)' : 'none',
                        transition: 'background 0.12s',
                        userSelect: 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isChecked) e.currentTarget.style.background = 'var(--bg-elevated)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isView && isChecked ? 'var(--accent-dim)'
                          : isChecked ? 'rgba(79,124,255,0.06)' : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleFile(f.path)}
                        style={{ width: 13, height: 13, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: isChecked ? 600 : 400,
                          color: isChecked ? 'var(--text)' : 'var(--text-secondary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: 'var(--mono)',
                        }}>
                          {f.path.split('/').pop()}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text-muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {f.language || 'unknown'}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Selection count */}
            {selectedFiles.size > 0 && (
              <div style={{
                fontSize: 11, color: 'var(--accent)', marginTop: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected</span>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: 0 }}
                  onClick={() => { setSelectedFiles(new Set()); setTransformation(null); setValidation(null) }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Target tech */}
          <div>
            <div className="form-label">
              Target Technology{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </div>
            <input
              className="form-input"
              placeholder="e.g., Spring Boot 3, FastAPI…"
              value={targetTech}
              onChange={e => setTargetTech(e.target.value)}
            />
          </div>

          {/* Instruction */}
          <div>
            <div className="form-label">
              Specific Instruction{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </div>
            <textarea
              className="form-input"
              placeholder="e.g., Replace raw JDBC with Spring Data JPA…"
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              rows={3}
            />
          </div>

          {/* Transform button */}
          <button
            className="btn btn-primary"
            onClick={handleTransformClick}
            disabled={batchRunning || selectedFiles.size === 0}
            style={{ justifyContent: 'center', width: '100%' }}
          >
            {batchRunning
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Transforming…</>
              : selectedFiles.size > 1
                ? <><Zap size={14} /> Transform {selectedFiles.size} Files</>
                : <><Zap size={14} /> Generate Transformation</>
            }
          </button>

          {/* Validate button (single-file mode only) */}
          {isSingleMode && transformation && (
            <button
              className="btn"
              onClick={validateSingle}
              disabled={validating}
              style={{ justifyContent: 'center', width: '100%' }}
            >
              {validating
                ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Validating…</>
                : <><CheckCircle size={14} /> Run AI Validation</>
              }
            </button>
          )}

          {/* Inline validation result (single-file mode) */}
          {isSingleMode && validation && (
            <div className={`alert ${validation.overall_status === 'ready_for_review' ? 'alert-success' : 'alert-warning'}`}
              style={{ fontSize: 12, padding: '10px 12px' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {validation.overall_status === 'ready_for_review' ? '✓ Ready for Review' : '⚠ Issues Detected'}
              </div>
              {validation.errors?.length > 0 && (
                <ul style={{ paddingLeft: 14, marginTop: 4 }}>
                  {validation.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {validation.notes && <div style={{ marginTop: 4 }}>{validation.notes}</div>}
            </div>
          )}
        </div>

        {/* ─── Right panel ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Empty / history state */}
          {!transformation && !batchRunning && batchJobs.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {history.length > 0 ? (
                <div style={{ padding: 16 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 7,
                    marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    <List size={13} /> Recent Transformations
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {history.slice(0, 12).map(t => (
                      <div
                        key={t.id}
                        className="card-sm"
                        style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onClick={() => {
                          setTransformation(t)
                          setViewFile(t.file_path)
                          setSelectedFiles(new Set([t.file_path]))
                          setActiveTab('diff')
                          setValidation(null)
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                              {t.file_path.split('/').pop()}
                            </div>
                            <div style={{
                              fontSize: 10, color: 'var(--text-muted)',
                              fontFamily: 'var(--mono)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {t.file_path}
                            </div>
                          </div>
                          <span className={`badge badge-${
                            t.status === 'approved' ? 'info'
                          : t.status === 'rejected' ? 'neutral' : 'medium'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ flex: 1 }}>
                  <Code2 size={44} />
                  <h3>Transformation Workspace</h3>
                  <p>
                    Check one or more files on the left and click "Generate Transformation" to get AI-powered
                    modernization proposals. Use "All" to select every file at once.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Single-file transformation result */}
          {transformation && batchJobs.length === 0 && (
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                    {viewFile.split('/').pop()}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-muted)',
                    fontFamily: 'var(--mono)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {viewFile}
                  </div>
                </div>
                <span className={`badge badge-${
                  transformation.validation_status === 'ready_for_review' ? 'success'
                : transformation.validation_status === 'issues_detected'  ? 'high'
                : 'neutral'
                }`}>
                  {transformation.validation_status}
                </span>
              </div>

              <div className="tabs">
                <button className={`tab-btn ${activeTab === 'diff' ? 'active' : ''}`} onClick={() => setActiveTab('diff')}>
                  <Code2 size={12} /> Before / After
                </button>
                <button className={`tab-btn ${activeTab === 'explanation' ? 'active' : ''}`} onClick={() => setActiveTab('explanation')}>
                  Explanation
                </button>
                <button className={`tab-btn ${activeTab === 'risks' ? 'active' : ''}`} onClick={() => setActiveTab('risks')}>
                  Risks &amp; Review
                </button>
              </div>

              {activeTab === 'diff' && (
                <div className="diff-container">
                  <div className="diff-panel">
                    <div className="diff-panel-header" style={{ background: 'rgba(248,113,113,0.07)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>Legacy Code</span>
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', color: 'var(--text-muted)', fontSize: 11 }}>
                        {viewFile.split('/').pop()}
                      </span>
                    </div>
                    <div className="diff-panel-body">
                      <pre style={{
                        padding: '14px 16px', fontSize: 12, lineHeight: 1.65,
                        margin: 0, color: 'var(--text-secondary)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--mono)',
                      }}>
                        {transformation.original_code || 'No original code available'}
                      </pre>
                    </div>
                  </div>
                  <div className="diff-panel">
                    <div className="diff-panel-header" style={{ background: 'rgba(52,211,153,0.07)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>Modern Code (Proposed)</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--warning)', fontSize: 10, fontWeight: 600 }}>
                        ⚠ Review before accepting
                      </span>
                    </div>
                    <div className="diff-panel-body">
                      <pre style={{
                        padding: '14px 16px', fontSize: 12, lineHeight: 1.65,
                        margin: 0, color: 'var(--text)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--mono)',
                      }}>
                        {transformation.transformed_code || 'Transformation in progress…'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'explanation' && (
                <div className="card">
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                    What Changed &amp; Why
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                    {transformation.explanation || 'No explanation available.'}
                  </div>
                </div>
              )}

              {activeTab === 'risks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                      Risks &amp; Potential Issues
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                      {transformation.risks || 'No specific risks identified.'}
                    </div>
                  </div>
                  <div className="card">
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                      Required Manual Review
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                      {transformation.review_items || 'Standard developer review recommended.'}
                    </div>
                  </div>
                  <div className="alert alert-warning">
                    <AlertTriangle size={14} />
                    <div>
                      <strong>This transformation is an AI-generated proposal.</strong>{' '}
                      Never apply AI-generated code to production without thorough developer review, testing, and validation. The original code has not been modified.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AIChatPanel
        contextFile={viewFile}
        contextType="transformation"
        suggestedQuestions={viewFile ? [
          `Explain the main issues in ${viewFile.split('/').pop()}`,
          `How should I modernize ${viewFile.split('/').pop()}?`,
          `What tests should I write for this transformation?`,
        ] : []}
      />
    </div>
  )
}
