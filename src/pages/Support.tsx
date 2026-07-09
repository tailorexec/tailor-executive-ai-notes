import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LifeBuoy, Check } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import type { SupportTicket, TicketTopic } from '../lib/types'
import { fmtDateTime } from '../lib/format'
import { Spinner } from '../components/ui'
import { useT } from '../lib/i18n'

const TOPICS: { v: TicketTopic; key: string }[] = [
  { v: 'financeiro', key: 'sup.t_fin' },
  { v: 'tecnico', key: 'sup.t_tech' },
  { v: 'feedback', key: 'sup.t_feedback' },
  { v: 'outros', key: 'sup.t_other' },
]

export function Support() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const [topic, setTopic] = useState<TicketTopic>('tecnico')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null)

  function load() {
    if (profile) db.listMyTickets(profile.id).then(setTickets)
  }
  useEffect(load, [profile])

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
    <div className="px-5 safe-top pb-16">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/config')}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold">{t('sup.title')}</h1>
          <p className="text-sm text-content-muted">{t('sup.subtitle')}</p>
        </div>
      </header>

      <div className="card p-5 mb-6 max-w-xl">
        <label className="label">{t('sup.topic')}</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {TOPICS.map((top) => (
            <button
              key={top.v}
              onClick={() => setTopic(top.v)}
              className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                topic === top.v
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-surface-elevated border-surface-border text-content-secondary'
              }`}
            >
              {t(top.key)}
            </button>
          ))}
        </div>

        <label className="label">{t('sup.subject')}</label>
        <input className="input mb-4" placeholder={t('sup.subjectPh')} value={subject} onChange={(e) => setSubject(e.target.value)} />

        <label className="label">{t('sup.message')}</label>
        <textarea
          className="input min-h-[120px] resize-none mb-4"
          placeholder={t('sup.messagePh')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button className="btn-primary w-full" onClick={submit} disabled={sending || !message.trim()}>
          {sending ? <Spinner /> : sent ? <Check size={18} /> : <LifeBuoy size={18} />}
          {sent ? t('sup.sent') : t('sup.send')}
        </button>
      </div>

      <h2 className="font-display font-semibold mb-3">{t('sup.mine')}</h2>
      {tickets === null ? (
        <div className="grid place-items-center py-8"><Spinner className="text-accent" /></div>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-content-muted">{t('sup.empty')}</p>
      ) : (
        <ul className="space-y-3 max-w-xl">
          {tickets.map((tk) => (
            <li key={tk.id} className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wide bg-brand-500 text-white px-2 py-0.5 rounded-full">{tk.topic}</span>
                {tk.subject && <span className="font-medium text-sm truncate">{tk.subject}</span>}
                <span className="text-xs text-content-muted ml-auto">{fmtDateTime(tk.created_at)}</span>
              </div>
              <p className="text-sm text-content-secondary whitespace-pre-line">{tk.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
