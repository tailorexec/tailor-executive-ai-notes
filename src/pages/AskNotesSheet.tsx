import { useState } from 'react'
import { Sparkles, Send } from 'lucide-react'
import { Sheet, Spinner } from '../components/ui'
import { askAllNotes } from '../lib/ai'
import type { Note } from '../lib/types'

const SUGGESTIONS = [
  'O que ficou pendente nas ultimas reunioes?',
  'Quais candidatos tiveram avaliacao positiva?',
  'Resuma as decisoes comerciais recentes.',
]

export function AskNotesSheet({
  open,
  onClose,
  notes,
}: {
  open: boolean
  onClose: () => void
  notes: Note[]
}) {
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)

  async function ask(question?: string) {
    const query = (question ?? q).trim()
    if (!query) return
    setQ(query)
    setLoading(true)
    setAnswer('')
    try {
      const a = await askAllNotes(
        query,
        notes.map((n) => ({ title: n.title, created_at: n.created_at, summary: n.summary })),
      )
      setAnswer(a)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Conversar com todas as reunioes">
      <p className="text-sm text-content-secondary mb-4">
        Pergunte em linguagem natural e a IA responde consultando o conteudo de todas as suas
        reunioes ({notes.length}).
      </p>

      <div className="flex items-center gap-2 mb-4">
        <input
          className="input"
          placeholder="Ex: o que ficou pendente com o cliente X?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
        />
        <button onClick={() => ask()} disabled={loading || !q.trim()} className="btn-primary h-11 w-11 rounded-full p-0" aria-label="Perguntar">
          {loading ? <Spinner size={18} /> : <Send size={18} />}
        </button>
      </div>

      {!answer && !loading && (
        <div className="space-y-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="w-full text-left text-sm bg-surface-elevated border border-surface-border rounded-xl px-3 py-2.5 hover:border-brand-500/40"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-content-muted text-sm">
          <Spinner size={16} /> Consultando suas reunioes...
        </div>
      )}

      {answer && (
        <div className="card p-4">
          <div className="flex items-center gap-2 text-brand-500 mb-2 text-sm font-medium">
            <Sparkles size={16} /> Resposta
          </div>
          <p className="whitespace-pre-line leading-relaxed text-sm">{answer}</p>
        </div>
      )}
    </Sheet>
  )
}
