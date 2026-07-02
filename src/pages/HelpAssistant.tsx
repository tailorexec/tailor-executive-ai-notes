import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Sheet, Spinner } from '../components/ui'
import { askHelp } from '../lib/ai'

const SUGGESTIONS = [
  'Como gravar uma reuniao?',
  'Como compartilho uma nota?',
  'Como funcionam as pastas?',
  'Por quanto tempo o audio fica guardado?',
]

export function HelpAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ana'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading])

  async function ask(q?: string) {
    const question = (q ?? input).trim()
    if (!question || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: question }])
    setLoading(true)
    try {
      const a = await askHelp(question)
      setMessages((m) => [...m, { role: 'ana', text: a }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="ANA — Ajuda">
      <div className="flex items-center gap-2 text-xs text-content-muted mb-3">
        <Sparkles size={14} className="text-brand-500" />
        Pergunte como usar o aplicativo. So respondo sobre as funcoes da plataforma.
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2 mb-3 pr-1">
        {messages.length === 0 && (
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
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-line ${
              m.role === 'user' ? 'ml-auto bg-brand-500 text-white' : 'mr-auto bg-surface-elevated text-content-primary'
            }`}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="mr-auto bg-surface-elevated px-3.5 py-2 rounded-2xl">
            <Spinner size={14} />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2">
        <input
          className="input py-2.5"
          placeholder="Pergunte algo sobre o app..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
        />
        <button onClick={() => ask()} disabled={loading || !input.trim()} className="btn-primary h-11 w-11 rounded-full p-0" aria-label="Enviar">
          <Send size={18} />
        </button>
      </div>
    </Sheet>
  )
}
