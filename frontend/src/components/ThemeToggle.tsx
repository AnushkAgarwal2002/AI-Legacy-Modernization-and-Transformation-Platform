import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useApp } from '../context/AppContext'

/**
 * ThemeToggle — a compact icon button that switches between dark and light mode.
 *
 * Renders a sun icon when in dark mode (click → go light)
 * and a moon icon when in light mode (click → go dark).
 *
 * Pass `variant="compact"` for the small sidebar version (just icon, no label).
 * Default renders icon + label for use in navbars / page headers.
 */
export default function ThemeToggle({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const { theme, toggleTheme } = useApp()
  const isDark = theme === 'dark'

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleTheme}
        className="btn-icon"
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Light mode' : 'Dark mode'}
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          border: '1px solid transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget
          el.style.background = 'var(--bg-elevated)'
          el.style.borderColor = 'var(--border)'
          el.style.color = 'var(--text)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.background = 'transparent'
          el.style.borderColor = 'transparent'
          el.style.color = 'var(--text-muted)'
        }}
      >
        {isDark
          ? <Sun  size={15} />
          : <Moon size={15} />
        }
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--sans)',
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s, transform 0.1s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget
        el.style.background = 'var(--bg-card)'
        el.style.borderColor = 'var(--accent-border)'
        el.style.color = 'var(--text)'
        el.style.boxShadow = 'var(--shadow-sm)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget
        el.style.background = 'var(--bg-elevated)'
        el.style.borderColor = 'var(--border)'
        el.style.color = 'var(--text-secondary)'
        el.style.boxShadow = 'none'
        el.style.transform = 'translateY(0)'
      }}
    >
      {isDark
        ? <><Sun  size={13} /> Light</>
        : <><Moon size={13} /> Dark</>
      }
    </button>
  )
}
