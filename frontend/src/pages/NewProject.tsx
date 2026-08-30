import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../api/client'
import { Cpu, ArrowRight, Zap, X } from 'lucide-react'
import toast from 'react-hot-toast'

const TECH_OPTIONS = [
  'Java (Spring MVC / Struts)', 'Java EE', 'Python 2.x', 'Python (Django/Flask)',
  'Node.js (legacy)', 'PHP (legacy)', 'ASP.NET WebForms', 'ASP.NET MVC', 'Ruby on Rails',
  'Perl', 'COBOL', 'VB.NET', 'Classic ASP', 'ColdFusion', 'Other',
]
const TARGET_OPTIONS = [
  'Java (Spring Boot 3)', 'Python (FastAPI / Django 4)', 'Node.js (Express / NestJS)',
  'TypeScript (NestJS)', 'Go', 'React (frontend modernization)', 'ASP.NET Core',
  'Containerized (Docker/K8s)', 'Microservices', 'Let AI recommend', 'Other',
]
const OBJECTIVE_OPTIONS = [
  'Reduce technical debt', 'Migrate to cloud', 'Improve security posture',
  'Increase testability', 'Improve maintainability', 'Framework migration',
  'Architectural modernization', 'Performance improvement', 'Full stack modernization',
]

export default function NewProject() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    description: '',
    legacy_tech: '',
    target_tech: '',
    objective: '',
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<any>({})

  const set = (key: string, val: string) => {
    setForm(f => ({ ...f, [key]: val }))
    setErrors((e: any) => ({ ...e, [key]: undefined }))
  }

  const validate = () => {
    const e: any = {}
    if (!form.name.trim()) e.name = 'Project name is required'
    return e
  }

  const save = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      const project = await projectsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        legacy_tech: form.legacy_tech || undefined,
        target_tech: form.target_tech || undefined,
        objective: form.objective || undefined,
      })
      toast.success('Project created')
      navigate(`/projects/${project.id}/files`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #4F7CFF, #818CF8)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Cpu size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
            New Modernization Project
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            Tell us about your legacy application. ModernIQ will analyze it and guide you through modernization.
          </p>
        </div>

        <div className="card" style={{ padding: '24px 28px' }}>
          {/* Name */}
          <div className="form-group">
            <label className="form-label">Project Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              className="form-input"
              placeholder="e.g., ACME Inventory System"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              style={errors.name ? { borderColor: 'var(--danger)' } : {}}
              autoFocus
            />
            {errors.name && (
              <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={11} /> {errors.name}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">
              Description{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <textarea
              className="form-input"
              placeholder="Brief description of what this application does…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Tech */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">
                Legacy Tech{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <select className="form-input" value={form.legacy_tech} onChange={e => set('legacy_tech', e.target.value)}>
                <option value="">Unknown — AI will detect</option>
                {TECH_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Target Tech{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  (optional)
                </span>
              </label>
              <select className="form-input" value={form.target_tech} onChange={e => set('target_tech', e.target.value)}>
                <option value="">Let AI recommend</option>
                {TARGET_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Objective */}
          <div className="form-group">
            <label className="form-label">
              Modernization Objective{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <select className="form-input" value={form.objective} onChange={e => set('objective', e.target.value)}>
              <option value="">General modernization</option>
              {OBJECTIVE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn" onClick={() => navigate('/projects')}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Creating…</> : <><ArrowRight size={14} /> Create Project</>}
            </button>
          </div>
        </div>

        {/* Demo notice */}
        <div className="alert alert-info" style={{ marginTop: 14, fontSize: 12 }}>
          <Zap size={14} style={{ flexShrink: 0 }} />
          <div>
            <strong>Quick Demo:</strong> After creating a project, you can load the built-in legacy Java demo with one click and jump straight to analysis.
          </div>
        </div>
      </div>
    </div>
  )
}
