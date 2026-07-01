import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Spinner } from '../components/ui'
import { config } from '../lib/config'

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

  return (
    <div className="min-h-screen flex flex-col bg-surface-bg safe-top">
      <header className="flex items-center justify-between px-6 pt-6">
        <Logo size="sm" />
        <ThemeToggle />
      </header>

      <div className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md w-full mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Entrar</h1>
          <p className="text-content-secondary mt-2">
            Acesse sua conta Tailor Executive AI Notes.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              E-mail corporativo
            </label>
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
            <label className="label" htmlFor="password">
              Senha
            </label>
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
          Nao tem conta?{' '}
          <Link to="/cadastro" className="text-brand-500 font-medium hover:underline">
            Criar conta
          </Link>
        </p>

        {config.mockMode && (
          <div className="mt-8 text-xs text-content-muted bg-surface-elevated border border-surface-border rounded-xl p-4">
            <p className="font-medium text-content-secondary mb-1">Modo demonstracao (sem backend)</p>
            <p>Admin: {config.adminEmail} / Tailor@007</p>
            <p className="mt-1">Crie novos usuarios em "Criar conta" (e-mail @{config.allowedDomain}).</p>
          </div>
        )}
      </div>
    </div>
  )
}
