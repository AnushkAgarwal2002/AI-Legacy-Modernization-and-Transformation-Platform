import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../api/client'
import {
  FolderOpen, Plus, Clock, CheckCircle, Loader, AlertCircle,
  ArrowRight, MoreVertical, Trash2, ExternalLink
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

/**
 * DuckDB returns UTC timestamps WITHOUT a timezone suffix, e.g. "2024-01-15T10:30:00".
 * Browsers parse bare ISO strings as LOCAL time, causing wrong relative times.
 * This helper appends "Z" if no timezone info is present so the date is
 * always treated as UTC.
 */
function parseUTCDate(raw: string): Date {
  if (!raw) return new Date()
  // If already has timezone info (+XX:XX, -XX:XX, or Z) leave it alone
  if (/[Zz]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) return new Date(raw)
  return new Date(raw + 'Z')
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface Project {
  id: string
  name: string
  description?: string
  legacy_tech?: string
  target_tech?: string
  objective?: string
  status: string          // 'created' | 'analyzed' (from projects table)
  created_at: string
  updated_at: string
  metadata?: {
    assessment_scores?: Record<string, { score: number; rationale?: string }>
    executive_summary?: string
    target_tech_recommendation?: string
  }
}

// ─── Status config ──────────────────────────────────────────────────────────
// Only 'created' and 'analyzed' are valid project-row statuses.
const STATUS_CONFIG: Record<string, { color: string; label: string; dot: string }> = {
  created:  { color: 'var(--text-muted)', label: 'Ready',    dot: 'dot-gray' },
  analyzed: { color: 'var(--success)',    label: 'Analyzed', dot: 'dot-green' },
}

/** Compute an overall health score (0-100) from assessment_scores if present. */
function overallScore(scores?: Record<string, { score: number }>): number | null {
  if (!scores) return null
  const vals = Object.values(scores).map(v => v?.score ?? 0).filter(n => n > 0)
  if (!vals.length) return null
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

/** Pick a colour for the health score. */
function scoreColor(n: number): string {
  if (n >= 70) return 'var(--success)'
  if (n >= 45) return 'var(--warning)'
  return 'var(--danger)'
}

// ─── Three-dot overflow menu ─────────────────────────────────────────────────
function ProjectMenu({
  projectId,
  projectName,
  onDelete,
  onOpen,
}: {
  projectId: string
  projectName: string
  onDelete: (id: string, name: string) => void
  onOpen: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        className="btn-icon"
        aria-label="Project options"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px',
          borderRadius: 6,
        }}
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="dropdown-menu"
          role="menu"
          style={{ right: 0, top: 'calc(100% + 4px)' }}
        >
          <button
            className="dropdown-item"
            role="menuitem"
            onClick={() => { setOpen(false); onOpen(projectId) }}
          >
            <ExternalLink size={13} />
            Open
          </button>
          <div className="dropdown-divider" />
          <button
            className="dropdown-item danger"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(projectId, projectName) }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteModal({
  project,
  onCancel,
  onConfirm,
  deleting,
}: {
  project: { id: string; name: string }
  onCancel: () => void
  onConfirm: () => void
  deleting: boolean
}) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [deleting, onCancel])

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onCancel() }}
    >
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div style={{
            width: 40, height: 40,
            background: 'var(--danger-dim)',
            border: '1px solid rgba(248,113,113,0.25)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Trash2 size={18} color="var(--danger)" />
          </div>
          <div>
            <div className="modal-title" id="delete-modal-title">Delete project?</div>
            <div className="modal-subtitle">
              Are you sure you want to delete{' '}
              <strong style={{ color: 'var(--text)' }}>"{project.name}"</strong>?
              This action cannot be undone.
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn"
            onClick={onCancel}
            disabled={deleting}
            autoFocus
          >
            Cancel
          </button>
          <button
            className="btn btn-danger-solid"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Deleting…</> : <>
              <Trash2 size={13} />
              Delete Project
            </>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project
  onOpen: (id: string) => void
  onDelete: (id: string, name: string) => void
}) {
  const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.created
  const score = overallScore(project.metadata?.assessment_scores)

  // After analysis, the backend writes the AI-detected legacy tech and
  // AI-recommended target tech directly into the project row's legacy_tech
  // and target_tech fields.  We use those fields directly — no fallback needed.
  const effectiveTarget = project.target_tech || null

  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', padding: '18px 20px' }}
      onClick={() => onOpen(project.id)}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-border)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

        {/* ── Left: info ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Name + status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {project.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className={`dot ${cfg.dot}`} />
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: cfg.color,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Description — only if the user provided one */}
          {project.description && (
            <p style={{
              color: 'var(--text-secondary)', fontSize: 13,
              marginBottom: 8, lineHeight: 1.55,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {project.description}
            </p>
          )}

          {/* Tech / objective chips — only render chips that have real data */}
          {(project.legacy_tech || effectiveTarget || project.objective) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
              {project.legacy_tech && (
                <span className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                  {project.legacy_tech}
                </span>
              )}
              {effectiveTarget && (
                <span className="chip" style={{
                  fontFamily: 'var(--mono)', fontSize: 11,
                  color: 'var(--success)',
                  borderColor: 'rgba(52,211,153,0.3)',
                  background: 'var(--success-dim)',
                }}>
                  → {effectiveTarget}
                </span>
              )}
              {project.objective && (
                <span className="chip" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {project.objective}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Right: score + menu + timestamp ─────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          <ProjectMenu
            projectId={project.id}
            projectName={project.name}
            onDelete={onDelete}
            onOpen={onOpen}
          />

          {/* Health score — only shown after analysis */}
          {score !== null && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              background: 'var(--bg-elevated)',
              border: `1px solid ${scoreColor(score)}40`,
              borderRadius: 8,
              padding: '4px 10px',
              minWidth: 52,
            }}>
              <span style={{
                fontSize: 16, fontWeight: 800,
                color: scoreColor(score),
                lineHeight: 1.2,
                fontFamily: 'var(--mono)',
              }}>
                {score}
              </span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                health
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 11 }}>
            <Clock size={11} />
            <span>{formatDistanceToNow(parseUTCDate(project.updated_at), { addSuffix: true })}</span>
          </div>

          <ArrowRight size={14} color="var(--text-muted)" />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    projectsApi.list().then(setProjects).finally(() => setLoading(false))
  }, [])

  const handleOpen = useCallback((id: string) => {
    navigate(`/projects/${id}/dashboard`)
  }, [navigate])

  const handleDeleteRequest = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name })
  }, [])

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await projectsApi.delete(deleteTarget.id)
      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success(`"${deleteTarget.name}" deleted`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget])

  return (
    <div className="page-body" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
        gap: 16,
        paddingTop: 4,
      }}>
        <div>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 4,
          }}>
            Workspace
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            All Projects
          </h1>
        </div>
        <button
          className="btn btn-primary"
          style={{ fontSize: 13, padding: '9px 18px' }}
          onClick={() => navigate('/projects/new')}
        >
          <Plus size={14} />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="loading-overlay">
          <span className="spinner spinner-lg" />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading projects…</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={44} style={{ marginBottom: 16 }} />
          <h3>No projects yet</h3>
          <p>Create your first modernization project to get started.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => navigate('/projects/new')}
          >
            <Plus size={14} />
            Create Project
          </button>
        </div>
      ) : (
        <div>
          {/* Count line */}
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={handleOpen}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          project={deleteTarget}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          deleting={deleting}
        />
      )}
    </div>
  )
}
