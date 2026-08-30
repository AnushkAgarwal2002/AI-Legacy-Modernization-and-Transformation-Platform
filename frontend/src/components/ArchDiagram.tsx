import React, { useEffect, useRef, useState } from 'react'

interface Node {
  id: string
  label: string
  type: string
  description?: string
}

interface Edge {
  source: string
  target: string
  label?: string
  type?: string
}

interface Props {
  nodes: Node[]
  edges: Edge[]
  title?: string
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  entrypoint:  { bg: '#0d1e3a', border: '#4F7CFF', text: '#93B4FF' },
  controller:  { bg: '#0d2418', border: '#34D399', text: '#6EE7B7' },
  service:     { bg: '#1a1238', border: '#818CF8', text: '#A5B4FC' },
  model:       { bg: '#241a00', border: '#FBBF24', text: '#FCD34D' },
  database:    { bg: '#2a0f0f', border: '#F87171', text: '#FCA5A5' },
  config:      { bg: '#111A2E', border: '#475569', text: '#64748B' },
  external:    { bg: '#0d1e30', border: '#22D3EE', text: '#67E8F9' },
  frontend:    { bg: '#0d2418', border: '#34D399', text: '#6EE7B7' },
  backend:     { bg: '#0d1e3a', border: '#4F7CFF', text: '#93B4FF' },
  util:        { bg: '#17223A', border: '#475569', text: '#64748B' },
  api:         { bg: '#0d2418', border: '#34D399', text: '#6EE7B7' },
  repository:  { bg: '#1a1238', border: '#818CF8', text: '#A5B4FC' },
  event:       { bg: '#241500', border: '#fb923c', text: '#fdba74' },
}

const DEFAULT_COLOR = { bg: '#111A2E', border: '#263550', text: '#64748B' }

function getNodePos(nodes: Node[], width: number, height: number) {
  const positions: Record<string, { x: number; y: number }> = {}
  const count = nodes.length
  const padding = 100
  const cw = width - padding * 2
  const ch = height - padding * 2

  // Simple force-directed-ish circular layout
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    const rx = cw / 2
    const ry = ch / 2
    positions[n.id] = {
      x: padding + rx + rx * 0.75 * Math.cos(angle),
      y: padding + ry + ry * 0.7 * Math.sin(angle),
    }
  })

  // Push database nodes to bottom
  nodes.forEach(n => {
    if (n.type === 'database') {
      positions[n.id].y = height - 60
      positions[n.id].x = width / 2
    }
    if (n.type === 'entrypoint') {
      positions[n.id].y = 60
      positions[n.id].x = width / 2
    }
  })

  return positions
}

/** Coerce any value to a safe non-empty string, guarding against null / object nodes from AI. */
function safeStr(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  if (typeof v === 'string') return v
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return String(o.name ?? o.label ?? o.title ?? o.id ?? fallback)
  }
  return String(v)
}

export default function ArchDiagram({ nodes: rawNodes, edges: rawEdges, title }: Props) {
  // Normalise nodes — guard against null labels / ids that crash .length / map key lookups
  const nodes: Node[] = (rawNodes || [])
    .filter(n => n != null)
    .map((n, i) => ({
      id:          safeStr(n.id, `node-${i}`),
      label:       safeStr(n.label, `Node ${i + 1}`),
      type:        safeStr(n.type, 'util'),
      description: n.description != null ? safeStr(n.description) : undefined,
    }))

  // Normalise edges — guard against null source/target
  const edges: Edge[] = (rawEdges || [])
    .filter(e => e != null && e.source != null && e.target != null)
    .map(e => ({
      source: safeStr(e.source),
      target: safeStr(e.target),
      label:  e.label != null ? safeStr(e.label) : undefined,
      type:   e.type  != null ? safeStr(e.type)  : undefined,
    }))

  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 500 })
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: Node } | null>(null)

  useEffect(() => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      if (rect.width > 0) setDims({ w: rect.width, h: Math.max(400, rect.width * 0.55) })
    }
  }, [])

  if (nodes.length === 0) {
    return (
      <div className="empty-state" style={{ minHeight: 200 }}>
        <p>No architecture data available</p>
      </div>
    )
  }

  const positions = getNodePos(nodes, dims.w, dims.h)
  const NODE_W = 140
  const NODE_H = 46

  return (
    <div style={{ position: 'relative' }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
          {title}
        </div>
      )}
      <svg
        ref={svgRef}
        width="100%"
        height={dims.h}
        style={{ background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6e7681" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const src = positions[e.source]
          const tgt = positions[e.target]
          if (!src || !tgt) return null
          const dx = tgt.x - src.x
          const dy = tgt.y - src.y
          const len = Math.sqrt(dx * dx + dy * dy)
          // Skip zero-length edges (self-loops) — dividing by 0 produces NaN
          if (len === 0) return null
          const ux = dx / len
          const uy = dy / len
          const mx = (src.x + tgt.x) / 2
          const my = (src.y + tgt.y) / 2

          // Offset endpoints to node edges
          const sx = src.x + ux * (NODE_W / 2)
          const sy = src.y + uy * (NODE_H / 2)
          const tx = tgt.x - ux * (NODE_W / 2)
          const ty = tgt.y - uy * (NODE_H / 2)

          return (
            <g key={i}>
              <line
                x1={sx} y1={sy} x2={tx} y2={ty}
                stroke="#263550"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              {e.label && (
                <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill="#64748B">{e.label}</text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const pos = positions[n.id]
          if (!pos) return null
          const colors = TYPE_COLORS[n.type] || DEFAULT_COLOR
          return (
            <g
              key={n.id}
              transform={`translate(${pos.x - NODE_W / 2}, ${pos.y - NODE_H / 2})`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => setTooltip({ x: pos.x, y: pos.y - NODE_H / 2 - 10, node: n })}
              onMouseLeave={() => setTooltip(null)}
            >
              <rect
                width={NODE_W} height={NODE_H}
                rx={6} ry={6}
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={1.5}
              />
              <text
                x={NODE_W / 2} y={16}
                textAnchor="middle"
                fontSize={11}
                fontWeight="600"
                fill={colors.text}
              >
                {n.label.length > 16 ? n.label.slice(0, 14) + '…' : n.label}
              </text>
              <text
                x={NODE_W / 2} y={30}
                textAnchor="middle"
                fontSize={9}
                fill={colors.border}
                opacity={0.8}
              >
                {n.type}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          transform: 'translateX(-50%) translateY(-100%)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          maxWidth: 220,
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{tooltip.node.label}</div>
          <div style={{ color: 'var(--accent)', marginBottom: 4 }}>{tooltip.node.type}</div>
          {tooltip.node.description && (
            <div style={{ color: 'var(--text-secondary)' }}>{tooltip.node.description}</div>
          )}
        </div>
      )}
    </div>
  )
}
