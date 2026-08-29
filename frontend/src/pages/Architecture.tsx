import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { analysisApi } from '../api/client'
import { GitBranch } from 'lucide-react'
import ArchDiagram from '../components/ArchDiagram'
import AIChatPanel from '../components/AIChatPanel'

export default function Architecture() {
  const { projectId } = useParams<{ projectId: string }>()
  const [models, setModels] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'current' | 'recommended'>('current')

  useEffect(() => {
    if (!projectId) return
    // Reset state immediately when project changes so stale data from the
    // previous project is never displayed for the new one.
    setModels([])
    setLoading(true)
    setActiveTab('current')
    analysisApi.architecture(projectId).then(setModels).catch(() => setModels([])).finally(() => setLoading(false))
  }, [projectId])

  if (loading) return <div className="loading-overlay"><span className="spinner spinner-lg" /></div>

  const current = models.find(m => m.model_type === 'current')
  const recommended = models.find(m => m.model_type === 'recommended')

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h1>Architecture</h1>
      </div>
      <div className="page-body">
        {models.length === 0 ? (
          <div className="empty-state">
            <GitBranch size={48} />
            <h3>No Architecture Data</h3>
            <p>Run analysis first to generate architecture models.</p>
          </div>
        ) : (
          <>
            <div className="tabs">
              <button className={`tab-btn ${activeTab === 'current' ? 'active' : ''}`} onClick={() => setActiveTab('current')}>
                Current Legacy Architecture
              </button>
              <button className={`tab-btn ${activeTab === 'recommended' ? 'active' : ''}`} onClick={() => setActiveTab('recommended')}>
                Recommended Modern Architecture
              </button>
            </div>

            {activeTab === 'current' && current && (
              <div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="section-title" style={{ marginBottom: 8 }}>Current Architecture Pattern</div>
                      <span className="badge badge-purple" style={{ fontSize: 13, padding: '4px 12px', marginBottom: 12, display: 'inline-block' }}>
                        {current.pattern || 'Unknown'}
                      </span>
                      {current.description && (
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 8 }}>{current.description}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{current.nodes?.length || 0} components</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{current.edges?.length || 0} relationships</div>
                    </div>
                  </div>
                </div>
                <ArchDiagram nodes={current.nodes || []} edges={current.edges || []} title="Legacy System Architecture" />
                <div className="alert alert-warning" style={{ marginTop: 16 }}>
                  This diagram is AI-generated from static code analysis. Hover over nodes for details. Some relationships may be inferred rather than directly observed.
                </div>
              </div>
            )}

            {activeTab === 'recommended' && recommended && (
              <div>
                <div className="card" style={{ marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div className="section-title" style={{ marginBottom: 8 }}>Recommended Modern Architecture</div>
                    <span className="badge badge-info" style={{ fontSize: 13, padding: '4px 12px', marginBottom: 12, display: 'inline-block' }}>
                      {recommended.pattern || 'Modern'}
                    </span>
                    {recommended.description && (
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 8 }}>{recommended.description}</p>
                    )}
                  </div>
                </div>
                <ArchDiagram nodes={recommended.nodes || []} edges={recommended.edges || []} title="Recommended Modern Architecture" />
                <div className="alert alert-info" style={{ marginTop: 16 }}>
                  This is an AI-generated architectural recommendation based on the detected legacy patterns and modernization objectives. Treat as a starting point for architectural discussion.
                </div>
              </div>
            )}

            {activeTab === 'recommended' && !recommended && (
              <div className="empty-state">
                <h3>No Recommendation Generated</h3>
                <p>Re-run analysis to generate architecture recommendations.</p>
              </div>
            )}
          </>
        )}
      </div>
      <AIChatPanel suggestedQuestions={[
        'Why was this architecture recommended?',
        'What are the biggest architectural risks in the current system?',
        'How should I approach the architectural migration?',
      ]} />
    </div>
  )
}
