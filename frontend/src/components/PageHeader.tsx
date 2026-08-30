import React from 'react'
import { Cpu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
  children: React.ReactNode
}

/**
 * Shared page header bar used by every workspace page.
 * Renders the ModernIQ brand mark on the left, then the page-specific
 * content (title + action buttons) on the right via children.
 */
export default function PageHeader({ children }: Props) {
  const navigate = useNavigate()

  return (
    <div className="page-header">
      {/* Brand mark — always visible, navigates home on click */}
      <div
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          cursor: 'pointer', flexShrink: 0,
          paddingRight: 18,
          borderRight: '1px solid var(--border)',
          userSelect: 'none',
        }}
        title="Go to ModernIQ home"
      >
        <div style={{
          width: 28, height: 28,
          background: 'var(--accent)',
          borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Cpu size={14} color="white" />
        </div>
        <div>
          <div style={{
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
          }}>
            ModernIQ
          </div>
          <div style={{
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            AI Modernization
          </div>
        </div>
      </div>

      {/* Page-specific content */}
      {children}
    </div>
  )
}
