import { useState } from 'react'
import { Languages, Copy, Check } from 'lucide-react'
import { Sheet, Spinner } from '../components/ui'
import { translateText } from '../lib/ai'
import type { Note } from '../lib/types'

const LANGS = ['Ingles', 'Espanhol', 'Frances', 'Portugues']

export function TranslateSheet({
  note,
  open,
  onClose,
}: {
  note: Note
  open: boolean
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const source = note.summary?.trim() || note.transcript

  async function run(lang: string) {
    setLoading(true)
    setText('')
    try {
      setText(await translateText(source, lang))
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Traduzir">
      <p className="text-sm text-content-secondary mb-3">Traduz o resumo desta nota para o idioma escolhido.</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => run(l)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-sm font-medium border bg-surface-elevated border-surface-border hover:border-brand-500/40"
          >
            {l}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-content-muted text-sm">
          <Spinner size={16} /> Traduzindo...
        </div>
      )}

      {text && (
        <>
          <textarea className="input min-h-[200px] resize-y mb-3 leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn-primary w-full" onClick={copy}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copiado' : 'Copiar traducao'}
          </button>
        </>
      )}

      {!text && !loading && (
        <div className="text-content-muted text-sm flex items-center gap-2">
          <Languages size={16} /> Escolha um idioma acima.
        </div>
      )}
    </Sheet>
  )
}
