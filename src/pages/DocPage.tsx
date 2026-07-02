import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

/** Layout simples para paginas de conteudo (ajuda, termos, privacidade). */
export function DocPage({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="px-5 pt-6 safe-top pb-16">
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
      <div className="max-w-2xl space-y-5 leading-relaxed text-content-secondary">{children}</div>
    </div>
  )
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-semibold text-content-primary mb-1.5">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
