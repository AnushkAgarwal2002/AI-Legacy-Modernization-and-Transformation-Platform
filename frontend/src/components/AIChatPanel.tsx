import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Loader, Trash2, ChevronDown, ExternalLink } from 'lucide-react'
import { chatApi } from '../api/client'
import { useApp } from '../context/AppContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  context_file?: string
}

interface Props {
  contextFile?: string
  contextType?: string
  suggestedQuestions?: string[]
}

export default function AIChatPanel({ contextFile, contextType, suggestedQuestions }: Props) {
  const { currentProject } = useApp()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && !loaded && currentProject) {
      chatApi.history(currentProject.id).then(msgs => {
        setMessages(msgs.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          context_file: m.context_file,
        })))
        setLoaded(true)
      }).catch(() => setLoaded(true))
    }
  }, [open, currentProject])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (msg?: string) => {
    const text = msg || input.trim()
    if (!text || !currentProject) return
    setInput('')
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      context_file: contextFile,
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    try {
      const res = await chatApi.send(currentProject.id, text, contextFile, contextType)
      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'a',
        role: 'assistant',
        content: res.response,
      }])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + 'e',
        role: 'assistant',
        content: `Error: ${e.response?.data?.detail || e.message || 'Failed to get response'}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const clear = async () => {
    if (!currentProject) return
    await chatApi.clear(currentProject.id).catch(() => {})
    setMessages([])
  }

  if (!currentProject) return null

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
            zIndex: 500,
            transition: 'all 0.2s',
          }}
          title="Ask AI about this project"
        >
          <MessageSquare size={22} />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 400,
          height: 560,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)',
            borderRadius: '12px 12px 0 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 600 }}>AI Assistant</span>
              {contextFile && (
                <span style={{
                  fontSize: 11,
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}>
                  {contextFile.split('/').pop()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={clear} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} title="Clear history">
                <Trash2 size={14} />
              </button>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 20 }}>
                <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                <p>Ask anything about this project's legacy code, architecture, or modernization approach.</p>
                {suggestedQuestions && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {suggestedQuestions.map(q => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  maxWidth: '85%',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {m.role === 'user' ? (
                  <div style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    borderRadius: '12px 12px 2px 12px',
                    padding: '8px 12px',
                    fontSize: 13,
                  }}>
                    {m.content}
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '2px 12px 12px 12px',
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'var(--text)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}>
                    {m.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '2px 12px 12px 12px',
                  padding: '10px 16px',
                  display: 'flex',
                  gap: 4,
                }}>
                  {[0, 150, 300].map(d => (
                    <div key={d} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--text-muted)',
                      animation: `pulse 1s ${d}ms infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
          }}>
            <input
              className="form-input"
              placeholder="Ask about this project..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              style={{ flex: 1 }}
              disabled={loading}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => send()}
              disabled={loading || !input.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
