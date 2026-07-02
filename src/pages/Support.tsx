import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LifeBuoy, Check } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import type { SupportTicket, TicketTopic, Profile } from '../lib/types'
import { fmtDateTime } from '../lib/format'
import { Spinner } from '../components/ui'

const TOPICS: { v: TicketTopic; label: string }[] = [
  { v: 'financeiro', label: 'Financeiro' },
  { v: 'tecnico', label: 'Tecnico' },
  { v: 'feedback', label: 'Feedback' },
  { v: 'outros', label: 'Outros' },
]

export function Support() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [topic, setTopic] = useState<TicketTopic>('tecnico')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [tickets, setTickets] = useState<(SupportTicket & { profile?: Profile })[] | null>(null)

  function load() {
    db.listTickets().then(setTickets)
  }
  useEffect(load, [])

  async function submit() {
    if (!profile || !message.trim()) return
    setSending(true)
    try {
      await db.createTicket({ user_id: profile.id, topic, subject: subject.trim(), message: message.trim() })
      setSubject('')
      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 2500)
      load()
    } finally {
      setSending(false)
    }
  }

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
        <div>
          <h1 className="font-display text-2xl font-bold">Suporte</h1>
          <p className="text-sm text-content-muted">Abra um chamado e nossa equipe responde.</p>
        </div>
      </header>

      <div className="card p-5 mb-6 max-w-xl">
        <label className="label">Tema</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {TOPICS.map((t) => (
            <button
              key={t.v}
              onClick={() => setTopic(t.v)}
              className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                topic === t.v
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-surface-elevated border-surface-border text-content-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="label">Assunto (opcional)</label>
        <input className="input mb-4" placeholder="Resumo do assunto" value={subject} onChange={(e) => setSubject(e.target.value)} />

        <label className="label">Mensagem</label>
        <textarea
          className="input min-h-[120px] resize-none mb-4"
          placeholder="Descreva sua duvida, problema ou sugestao..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button className="btn-primary w-full" onClick={submit} disabled={sending || !message.trim()}>
          {sending ? <Spinner /> : sent ? <Check size={18} /> : <LifeBuoy size={18} />}
          {sent ? 'Chamado enviado' : 'Enviar chamado'}
        </button>
      </div>

      <h2 className="font-display font-semibold mb-3">{isAdmin ? 'Chamados recebidos' : 'Meus chamados'}</h2>
      {tickets === null ? (
        <div className="grid place-items-center py-8"><Spinner className="text-brand-500" /></div>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-content-muted">Nenhum chamado ainda.</p>
      ) : (
        <ul className="space-y-3 max-w-xl">
          {tickets.map((t) => (
            <li key={t.id} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide bg-brand-500/10 text-brand-500 px-2 py-0.5 rounded-full">{t.topic}</span>
                {t.subject && <span className="font-medium text-sm truncate">{t.subject}</span>}
                <span className="text-xs text-content-muted ml-auto">{fmtDateTime(t.created_at)}</span>
              </div>
              <p className="text-sm text-content-secondary whitespace-pre-line">{t.message}</p>
              {isAdmin && t.profile && (
                <p className="text-xs text-content-muted mt-2">
                  {t.profile.first_name} {t.profile.last_name} • {t.profile.email}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
