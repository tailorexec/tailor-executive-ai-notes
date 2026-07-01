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
  Phone,
  Plus,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
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
  { icon: <Phone size={18} />, title: 'Transcrições de ligações telefônicas', desc: 'Suas ligações viram texto e resumo automaticamente.' },
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
      className="pointer-events-none fixed inset-0 -z-20 h-full w-full object-cover brightness-110 dark:brightness-[1.75] dark:contrast-125 dark:saturate-150"
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
  const { theme } = useTheme()

  return (
    <div className="min-h-screen lg:h-screen flex flex-col safe-top lg:overflow-hidden">
      {/* Video (escuro) so no desktop + tema escuro; no claro/mobile usa o fundo tecnologico */}
      {isDesktop && theme === 'dark' ? <VideoBackground /> : <TechBackground />}

      <header className="flex items-center justify-between px-6 pt-6 md:pt-4 md:shrink-0">
        {/* Smaller logo on the login page to match the compact ThemeToggle */}
        <Logo size="sm" />
        <ThemeToggle />
      </header>

      <main className="flex-1 min-h-0 flex flex-col items-center lg:justify-center px-6 py-10 md:py-4 lg:py-5 w-full max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center max-w-2xl">
          <h1 className="font-display text-4xl sm:text-5xl md:text-3xl lg:text-4xl font-bold leading-tight dark:[text-shadow:0_2px_14px_rgba(0,0,0,0.55)]">
            Ferramenta Inteligente para Executivos
          </h1>
          <p className="text-content-secondary mt-4 md:mt-2 text-lg md:text-sm lg:text-base dark:[text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
            Grave, transcreva e transforme reuniões em decisões. A IA resume, analisa e organiza
            suas conversas — pensada para o dia a dia de quem lidera.
          </p>
        </div>

        {/* Conteudo: funcionalidades + login */}
        <div className="grid lg:grid-cols-2 gap-8 md:gap-5 lg:gap-8 lg:items-stretch w-full max-w-4xl mx-auto mt-10 md:mt-6">
          {/* Funcionalidades */}
          <div className="order-2 lg:order-1">
            <h2 className="font-display text-lg md:text-base font-semibold mb-4 md:mb-3">O que a plataforma faz</h2>
            <div className="grid sm:grid-cols-2 gap-3 md:gap-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="card p-4 md:p-3 flex gap-3 md:gap-2">
                  <div className="grid place-items-center h-9 w-9 md:h-8 md:w-8 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{f.title}</p>
                    <p className="text-content-muted text-xs mt-0.5 leading-relaxed md:leading-snug">{f.desc}</p>
                  </div>
                </div>
              ))}
              <div className="card p-4 md:p-3 flex items-center gap-3 md:gap-2 border-dashed">
                <div className="grid place-items-center h-9 w-9 md:h-8 md:w-8 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                  <Plus size={18} />
                </div>
                <p className="font-medium text-sm">Feedbacks e muito mais</p>
              </div>
            </div>
          </div>

          {/* Login */}
          <div className="order-1 lg:order-2 w-full max-w-md mx-auto h-full">
            <div className="card p-6 sm:p-8 md:p-6 shadow-float h-full flex flex-col justify-center">
              <h2 className="font-display text-2xl font-bold">Entrar</h2>
              <p className="text-content-secondary mt-1 mb-6 md:mb-4">Acesse sua conta corporativa.</p>

              {config.mockMode && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-medium">Modo demonstração ativo.</p>
                  <p className="mt-1">
                    Este ambiente não está usando o Supabase real. Para entrar com a conta corporativa,
                    defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no Vercel ou no ambiente de deploy.
                  </p>
                </div>
              )}

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

      <footer className="text-center py-6 md:py-3 text-sm text-content-muted md:shrink-0">
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
