import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from './context/AppContext'
import App from './App'
import './styles/global.css'

// ── Global error capture ─────────────────────────────────────────────────────
// Shows a visible overlay for ANY unhandled error or rejected promise so we
// can see exactly what is crashing the page (error boundaries only catch
// synchronous render errors; async/event-handler errors escape them entirely).
function _showCrashOverlay(msg: string, source: string) {
  // Don't double-stack overlays
  if (document.getElementById('_crash_overlay')) return
  const el = document.createElement('div')
  el.id = '_crash_overlay'
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:rgba(10,15,28,0.97)',
    'color:#f1f5f9', 'font-family:monospace', 'font-size:13px',
    'padding:40px', 'overflow:auto', 'white-space:pre-wrap',
    'display:flex', 'flex-direction:column', 'gap:16px',
  ].join(';')
  el.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:#f87171">⚠ Unhandled ${source}</div>
    <div style="color:#fcd34d;font-size:12px">Copy this message and report it:</div>
    <div style="background:#111a2e;border:1px solid #263550;border-radius:6px;padding:16px;color:#93b4ff">${
      msg.replace(/</g, '&lt;')
    }</div>
    <button onclick="document.getElementById('_crash_overlay').remove()"
      style="align-self:flex-start;padding:8px 18px;background:#3b82d4;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
      Dismiss
    </button>`
  document.body.appendChild(el)
}

window.onerror = (message, source, lineno, colno, error) => {
  const detail = error?.stack || `${message}\n  at ${source}:${lineno}:${colno}`
  console.error('[GlobalError]', detail)
  _showCrashOverlay(detail, 'Error')
  return false // let default handling continue
}

window.addEventListener('unhandledrejection', (ev) => {
  const detail = ev.reason?.stack || String(ev.reason)
  console.error('[UnhandledRejection]', detail)
  _showCrashOverlay(detail, 'Promise Rejection')
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#17223A',
              color: '#F1F5F9',
              border: '1px solid #263550',
              fontSize: '13px',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            },
            success: { iconTheme: { primary: '#34D399', secondary: '#17223A' } },
            error: { iconTheme: { primary: '#F87171', secondary: '#17223A' } },
          }}
        />
      </AppProvider>
    </QueryClientProvider>
  </BrowserRouter>
)
