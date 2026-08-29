import React from 'react'

interface Props {
  score: number
  label: string
  rationale?: string
}

function getColor(score: number) {
  if (score >= 70) return 'var(--success)'
  if (score >= 45) return 'var(--warning)'
  return 'var(--danger)'
}

export default function ScoreBar({ score, label, rationale }: Props) {
  const color = getColor(score)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{score}/100</span>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: color }}
        />
      </div>
      {rationale && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {rationale}
        </div>
      )}
    </div>
  )
}
