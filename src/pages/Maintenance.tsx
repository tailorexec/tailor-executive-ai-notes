import { Wrench, Clock } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAuth } from '../auth/AuthProvider'
import type { AppSettings } from '../lib/types'

export function Maintenance({ settings }: { settings: AppSettings }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 safe-top">
      <Logo size="md" className="mb-10" />
      <div className="grid place-items-center h-20 w-20 rounded-full bg-brand-500/10 text-brand-500 mb-6">
        <Wrench size={34} />
      </div>
      <h1 className="font-display text-2xl font-bold">Em manutencao</h1>
      <p className="text-content-secondary mt-3 max-w-md whitespace-pre-line">
        {settings.maintenance_message || 'Estamos aprimorando a plataforma. Voltamos em breve.'}
      </p>
      {settings.maintenance_eta && (
        <div className="mt-5 inline-flex items-center gap-2 text-sm text-content-secondary bg-surface-elevated border border-surface-border rounded-full px-4 py-2">
          <Clock size={16} className="text-brand-500" />
          Previsao de retorno: {settings.maintenance_eta}
        </div>
      )}
      <button onClick={signOut} className="btn-ghost mt-10">
        Sair
      </button>
    </div>
  )
}
