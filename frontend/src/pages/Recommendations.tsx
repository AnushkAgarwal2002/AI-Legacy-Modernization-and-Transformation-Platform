import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analysisApi } from '../api/client'
import { Lightbulb, ChevronDown, ChevronRight, Code2 } from 'lucide-react'
import AIChatPanel from '../components/AIChatPanel'

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const CATEGORY_COLORS: Record<string, string> = {
  Architecture:        'var(--purple)',
  'Code Quality':      'var(--accent)',
  Dependencies:        'var(--danger)',
  Security:            'var(--danger)',
  Performance:         'var(--warning)',
  Testing:             'var(--success)',
  Documentation:       'var(--info)',
  'Framework Migration':'var(--purple)',
  Database:            'var(--warning)',
  Deployment:          'var(--accent)',
  Maintainability:     'var(--info)',
}

export default function Recommendations() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ priority: '', category: '' })
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    setRecs([])
    setLoading(true)
    setExpanded(null)
    analysisApi.recommendations(projectId).then(setRecs).catch(() => setRecs([])).finally(() => setLoading(false))
  }, [projectId])

  const filtered = recs
    .filter(r => !filter.priority || r.priority === filter.priority)
    .filter(r => !filter.category || r.category === filter.category)
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4))

  const categories = [...new Set(recs.map(r => r.category).filter(Boolean))]
  const byCat: Record<string, number> = {}
  recs.forEach(r => { if (r.category) byCat[r.category] = (byCat[r.category] || 0) + 1 })

  if (loading) return (
    <div className="loading-overlay">
      <span className="spinner spinner-lg" />
      <p>Loading recommendations…</p>
    </div>
  )

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1>Recommendations</h1>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {filtered.length} of {recs.length} recommendations
        </div>
      </div>

      <div className="page-body">
        {recs.length === 0 ? (
          <div className="empty-state">
            <Lightbulb size={44} />
            <h3>No Recommendations Yet</h3>
            <p>Run analysis to generate modernization recommendations.</p>
          </div>
        ) : (
          <>
            {/* Category overview chips */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.entries(byCat).map(([cat, count]) => {
                const color = CATEGORY_COLORS[cat] || 'var(--accent)'
                const active = filter.category === cat
                return (
                  <div
                    key={cat}
                    style={{
                      background: active ? color + '18' : 'var(--bg-card)',
                      border: `1px solid ${active ? color + '60' : 'var(--border)'}`,
                      borderRadius: 8,
                      padding: '8px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onClick={() => setFilter(f => ({ ...f, category: f.category === cat ? '' : cat }))}
                  >
                    <div style={{ fontSize: 17, fontWeight: 700, color: color, lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>{cat}</div>
                  </div>
                )
              })}
            </div>

            {/* Filter row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <select className="form-input" style={{ width: 160 }} value={filter.priority} onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}>
                <option value="">All Priorities</option>
                {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p} style={{ textTransform: 'capitalize' }}>{p}</option>)}
              </select>
              <select className="form-input" style={{ width: 190 }} value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {(filter.priority || filter.category) && (
                <button className="btn btn-sm" onClick={() => setFilter({ priority: '', category: '' })}>Clear</button>
              )}
            </div>

            {/* Rec list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(rec => {
                const color = CATEGORY_COLORS[rec.category] || 'var(--warning)'
                return (
                  <div key={rec.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                      style={{ padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                      onClick={() => setExpanded(e => e === rec.id ? null : rec.id)}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: color + '18',
                        border: `1px solid ${color}25`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Lightbulb size={15} color={color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{rec.title}</span>
                          <span className={`badge badge-${
                            rec.priority === 'critical' ? 'critical' :
                            rec.priority === 'high' ? 'high' :
                            rec.priority === 'medium' ? 'medium' : 'low'
                          }`}>
                            {rec.priority}
                          </span>
                          {rec.category && (
                            <span className="badge badge-neutral">{rec.category}</span>
                          )}
                        </div>
                        {rec.problem && (
                          <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0, lineHeight: 1.55 }}>{rec.problem}</p>
                        )}
                      </div>
                      {expanded === rec.id
                        ? <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        : <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      }
                    </div>

                    {expanded === rec.id && (
                      <div style={{ padding: '0 16px 16px 62px', borderTop: '1px solid var(--border-light)' }}>
                        <div className="grid-2" style={{ marginTop: 14, gap: 12 }}>
                          {rec.evidence && (
                            <div>
                              <div className="section-label" style={{ marginBottom: 6 }}>Evidence</div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{rec.evidence}</p>
                            </div>
                          )}
                          {rec.proposed_solution && (
                            <div>
                              <div className="section-label" style={{ color: 'var(--success)', marginBottom: 6 }}>Proposed Solution</div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{rec.proposed_solution}</p>
                            </div>
                          )}
                          {rec.expected_benefit && (
                            <div>
                              <div className="section-label" style={{ color: 'var(--ai)', marginBottom: 6 }}>Expected Benefit</div>
                              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>{rec.expected_benefit}</p>
                            </div>
                          )}
                          {rec.related_files?.length > 0 && (
                            <div>
                              <div className="section-label" style={{ marginBottom: 6 }}>Related Files</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {rec.related_files.map((f: string) => (
                                  <span key={f} className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                                    {f.split('/').pop()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {rec.related_files?.length > 0 && (
                          <button
                            className="btn btn-sm"
                            style={{ marginTop: 12 }}
                            onClick={() => navigate(`/projects/${projectId}/transform?file=${encodeURIComponent(rec.related_files[0])}`)}
                          >
                            <Code2 size={12} />
                            Transform related file
                          </button>
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
        'What is the most impactful recommendation to start with?',
        'How risky is the framework migration?',
        'What would be the benefit of addressing the architecture issues?',
      ]} />
    </div>
  )
}
