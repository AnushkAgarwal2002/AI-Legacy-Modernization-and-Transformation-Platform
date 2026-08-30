import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches any render-time exception thrown by a descendant component and
 * shows a recoverable error card instead of blanking the entire page.
 *
 * Without this, a single "Objects are not valid as a React child" or any
 * other render throw wipes the whole React tree until the user reloads.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        padding: 40,
        textAlign: 'center',
        gap: 16,
      }}>
        <div style={{ fontSize: 36, lineHeight: 1 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger, #F87171)' }}>
          Something went wrong rendering this page
        </div>
        <div style={{
          fontSize: 12,
          fontFamily: 'var(--mono, monospace)',
          color: '#93b4ff',
          background: '#111a2e',
          border: '1px solid #263550',
          borderRadius: 6,
          padding: '10px 16px',
          maxWidth: 620,
          wordBreak: 'break-word',
          textAlign: 'left',
          whiteSpace: 'pre-wrap',
        }}>
          {error.stack || error.message}
        </div>
        <button
          className="btn btn-sm"
          onClick={this.handleReset}
          style={{ marginTop: 4 }}
        >
          Try again
        </button>
      </div>
    )
  }
}
