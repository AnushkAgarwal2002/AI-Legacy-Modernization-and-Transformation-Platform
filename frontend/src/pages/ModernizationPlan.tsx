import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { analysisApi } from '../api/client'
import { ListChecks, CheckCircle, Clock, Circle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import AIChatPanel from '../components/AIChatPanel'
import PageHeader from '../components/PageHeader'

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  not_started: { icon: Circle,      color: 'var(--text-muted)', label: 'Not Started' },
  in_progress: { icon: Clock,       color: 'var(--accent)',     label: 'In Progress' },
  completed:   { icon: CheckCircle, color: 'var(--success)',    label: 'Completed' },
  blocked:     { icon: AlertCircle, color: 'var(--danger)',     label: 'Blocked' },
}

export default function ModernizationPlan() {
  const { projectId } = useParams<{ projectId: string }>()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    // Reset before loading so stale data from a different project is never shown
    setPlan(null)
    setLoading(true)
    setExpandedStage(null)
    analysisApi.plan(projectId).then(p => {
      setPlan(p)
      if (p?.stages?.[0]) setExpandedStage(p.stages[0].name)
    }).catch(() => setPlan(null)).finally(() => setLoading(false))
  }, [projectId])

  const updateTask = async (taskId: string, status: string) => {
    try {
      await analysisApi.updateTask(projectId!, taskId, { status })
      setPlan((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          tasks: (prev.tasks || []).map((t: any) => t.id === taskId ? { ...t, status } : t),
        }
      })
      toast.success('Task updated')
    } catch {
      toast.error('Failed to update task')
    }
  }

  if (loading) return (
    <div className="loading-overlay">
      <span className="spinner spinner-lg" />
      <p>Loading plan…</p>
    </div>
  )

  if (!plan) return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <PageHeader><h1>Modernization Plan</h1></PageHeader>
      <div className="page-body">
        <div className="empty-state">
          <ListChecks size={44} />
          <h3>No Plan Generated</h3>
          <p>Run analysis to generate an AI-powered modernization plan.</p>
        </div>
      </div>
    </div>
  )

  const tasks = plan.tasks || []
  const stages = plan.stages || []
  const tasksByStage: Record<string, any[]> = {}
  tasks.forEach((t: any) => {
    if (!tasksByStage[t.stage_name]) tasksByStage[t.stage_name] = []
    tasksByStage[t.stage_name].push(t)
  })

  const total    = tasks.length
  const done     = tasks.filter((t: any) => t.status === 'completed').length
  const inProg   = tasks.filter((t: any) => t.status === 'in_progress').length
  const blocked  = tasks.filter((t: any) => t.status === 'blocked').length
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <PageHeader>
        <h1>Modernization Plan</h1>
        <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
          <span style={{ color: 'var(--success)' }}>✓ {done} done</span>
          <span style={{ color: 'var(--accent)' }}>⟳ {inProg} in progress</span>
          <span style={{ color: 'var(--danger)' }}>✗ {blocked} blocked</span>
          <span style={{ color: 'var(--text-muted)' }}>{total - done - inProg - blocked} pending</span>
        </div>
      </PageHeader>

      <div className="page-body">
        {/* Overall progress */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <ListChecks size={13} color="var(--ai)" /> Overall Progress
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: progressPct === 100 ? 'var(--success)' : 'var(--text-secondary)' }}>
              {progressPct}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%`, background: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {done} of {total} tasks completed
          </div>
        </div>

        {/* Stages */}
        {stages.map((stage: any, stageIdx: number) => {
          const stageTasks = tasksByStage[stage.name] || []
          const stageDone = stageTasks.filter(t => t.status === 'completed').length
          const isComplete = stageDone === stageTasks.length && stageTasks.length > 0
          const isOpen = expandedStage === stage.name
          const stageProgress = stageTasks.length > 0 ? (stageDone / stageTasks.length) * 100 : 0

          return (
            <div key={stage.name} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
              <div
                style={{ padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                onClick={() => setExpandedStage(isOpen ? null : stage.name)}
              >
                {/* Stage number circle */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: isComplete ? 'var(--success-dim)' : 'var(--bg-elevated)',
                  border: `2px solid ${isComplete ? 'var(--success)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  color: isComplete ? 'var(--success)' : 'var(--text-muted)',
                  flexShrink: 0,
                  fontFamily: 'var(--mono)',
                }}>
                  {isComplete ? '✓' : stageIdx + 1}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{stage.name}</div>
                  {stage.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stage.description}</div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{stageDone}/{stageTasks.length}</span>
                  <div style={{ width: 64 }}>
                    <div className="progress-track" style={{ height: 3 }}>
                      <div className="progress-fill" style={{ width: `${stageProgress}%`, background: 'var(--success)' }} />
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                </div>
              </div>

              {isOpen && stageTasks.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {stageTasks.sort((a, b) => a.suggested_order - b.suggested_order).map((task: any, taskIdx: number) => {
                    const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started
                    return (
                      <div
                        key={task.id}
                        style={{
                          padding: '11px 16px 11px 56px',
                          borderBottom: taskIdx < stageTasks.length - 1 ? '1px solid var(--border-light)' : 'none',
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
                            <cfg.icon size={13} color={cfg.color} style={{ flexShrink: 0 }} />
                            <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{task.title}</span>
                            <span className={`badge badge-${task.priority === 'high' ? 'high' : task.priority === 'low' ? 'low' : 'medium'}`}>
                              {task.priority}
                            </span>
                            <span className="chip">complexity: {task.complexity}</span>
                            <span className="chip">risk: {task.risk}</span>
                          </div>
                          {task.description && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.55, marginLeft: 21 }}>
                              {task.description}
                            </p>
                          )}
                          {task.related_files?.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 21 }}>
                              {task.related_files.map((f: string) => (
                                <span key={f} className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>
                                  {f.split('/').pop()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <select
                          className="form-input"
                          style={{ width: 148, fontSize: 12, padding: '4px 28px 4px 8px', flexShrink: 0 }}
                          value={task.status}
                          onChange={e => updateTask(task.id, e.target.value)}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="blocked">Blocked</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <AIChatPanel suggestedQuestions={[
        'What order should I tackle these tasks?',
        'Which stage is highest risk?',
        'What tasks can be parallelized?',
      ]} />
    </div>
  )
}
