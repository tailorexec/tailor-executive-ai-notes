import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Mic,
  FileText,
  BarChart3,
  Share2,
  Headphones,
  MessageSquare,
  Plus,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Spinner } from '../components/ui'
import { config } from '../lib/config'

const FEATURES = [
  { icon: <Mic size={18} />, title: 'Transcrição automática', desc: 'Reuniões, áudios e ligações viram texto com precisão.' },
  { icon: <FileText size={18} />, title: 'Resumo inteligente', desc: 'Resumo rápido e um detalhado sob demanda, com IA.' },
  { icon: <BarChart3 size={18} />, title: 'Análise de reunião', desc: 'Tom, perguntas, ritmo e sugestões para evoluir.' },
  { icon: <Headphones size={18} />, title: 'Gravar reunião', desc: 'Capta o áudio da reunião + seu microfone (desktop).' },
  { icon: <Share2 size={18} />, title: 'Compartilhamento', desc: 'WhatsApp, PDF, Word, e-mail e com parceiros.' },
  { icon: <MessageSquare size={18} />, title: 'Converse com a nota', desc: 'Pergunte à IA e gere narração por voz.' },
]

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isDesktop
}

function VideoBackground() {
  // Enfeite bem sutil, so no desktop (nao baixa no mobile), sem travar a pagina.
  return (
    <video
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full object-cover opacity-[0.18]"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    >
      <source src="/tailor_loop.mp4" type="video/mp4" />
    </video>
  )
}

function TechBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Blobs vermelhos suaves */}
      <div
        className="absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full blur-3xl opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(241,12,39,0.45), transparent 60%)' }}
      />
      <div
        className="absolute -bottom-48 -left-40 h-[34rem] w-[34rem] rounded-full blur-3xl opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(148,16,16,0.5), transparent 60%)' }}
      />
      {/* Grade tecnologica com fade */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(135,134,132,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(135,134,132,0.6) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      {/* Aneis concentricos sutis */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[52rem] w-[52rem] rounded-full border border-surface-border/40" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[38rem] w-[38rem] rounded-full border border-surface-border/30" />
    </div>
  )
}

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  const isDesktop = useIsDesktop()

  return (
    <div className="min-h-screen flex flex-col safe-top">
      {isDesktop && <VideoBackground />}
      <TechBackground />

      <header className="flex items-center justify-between px-6 pt-6">
        <Logo size="sm" showTagline />
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-10 w-full max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center max-w-2xl">
          <div className="inline-flex flex-col items-center text-brand-500 bg-brand-500/10 border border-brand-500/20 rounded-2xl px-4 py-2 mb-5 leading-tight">
            <span className="font-display font-bold tracking-[0.2em] text-lg">TENA</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide">Tailor Executive Notes AI</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
            Ferramenta Inteligente para Executivos
          </h1>
          <p className="text-content-secondary mt-4 text-lg">
            Grave, transcreva e transforme reuniões em decisões. A IA resume, analisa e organiza
            suas conversas — pensada para o dia a dia de quem lidera.
          </p>
        </div>

        {/* Conteudo: funcionalidades + login */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start w-full mt-12">
          {/* Funcionalidades */}
          <div className="order-2 lg:order-1">
            <h2 className="font-display text-lg font-semibold mb-4">O que a plataforma faz</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="card p-4 flex gap-3">
                  <div className="grid place-items-center h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{f.title}</p>
                    <p className="text-content-muted text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
              <div className="card p-4 flex items-center gap-3 border-dashed">
                <div className="grid place-items-center h-9 w-9 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                  <Plus size={18} />
                </div>
                <p className="font-medium text-sm">e muito mais</p>
              </div>
            </div>
          </div>

          {/* Login */}
          <div className="order-1 lg:order-2 w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="card p-6 sm:p-8 shadow-float">
              <h2 className="font-display text-2xl font-bold">Entrar</h2>
              <p className="text-content-secondary mt-1 mb-6">Acesse sua conta corporativa.</p>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">E-mail corporativo</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="input"
                    placeholder={`nome@${config.allowedDomain}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="password">Senha</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={show ? 'text' : 'password'}
                      autoComplete="current-password"
                      className="input pr-12"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
                      aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                  {loading ? <Spinner /> : 'Entrar'}
                </button>
              </form>

              <p className="text-center text-content-secondary mt-6">
                Não tem conta?{' '}
                <Link to="/cadastro" className="text-brand-500 font-medium hover:underline">
                  Criar conta
                </Link>
              </p>

              {config.mockMode && (
                <div className="mt-6 text-xs text-content-muted bg-surface-elevated border border-surface-border rounded-xl p-4">
                  <p className="font-medium text-content-secondary mb-1">Modo demonstração (sem backend)</p>
                  <p>Admin: {config.adminEmail} / Tailor@007</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-6 text-sm text-content-muted">
        <a
          href="https://tailorexec.com.br"
          target="_blank"
          rel="noreferrer"
          className="hover:text-brand-500 transition-colors"
        >
          tailorexec.com.br
        </a>
      </footer>
    </div>
  )
}
