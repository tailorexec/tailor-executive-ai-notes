import { useState } from 'react'
import { Sparkles, Copy, Check, Mail } from 'lucide-react'
import { Sheet, Spinner } from '../components/ui'
import { generateFeedback } from '../lib/ai'
import { db } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import type { Note } from '../lib/types'

type Audience = 'cliente' | 'candidato'

export function FeedbackSheet({
  note,
  open,
  onClose,
}: {
  note: Note
  open: boolean
  onClose: () => void
}) {
  const { profile } = useAuth()
  const [audience, setAudience] = useState<Audience>('cliente')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const fb = await generateFeedback(note.transcript, audience)
      setText(fb)
      if (profile) await db.logUsage(profile.id, 'ai_feedback', note.id)
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function sendWhats() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }
  function sendEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent('Feedback')}&body=${encodeURIComponent(text)}`
  }

  return (
    <Sheet open={open} onClose={onClose} title="Gerar feedback">
      <p className="text-sm text-content-secondary mb-3">
        Feedback profissional a partir desta reuniao. Escolha o publico, gere e edite antes de enviar.
      </p>

      <div className="flex gap-2 mb-4">
        {(['cliente', 'candidato'] as Audience[]).map((a) => (
          <button
            key={a}
            onClick={() => setAudience(a)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border capitalize transition-colors ${
              audience === a
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'bg-surface-elevated border-surface-border text-content-secondary'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {!text && (
        <button className="btn-primary w-full mb-2" onClick={generate} disabled={loading}>
          {loading ? <Spinner /> : <Sparkles size={18} />}
          {loading ? 'Gerando...' : 'Gerar feedback'}
        </button>
      )}

      {text && (
        <>
          <textarea
            className="input min-h-[220px] resize-y mb-3 leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" onClick={copy}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button className="btn-outline" onClick={sendWhats}>WhatsApp</button>
            <button className="btn-outline" onClick={sendEmail}>
              <Mail size={16} /> E-mail
            </button>
          </div>
          <button className="btn-ghost w-full mt-2" onClick={generate} disabled={loading}>
            {loading ? <Spinner /> : <Sparkles size={16} />} Gerar novamente
          </button>
        </>
      )}
    </Sheet>
  )
}
