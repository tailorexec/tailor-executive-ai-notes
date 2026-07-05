import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Sheet, Spinner } from '../components/ui'
import { AnaIcon } from '../components/AnaIcon'
import { askHelp } from '../lib/ai'

const SUGGESTIONS = [
  'Como gravar uma reunião?',
  'Como compartilho uma nota?',
  'Como funcionam as pastas?',
  'Por quanto tempo o áudio fica guardado?',
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
    <Sheet open={open} onClose={onClose} title="ANA">
      <div className="flex items-center gap-2 text-sm font-medium text-content-secondary mb-3">
        <span className="grid place-items-center h-7 w-7 rounded-full bg-brand-500 text-white shrink-0">
          <AnaIcon size={16} />
        </span>
        Sou a ANA, pergunte o que quiser.
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2 mb-3 pr-1">
        {messages.length === 0 && (
          <div className="space-y-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="w-full text-left text-sm bg-surface-elevated border border-surface-border rounded-xl px-3 py-2.5 hover:border-accent/40"
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
