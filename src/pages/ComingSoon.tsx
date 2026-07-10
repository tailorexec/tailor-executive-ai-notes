import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, Plug } from 'lucide-react'
import { useT } from '../lib/i18n'

/** Paginas de "Mais funcoes" que ainda nao existem: Conectores e Analytics. */
function Placeholder({ title, message, icon }: { title: string; message: string; icon: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="px-5 safe-top">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/config')}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl font-bold">{title}</h1>
      </header>

      <div className="card p-8 text-center max-w-md mx-auto">
        <span className="grid place-items-center h-16 w-16 rounded-full bg-surface-elevated text-accent mx-auto mb-4">
          {icon}
        </span>
        <p className="text-content-secondary leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

export function ConnectorsPage() {
  const t = useT()
  return <Placeholder title={t('connectors.title')} message={t('connectors.soon')} icon={<Plug size={28} />} />
}

export function AnalyticsPage() {
  const t = useT()
  return <Placeholder title={t('analytics.title')} message={t('analytics.soon')} icon={<BarChart3 size={28} />} />
}
