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
  Mail,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useT } from '../lib/i18n'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Spinner, Sheet } from '../components/ui'
import { config } from '../lib/config'

const FEATURES = [
  { icon: <Mic size={18} />, k: 'f1' },
  { icon: <FileText size={18} />, k: 'f2' },
  { icon: <BarChart3 size={18} />, k: 'f3' },
  { icon: <Headphones size={18} />, k: 'f4' },
  { icon: <Share2 size={18} />, k: 'f5' },
  { icon: <MessageSquare size={18} />, k: 'f6' },
  { icon: <Phone size={18} />, k: 'f7' },
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
    <>
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
      {/* Vel para manter texto legivel (mais forte no claro). */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-surface-bg/70 dark:bg-black/25" aria-hidden />
    </>
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
  const [loginOpen, setLoginOpen] = useState(false)

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
  const t = useT()

  return (
    <div className="min-h-screen flex flex-col safe-top">
      {/* Video de fundo no desktop (claro e escuro); no mobile usa o fundo tecnologico */}
      {isDesktop ? <VideoBackground /> : <TechBackground />}

      <header className="flex items-center justify-end px-6 pt-6 md:pt-4 md:shrink-0">
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-8 md:py-6 w-full max-w-4xl mx-auto">
        {/* Logo centralizada, perto do titulo */}
        <Logo size="md" heightClass="h-[53px] md:h-[58px]" className="mb-5" />

        {/* Hero */}
        <div className="text-center max-w-2xl">
          <h1 className="font-display text-4xl sm:text-5xl md:text-4xl font-bold leading-tight dark:[text-shadow:0_2px_14px_rgba(0,0,0,0.55)]">
            {t('login.heroTitle')}
          </h1>
          <p className="text-content-secondary mt-4 md:mt-3 text-lg md:text-base dark:[text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
            {t('login.heroSub')}
          </p>
        </div>

        {/* Card: Entrar com e-mail (abre o popup de login) */}
        <button
          onClick={() => setLoginOpen(true)}
          className="card w-full max-w-sm mx-auto mt-8 p-4 flex items-center justify-center gap-3 shadow-float hover:shadow-hover transition-shadow"
        >
          <span className="grid place-items-center h-9 w-9 rounded-xl bg-accent/10 text-accent shrink-0">
            <Mail size={18} />
          </span>
          <span className="font-semibold">{t('login.signinEmail')}</span>
        </button>

        <p className="text-center text-content-secondary mt-4">
          {t('login.noAccount')}{' '}
          <Link to="/cadastro" className="text-accent font-medium hover:underline">
            {t('login.createAccount')}
          </Link>
        </p>

        {/* O que a plataforma faz — centralizado */}
        <div className="w-full max-w-3xl mx-auto mt-12 text-center">
          <h2 className="font-display text-lg md:text-xl font-semibold mb-5">{t('login.whatItDoes')}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f) => (
              <div key={f.k} className="card p-4 flex gap-3 text-left">
                <div className="grid place-items-center h-9 w-9 rounded-xl bg-accent/10 text-accent shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="font-medium text-sm">{t(`login.${f.k}t`)}</p>
                  <p className="text-content-muted text-xs mt-0.5 leading-relaxed">{t(`login.${f.k}d`)}</p>
                </div>
              </div>
            ))}
            <div className="card p-4 flex items-center gap-3 border-dashed">
              <div className="grid place-items-center h-9 w-9 rounded-xl bg-accent/10 text-accent shrink-0">
                <Plus size={18} />
              </div>
              <p className="font-medium text-sm text-left">{t('login.more')}</p>
            </div>
          </div>
        </div>
      </main>

      {/* Popup de login */}
      <Sheet open={loginOpen} onClose={() => setLoginOpen(false)} title={t('login.signin')}>
        <p className="text-content-secondary -mt-2 mb-5">{t('login.signinSub')}</p>

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
            <label className="label" htmlFor="email">{t('login.email')}</label>
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
            <label className="label" htmlFor="password">{t('login.password')}</label>
            <div className="relative">
              <input
                id="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pr-12"
                placeholder={t('login.yourPassword')}
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
            <div className="text-sm text-accent bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? <Spinner /> : t('login.signin')}
          </button>
        </form>

        <p className="text-center text-content-secondary mt-6">
          {t('login.noAccount')}{' '}
          <Link to="/cadastro" className="text-accent font-medium hover:underline">
            {t('login.createAccount')}
          </Link>
        </p>

        {config.mockMode && (
          <div className="mt-6 text-xs text-content-muted bg-surface-elevated border border-surface-border rounded-xl p-4">
            <p className="font-medium text-content-secondary mb-1">Modo demonstração (sem backend)</p>
            <p>Admin: {config.adminEmail} / Tailor@007</p>
          </div>
        )}
      </Sheet>

      <footer className="text-center py-6 md:py-3 text-sm text-content-muted md:shrink-0">
        A N A Technology by{' '}
        <a
          href="https://tailorexec.com.br"
          target="_blank"
          rel="noreferrer"
          className="hover:text-accent transition-colors"
        >
          Tailorexec.com.br
        </a>
      </footer>
    </div>
  )
}
