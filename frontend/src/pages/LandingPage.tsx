import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, GitBranch, ListChecks, Code2, ShieldCheck, FileText,
  ArrowRight, Cpu, Layers, Zap, Database, CheckCircle, ChevronRight,
  BarChart3, GitMerge, Activity,
} from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

// ─── Animated modernization flow ─────────────────────────────────────────────
const FLOW_STEPS = [
  { label: 'Legacy Application', sub: 'COBOL · Java EE · PHP · VB.NET', color: '#EF4444', icon: Database },
  { label: 'AI Analysis',        sub: 'Structure · Dependencies · Debt', color: '#F59E0B', icon: Search },
  { label: 'Architecture Map',   sub: 'Patterns · Components · Issues',  color: '#8B5CF6', icon: GitBranch },
  { label: 'Modernization Plan', sub: 'Prioritized tasks · Timelines',   color: '#5B7EFF', icon: ListChecks },
  { label: 'Code Transformation',sub: 'Before / After · AI proposals',  color: '#3B82F6', icon: Code2 },
  { label: 'Validation',         sub: 'Review · Analysis · Sign-off',    color: '#22C55E', icon: ShieldCheck },
]

function ModernizationFlow() {
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % FLOW_STEPS.length), 1800)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: 300 }}>
      {FLOW_STEPS.map((step, i) => {
        const Icon = step.icon
        const isActive = i === activeStep
        const isPast   = i < activeStep
        return (
          <React.Fragment key={step.label}>
            <div
              onClick={() => setActiveStep(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 8,
                border: `1px solid ${isActive ? step.color + '50' : 'rgba(42,49,71,0.7)'}`,
                background: isActive
                  ? `${step.color}0F`
                  : isPast
                  ? 'rgba(91,126,255,0.03)'
                  : 'rgba(26,30,42,0.6)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: isActive ? 'translateX(4px)' : 'none',
                boxShadow: isActive ? `0 4px 20px ${step.color}20` : 'none',
              }}
            >
              <div style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: isActive ? `${step.color}20` : 'var(--bg-elevated)',
                border: `1px solid ${isActive ? step.color + '40' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                flexShrink: 0,
              }}>
                <Icon size={13} color={isActive ? step.color : 'var(--text-muted)'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600,
                  color: isActive ? step.color : isPast ? 'var(--text-secondary)' : 'var(--text-muted)',
                  transition: 'color 0.3s ease',
                }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, letterSpacing: '0.02em' }}>
                  {step.sub}
                </div>
              </div>
              {isActive && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.color, flexShrink: 0 }} />
              )}
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <div style={{
                width: 1, height: 10,
                background: `linear-gradient(180deg, ${FLOW_STEPS[i].color}30, ${FLOW_STEPS[i+1].color}30)`,
                marginLeft: 28,
                transition: 'background 0.3s ease',
              }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── Features ──────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Search,
    title: 'Legacy Analysis',
    desc: 'Analyze application structure, technology stack, dependencies, technical debt, and architectural issues.',
    color: '#5B7EFF',
  },
  {
    icon: GitBranch,
    title: 'Architecture Intelligence',
    desc: 'Understand the current system and explore AI-assisted target architecture recommendations.',
    color: '#8B5CF6',
  },
  {
    icon: ListChecks,
    title: 'Modernization Planning',
    desc: 'Convert analysis findings into prioritized modernization and migration tasks with complexity ratings.',
    color: '#3B82F6',
  },
  {
    icon: Code2,
    title: 'Assisted Transformation',
    desc: 'IBM Bob assists with refactoring and modernizing legacy code with clear before/after comparisons.',
    color: '#F59E0B',
  },
  {
    icon: ShieldCheck,
    title: 'Validation',
    desc: 'Review transformation results, identify AI-detected issues, and flag items requiring manual review.',
    color: '#22C55E',
  },
  {
    icon: FileText,
    title: 'Modernization Reports',
    desc: 'Generate structured executive reports covering technology inventory, architecture, risks, and migration plan.',
    color: '#EF4444',
  },
]

// ─── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  { num: '01', title: 'Import',    desc: 'Provide your legacy application source files or upload a zip archive.' },
  { num: '02', title: 'Analyze',   desc: 'IBM Bob examines technology stack, architecture, dependencies, and technical debt.' },
  { num: '03', title: 'Plan',      desc: 'Identify architectural risks and prioritized modernization opportunities.' },
  { num: '04', title: 'Transform', desc: 'AI-assisted proposals refactor and modernize legacy code with detailed diffs.' },
  { num: '05', title: 'Validate',  desc: 'Review transformations, check for issues, and generate a complete report.' },
]

// ─── Enterprise pillars ────────────────────────────────────────────────────────
const PILLARS = [
  { icon: BarChart3, title: 'Understand first', desc: 'Deep analysis before any changes — never blind migrations.' },
  { icon: CheckCircle, title: 'Developer-reviewed', desc: 'Every AI suggestion requires human sign-off and testing.' },
  { icon: GitMerge, title: 'Architecture-aware', desc: 'Recommendations grounded in real system context.' },
  { icon: Activity, title: 'Transparent process', desc: 'Rationale and evidence provided for every finding.' },
]

// ─── FeatureCard with hover state ─────────────────────────────────────────────
function FeatureCard({ feat, delay }: { feat: typeof FEATURES[0], delay: number }) {
  const [hovered, setHovered] = useState(false)
  const Icon = feat.icon
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-elevated)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? feat.color + '40' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '22px 24px',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? `0 8px 28px ${feat.color}15` : 'none',
        cursor: 'default',
        animation: `fadeInUp 0.4s ease ${delay}ms both`,
      }}
    >
      <div style={{
        width: 40, height: 40,
        background: hovered ? `${feat.color}20` : 'var(--bg-elevated)',
        border: `1px solid ${hovered ? feat.color + '40' : 'var(--border)'}`,
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
        transition: 'all 0.25s ease',
      }}>
        <Icon size={18} color={feat.color} />
      </div>
      <div style={{
        fontSize: 14, fontWeight: 700,
        color: 'var(--text)',
        marginBottom: 8,
        letterSpacing: '-0.01em',
        transition: 'color 0.2s ease',
      }}>
        {feat.title}
      </div>
      <div style={{
        fontSize: 13, color: 'var(--text-secondary)',
        lineHeight: 1.65,
      }}>
        {feat.desc}
      </div>
    </div>
  )
}

// ─── PillarCard ────────────────────────────────────────────────────────────────
function PillarCard({ pillar, delay }: { pillar: typeof PILLARS[0], delay: number }) {
  const [hovered, setHovered] = useState(false)
  const Icon = pillar.icon
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--bg-elevated)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent-border)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '20px 22px',
        transition: 'all 0.22s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        animation: `fadeInUp 0.4s ease ${delay}ms both`,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
      }}>
        <Icon size={16} color={hovered ? 'var(--accent)' : 'var(--text-muted)'} style={{ transition: 'color 0.2s ease' }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          {pillar.title}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {pillar.desc}
      </div>
    </div>
  )
}

// ─── Main landing page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--sans)',
      overflowX: 'hidden',
    }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(12px)',
        padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 12px rgba(91,126,255,0.35)',
          }}>
            <Cpu size={18} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
              ModernIQ
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 1 }}>
              AI-Assisted Legacy Modernization
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>
            All Projects
          </button>
          <ThemeToggle />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/projects/new')}
          >
            <Zap size={13} />
            Start Modernizing
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{
        padding: '96px 40px 80px',
        maxWidth: 1160,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 72,
        alignItems: 'center',
      }}>
        {/* Left */}
        <div style={{ animation: 'fadeInUp 0.5s ease both' }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--ai-dim)',
            border: '1px solid var(--ai-border)',
            borderRadius: 20,
            padding: '5px 14px',
            fontSize: 11, fontWeight: 700,
            color: 'var(--ai)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ai)', animation: 'dotPulse 2s ease-in-out infinite' }} />
            AI-Assisted Modernization Platform
          </div>

          {/* Product name */}
          <div style={{
            fontSize: 'clamp(52px, 7vw, 80px)',
            fontWeight: 900,
            letterSpacing: '-0.05em',
            lineHeight: 1,
            marginBottom: 12,
            color: 'var(--accent)',
            background: 'linear-gradient(135deg, #5B7EFF, #8B5CF6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            ModernIQ
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(20px, 2.8vw, 34px)',
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            marginBottom: 20,
          }}>
            Modernize legacy software<br />with engineering intelligence
          </h1>

          {/* Sub */}
          <p style={{
            fontSize: 16, color: 'var(--text-secondary)',
            lineHeight: 1.75, maxWidth: 520, marginBottom: 36,
          }}>
            Understand legacy applications, identify technical debt, analyze architecture, plan
            modernization, transform code, and validate changes — all in one structured platform.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 36 }}>
            <button
              className="btn btn-primary"
              style={{ fontSize: 14, padding: '11px 22px', borderRadius: 8 }}
              onClick={() => navigate('/projects/new')}
            >
              <Zap size={15} />
              Start Modernizing
            </button>
            <button
              className="btn"
              style={{ fontSize: 14, padding: '11px 22px', borderRadius: 8 }}
              onClick={() => navigate('/projects')}
            >
              View Projects
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Trust marks */}
          <div style={{
            display: 'flex', gap: 20, flexWrap: 'wrap',
            paddingTop: 24, borderTop: '1px solid var(--border)',
          }}>
            {[
              'AI-assisted analysis',
              'Developer-reviewed changes',
              'Architecture-aware',
            ].map(label => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={13} color="var(--success)" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — animated flow */}
        <div style={{ animation: 'fadeInUp 0.6s ease 0.1s both', flexShrink: 0 }}>
          <ModernizationFlow />
        </div>
      </section>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="landing-section-divider" />

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section style={{
        padding: '72px 40px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, animation: 'fadeInUp 0.4s ease both' }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}>
              Platform Capabilities
            </div>
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 32px)',
              fontWeight: 800, letterSpacing: '-0.025em',
              color: 'var(--text)', marginBottom: 12,
            }}>
              Everything you need for legacy modernization
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
              A structured workflow from understanding legacy systems to producing validated modernization proposals.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 14,
          }}>
            {FEATURES.map((feat, i) => (
              <FeatureCard key={feat.title} feat={feat} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52, animation: 'fadeInUp 0.4s ease both' }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}>
              How It Works
            </div>
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 32px)',
              fontWeight: 800, letterSpacing: '-0.025em',
              color: 'var(--text)',
            }}>
              A structured five-step process
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 0,
            position: 'relative',
          }}>
            {/* Connecting line */}
            <div style={{
              position: 'absolute',
              top: 22, left: '10%', right: '10%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, var(--border), var(--border), var(--border), transparent)',
              zIndex: 0,
            }} />

            {STEPS.map((step, i) => (
              <div
                key={step.num}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textAlign: 'center', padding: '0 16px', position: 'relative', zIndex: 1,
                  animation: `fadeInUp 0.4s ease ${i * 80}ms both`,
                }}
              >
                <div style={{
                  width: 44, height: 44,
                  borderRadius: '50%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                  fontSize: 12, fontWeight: 800,
                  color: 'var(--accent)',
                  letterSpacing: '-0.02em',
                  fontFeatureSettings: "'tnum'",
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  {step.num}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.01em' }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Enterprise/Trust ──────────────────────────────────────────────── */}
      <section style={{
        padding: '72px 40px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, animation: 'fadeInUp 0.4s ease both' }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}>
              Built for Engineering Teams
            </div>
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 32px)',
              fontWeight: 800, letterSpacing: '-0.025em',
              color: 'var(--text)', marginBottom: 14,
            }}>
              Designed with rigor and transparency
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
              Every recommendation is grounded in your actual codebase. No speculation — evidence-based analysis only.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 14,
          }}>
            {PILLARS.map((p, i) => (
              <PillarCard key={p.title} pillar={p} delay={i * 60} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section style={{ padding: '72px 40px' }}>
        <div style={{
          maxWidth: 720, margin: '0 auto',
          textAlign: 'center',
          animation: 'fadeInUp 0.5s ease both',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '48px 40px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Subtle gradient accent top */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: 'linear-gradient(90deg, transparent, var(--accent), var(--purple), transparent)',
            }} />
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
            }}>
              Get started
            </div>
            <h2 style={{
              fontSize: 'clamp(22px, 3vw, 30px)',
              fontWeight: 800, letterSpacing: '-0.025em',
              color: 'var(--text)', marginBottom: 14,
            }}>
              Start your modernization journey
            </h2>
            <p style={{
              color: 'var(--text-secondary)', fontSize: 14,
              lineHeight: 1.7, marginBottom: 32, maxWidth: 440, margin: '0 auto 32px',
            }}>
              Import your legacy application, let ModernIQ analyze it, and receive a detailed modernization roadmap in minutes.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 14, padding: '11px 24px', borderRadius: 8 }}
                onClick={() => navigate('/projects/new')}
              >
                <Zap size={15} />
                Start Modernizing
              </button>
              <button
                className="btn"
                style={{ fontSize: 14, padding: '11px 24px', borderRadius: 8 }}
                onClick={() => navigate('/projects')}
              >
                View Projects
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '32px 40px',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{
          maxWidth: 1160, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 20, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28,
              background: 'var(--accent)',
              borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={14} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' }}>
                ModernIQ
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>
                AI-Assisted Legacy Modernization
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Projects', path: '/projects' },
              { label: 'New Project', path: '/projects/new' },
              { label: 'API Docs', path: 'http://localhost:8000/docs', external: true },
            ].map(link => (
              <button
                key={link.label}
                className="btn-ghost"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'var(--text-muted)',
                  fontFamily: 'var(--sans)', padding: '4px 0',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                onClick={() => link.external
                  ? window.open(link.path, '_blank')
                  : navigate(link.path)
                }
              >
                {link.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Built for the IBM Bob Hackathon · ModernIQ
          </div>
        </div>
      </footer>

      {/* Global keyframe injection for landing page animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  )
}
