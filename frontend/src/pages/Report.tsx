import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { reportsApi } from '../api/client'
import { FileText, Download, AlertTriangle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import ScoreBar from '../components/ScoreBar'
import AIChatPanel from '../components/AIChatPanel'
import PageHeader from '../components/PageHeader'

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

export default function Report() {
  const { projectId } = useParams<{ projectId: string }>()
  const [report, setReport] = useState<any>(null)
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    setGenerating(true)
    try {
      const r = await reportsApi.generate(projectId!)
      setReport(r)
      toast.success('Report generated')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const exportJSON = () => {
    if (!report) return
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `modernization-report-${report.project_id?.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportMarkdown = () => {
    if (!report) return
    const lines = [
      `# Modernization Report: ${report.project_name}`,
      `Generated: ${new Date(report.generated_at).toLocaleString()}`,
      '',
      '## Executive Summary',
      report.executive_summary || 'N/A',
      '',
      '## Architecture Assessment',
      report.architecture_assessment || 'N/A',
      '',
      '## Technical Debt Summary',
      report.technical_debt_summary || 'N/A',
      '',
      '## Target Architecture',
      report.target_architecture || 'N/A',
      '',
      '## Migration Plan Summary',
      report.migration_plan_summary || 'N/A',
      '',
      '## Risks',
      ...(report.risks || []).map((r: string) => `- ${r}`),
      '',
      '## Manual Review Items',
      ...(report.manual_review_items || []).map((m: string) => `- ${m}`),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `modernization-report-${report.project_id?.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <PageHeader>
        <h1>Modernization Report</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {report && (
            <>
              <button className="btn btn-sm" onClick={exportMarkdown}>
                <Download size={12} /> Markdown
              </button>
              <button className="btn btn-sm" onClick={exportJSON}>
                <Download size={12} /> JSON
              </button>
              <button className="btn btn-sm" onClick={generate} disabled={generating}>
                <RefreshCw size={12} /> Regenerate
              </button>
            </>
          )}
          {!report && (
            <button className="btn btn-primary btn-sm" onClick={generate} disabled={generating}>
              {generating
                ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Generating…</>
                : <><FileText size={13} /> Generate Report</>
              }
            </button>
          )}
        </div>
      </PageHeader>

      <div className="page-body">
        {!report && !generating && (
          <div className="empty-state">
            <FileText size={44} />
            <h3>Generate Modernization Report</h3>
            <p>
              Creates a comprehensive executive report with technology inventory, architecture assessment, technical debt analysis, recommendations, and migration plan.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={generate}>
              <FileText size={14} />
              Generate Report
            </button>
          </div>
        )}

        {generating && (
          <div className="loading-overlay">
            <div className="ai-loading">
              <div className="ai-dot-row">
                <div className="ai-dot" />
                <div className="ai-dot" />
                <div className="ai-dot" />
              </div>
              ModernIQ is generating your report…
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              Synthesizing all analysis findings into a comprehensive document.
            </p>
          </div>
        )}

        {report && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Report header card */}
            <div className="card" style={{
              background: 'linear-gradient(135deg, rgba(79,124,255,0.07), rgba(129,140,248,0.07))',
              borderColor: 'var(--accent-border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                    Modernization Report
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 4 }}>
                    {report.project_name}
                  </h2>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                    Generated: {new Date(report.generated_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[
                    { label: 'Issues',         value: report.issues_count,          color: 'var(--danger)' },
                    { label: 'High Priority',  value: report.high_priority_issues,  color: 'var(--warning)' },
                    { label: 'Transformations',value: report.transformations_count, color: 'var(--success)' },
                  ].map(stat => (
                    <div key={stat.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, letterSpacing: '-0.02em' }}>
                        {stat.value}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Executive Summary */}
            {report.executive_summary && (
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Executive Summary
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                  {report.executive_summary}
                </p>
              </div>
            )}

            <div className="grid-2">
              {/* Technology inventory */}
              {report.technology_inventory && (
                <div className="card">
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                    Technology Inventory
                  </div>
                  {Object.entries({
                    'Languages':  report.technology_inventory.languages,
                    'Frameworks': report.technology_inventory.frameworks,
                    'Libraries':  report.technology_inventory.libraries,
                    'Databases':  report.technology_inventory.databases,
                    'Build Tools':report.technology_inventory.build_tools,
                  }).filter(([, v]) => (v as any[])?.length > 0).map(([k, v]) => (
                    <div key={k} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
                        {k}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(v as string[]).map(item => (
                          <span key={item} className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{item}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Assessment scores */}
              {report.assessment_scores && Object.keys(report.assessment_scores).length > 0 && (
                <div className="card">
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                    Assessment Scores
                  </div>
                  <div className="alert alert-warning" style={{ fontSize: 11, marginBottom: 14, padding: '6px 10px' }}>
                    AI-assisted heuristic scores — not objective measurements
                  </div>
                  {Object.entries(report.assessment_scores).map(([key, val]: any) => (
                    <ScoreBar key={key} label={SCORE_LABELS[key] || key} score={val?.score || 0} />
                  ))}
                </div>
              )}
            </div>

            {/* Architecture assessment */}
            {report.architecture_assessment && (
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Architecture Assessment
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                  {report.architecture_assessment}
                </p>
              </div>
            )}

            {/* Technical debt */}
            {report.technical_debt_summary && (
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Technical Debt Summary
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                  {report.technical_debt_summary}
                </p>
              </div>
            )}

            {/* Recommendations summary */}
            {report.recommendations_summary?.length > 0 && (
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                  Key Recommendations
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Recommendation</th>
                      <th>Category</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recommendations_summary.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontSize: 13 }}>{r.title}</td>
                        <td><span className="badge badge-neutral">{r.category}</span></td>
                        <td>
                          <span className={`badge badge-${
                            r.priority === 'critical' ? 'critical' :
                            r.priority === 'high' ? 'high' :
                            r.priority === 'medium' ? 'medium' : 'low'
                          }`}>
                            {r.priority}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Target architecture */}
            {report.target_architecture && (
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Recommended Target Architecture
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                  {report.target_architecture}
                </p>
              </div>
            )}

            {/* Migration plan */}
            {report.migration_plan_summary && (
              <div className="card">
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                  Migration Plan Summary
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                  {report.migration_plan_summary}
                </p>
              </div>
            )}

            <div className="grid-2">
              {/* Risks */}
              {report.risks?.length > 0 && (
                <div className="card">
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                    Known Risks
                  </div>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {report.risks.map((r: string, i: number) => (
                      <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <AlertTriangle size={12} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Manual review */}
              {report.manual_review_items?.length > 0 && (
                <div className="card">
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ai)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
                    Manual Review Required
                  </div>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {report.manual_review_items.map((m: string, i: number) => (
                      <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--ai)', flexShrink: 0, marginTop: 1 }}>→</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <AIChatPanel suggestedQuestions={[
        'Summarize the most critical findings from the report',
        'What should be prioritized first?',
        'What is the estimated migration timeline?',
      ]} />
    </div>
  )
}
