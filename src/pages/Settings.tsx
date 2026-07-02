import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  FileLock2,
  LogOut,
  Moon,
  ScrollText,
  ShieldCheck,
  Sun,
  Bell,
  HelpCircle,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { Avatar } from '../components/ui'
import { Logo } from '../components/Logo'

function Row({
  icon,
  label,
  onClick,
  danger,
  right,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  danger?: boolean
  right?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
        danger ? 'text-brand-500' : 'text-content-primary'
      }`}
    >
      <span className={danger ? 'text-brand-500' : 'text-content-secondary'}>{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {right ?? <ChevronRight size={18} className="text-content-muted" />}
    </button>
  )
}

export function Settings() {
  const { profile, isAdmin, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  if (!profile) return null

  return (
    <div className="px-5 pt-6 safe-top">
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold">Configuracoes</h1>
      </header>

      <div className="card p-5 flex items-center gap-4 mb-6">
        <Avatar first={profile.first_name} last={profile.last_name} size={56} />
        <div className="min-w-0">
          <p className="font-display font-semibold text-lg truncate">
            {profile.first_name} {profile.last_name}
          </p>
          <p className="text-content-muted text-sm truncate">{profile.email}</p>
          <p className="text-content-muted text-sm">{profile.phone}</p>
        </div>
      </div>

      {isAdmin && (
        <div className="card divide-y divide-surface-border mb-6">
          <Row
            icon={<ShieldCheck size={20} className="text-brand-500" />}
            label="Painel de administrador"
            onClick={() => navigate('/admin')}
          />
        </div>
      )}

      <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">Preferencias</p>
      <div className="card divide-y divide-surface-border mb-6">
        <Row
          icon={theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          label="Tema escuro"
          onClick={toggle}
          right={
            <span
              className={`h-6 w-11 rounded-full transition-colors relative ${
                theme === 'dark' ? 'bg-brand-500' : 'bg-surface-border'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          }
        />
        <Row icon={<Bell size={20} />} label="Notificacoes" />
      </div>

      <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">Meus dados</p>
      <div className="card divide-y divide-surface-border mb-6">
        <Row icon={<Trash2 size={20} />} label="Lixeira" onClick={() => navigate('/lixeira')} />
      </div>

      <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">Suporte</p>
      <div className="card divide-y divide-surface-border mb-6">
        <Row icon={<HelpCircle size={20} />} label="Central de ajuda" onClick={() => navigate('/ajuda')} />
        <Row icon={<ScrollText size={20} />} label="Termos de servico" onClick={() => navigate('/termos')} />
        <Row icon={<FileLock2 size={20} />} label="Politica de privacidade" onClick={() => navigate('/privacidade')} />
      </div>

      <div className="card mb-8">
        <Row icon={<LogOut size={20} />} label="Sair" danger onClick={signOut} right={<span />} />
      </div>

      <div className="flex flex-col items-center gap-2 pb-4 text-content-muted">
        <Logo size="lg" />
        <p className="text-xs">ANA by Tailor • v0.1.0</p>
      </div>
    </div>
  )
}
