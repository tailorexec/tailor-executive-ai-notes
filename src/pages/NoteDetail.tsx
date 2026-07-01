import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Share2,
  Sparkles,
  Volume2,
  Square,
  Send,
  FileText,
  ListChecks,
  BarChart3,
  ScrollText,
  Trash2,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import { chatWithNote, generateAnalysis, generateDetailed } from '../lib/ai'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts'
import { fmtDateTime, fmtDuration } from '../lib/format'
import { Spinner } from '../components/ui'
import { AudioPlayer } from '../components/AudioPlayer'
import { deleteAudio } from '../lib/audioStore'
import type { ChatMessage, Note } from '../lib/types'
import { uid } from '../lib/db'
import { ShareSheet } from './ShareSheet'

type Tab = 'summary' | 'detailed' | 'analysis' | 'transcript'

export function NoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [note, setNote] = useState<Note | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('summary')
  const [busy, setBusy] = useState<null | 'detailed' | 'analysis'>(null)
  const [narrating, setNarrating] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!id) return
    db.getNote(id).then((n) => setNote(n))
    return () => stopSpeaking()
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [note?.chat.length])

  const narratableText = useMemo(() => {
    if (!note) return ''
    if (tab === 'transcript') return note.transcript
    if (tab === 'detailed') return note.detailed_summary ?? note.summary
    if (tab === 'analysis' && note.analysis)
      return `Tom: ${note.analysis.tone}. Pontos-chave: ${note.analysis.keyPoints.join('. ')}.`
    return note.summary
  }, [note, tab])

  if (note === undefined)
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner size={26} className="text-brand-500" />
      </div>
    )
  if (note === null)
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <p className="text-content-secondary mb-4">Nota nao encontrada.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Voltar</button>
        </div>
      </div>
    )

  const canEdit = note.user_id === profile?.id

  async function runDetailed() {
    if (!note) return
    setBusy('detailed')
    try {
      const detailed = await generateDetailed(note.transcript)
      const updated = await db.updateNote(note.id, { detailed_summary: detailed })
      if (profile) await db.logUsage(profile.id, 'ai_detailed', note.id)
      setNote(updated)
      setTab('detailed')
    } finally {
      setBusy(null)
    }
  }

  async function runAnalysis() {
    if (!note) return
    setBusy('analysis')
    try {
      const analysis = await generateAnalysis(note.transcript)
      const updated = await db.updateNote(note.id, { analysis })
      if (profile) await db.logUsage(profile.id, 'ai_analysis', note.id)
      setNote(updated)
      setTab('analysis')
    } finally {
      setBusy(null)
    }
  }

  function toggleNarration() {
    if (narrating) {
      stopSpeaking()
      setNarrating(false)
      return
    }
    setNarrating(true)
    if (profile) db.logUsage(profile.id, 'tts', note!.id)
    speak(narratableText, { onEnd: () => setNarrating(false) })
  }

  async function toggleActionItem(itemId: string) {
    if (!note) return
    const items = note.action_items.map((a) => (a.id === itemId ? { ...a, done: !a.done } : a))
    const updated = await db.updateNote(note.id, { action_items: items })
    setNote(updated)
  }

  async function sendChat() {
    if (!note || !chatInput.trim()) return
    const question = chatInput.trim()
    setChatInput('')
    const userMsg: ChatMessage = { id: uid('c_'), role: 'user', content: question, created_at: new Date().toISOString() }
    const withUser = { ...note, chat: [...note.chat, userMsg] }
    setNote(withUser)
    setChatBusy(true)
    try {
      const reply = await chatWithNote(
        question,
        note.transcript,
        note.chat.map((m) => ({ role: m.role, content: m.content })),
      )
      const botMsg: ChatMessage = { id: uid('c_'), role: 'assistant', content: reply, created_at: new Date().toISOString() }
      const updated = await db.updateNote(note.id, { chat: [...withUser.chat, botMsg] })
      if (profile) await db.logUsage(profile.id, 'ai_chat', note.id)
      setNote(updated)
    } finally {
      setChatBusy(false)
    }
  }

  async function onDelete() {
    if (!note) return
    if (!confirm('Excluir esta nota? Esta acao nao pode ser desfeita.')) return
    await deleteAudio(note.audio_url)
    await db.deleteNote(note.id)
    navigate('/', { replace: true })
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'summary', label: 'Resumo', icon: <FileText size={16} /> },
    { key: 'detailed', label: 'Detalhado', icon: <Sparkles size={16} /> },
    { key: 'analysis', label: 'Analise', icon: <BarChart3 size={16} /> },
    { key: 'transcript', label: 'Transcricao', icon: <ScrollText size={16} /> },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 bg-surface-bg/90 backdrop-blur px-5 pt-6 pb-3 safe-top">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/')}
            className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <button onClick={() => setShareOpen(true)} className="btn-primary rounded-full px-4 py-2">
            <Share2 size={16} />
            Compartilhar
          </button>
        </div>
        <h1 className="font-display text-2xl font-bold leading-tight">{note.title}</h1>
        <p className="text-sm text-content-muted mt-1">
          {fmtDateTime(note.created_at)}
          {note.duration_seconds ? ` • ${fmtDuration(note.duration_seconds)}` : ''}
          {note.folder ? ` • ${note.folder}` : ''}
        </p>
      </header>

      <div className="px-5 flex-1">
        {note.audio_url && (
          <div className="mb-5">
            <AudioPlayer audioRef={note.audio_url} />
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <ActionButton
            icon={busy === 'detailed' ? <Spinner size={18} /> : <Sparkles size={18} />}
            label={note.detailed_summary ? 'Regerar detalhado' : 'Gerar detalhado'}
            hint="Mais inteligente (Sonnet)"
            onClick={runDetailed}
            disabled={busy !== null}
          />
          <ActionButton
            icon={busy === 'analysis' ? <Spinner size={18} /> : <BarChart3 size={18} />}
            label={note.analysis ? 'Reanalisar' : 'Analise de reuniao'}
            hint="Tom, perguntas, dicas"
            onClick={runAnalysis}
            disabled={busy !== null}
          />
          {ttsSupported() && (
            <ActionButton
              icon={narrating ? <Square size={18} /> : <Volume2 size={18} />}
              label={narrating ? 'Parar narracao' : 'Narrar'}
              hint="Ouvir esta secao"
              onClick={toggleNarration}
            />
          )}
          {canEdit && (
            <ActionButton icon={<Trash2 size={18} />} label="Excluir" hint="Remover nota" onClick={onDelete} />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                tab === t.key
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-surface-elevated border-surface-border text-content-secondary'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="pb-40">
          {tab === 'summary' && (
            <>
              <ProseBlock text={note.summary} empty="Resumo indisponivel." />
              {note.action_items.length > 0 && (
                <div className="mt-6">
                  <h3 className="flex items-center gap-2 font-display font-semibold mb-3">
                    <ListChecks size={18} className="text-brand-500" /> Action Items
                  </h3>
                  <ul className="space-y-2">
                    {note.action_items.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => toggleActionItem(a.id)}
                          className="w-full flex items-start gap-3 card px-4 py-3 text-left"
                        >
                          <span
                            className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center shrink-0 ${
                              a.done ? 'bg-brand-500 border-brand-500 text-white' : 'border-surface-border'
                            }`}
                          >
                            {a.done && <ListChecks size={12} />}
                          </span>
                          <span className={a.done ? 'line-through text-content-muted' : ''}>
                            {a.text}
                            {a.owner && <span className="text-content-muted"> — {a.owner}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {tab === 'detailed' &&
            (note.detailed_summary ? (
              <ProseBlock text={note.detailed_summary} />
            ) : (
              <GenerateCta
                title="Resumo detalhado mais inteligente"
                subtitle="Gera um resumo aprofundado com o modelo Sonnet."
                loading={busy === 'detailed'}
                onClick={runDetailed}
              />
            ))}

          {tab === 'analysis' &&
            (note.analysis ? (
              <AnalysisView analysis={note.analysis} />
            ) : (
              <GenerateCta
                title="Analise de reuniao"
                subtitle="Tom, perguntas feitas, sugestoes, ritmo e pontos de melhoria."
                loading={busy === 'analysis'}
                onClick={runAnalysis}
              />
            ))}

          {tab === 'transcript' && <ProseBlock text={note.transcript} empty="Transcricao indisponivel." mono />}
        </div>
      </div>

      {/* Chat bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-30 bg-surface-bg/95 backdrop-blur border-t border-surface-border safe-bottom">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {note.chat.length > 0 && (
            <div className="max-h-52 overflow-y-auto space-y-2 mb-3 pr-1">
              {note.chat.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm ${
                    m.role === 'user'
                      ? 'ml-auto bg-brand-500 text-white'
                      : 'mr-auto bg-surface-elevated text-content-primary'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {chatBusy && (
                <div className="mr-auto bg-surface-elevated px-3.5 py-2 rounded-2xl">
                  <Spinner size={14} />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MessageSquare size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted" />
              <input
                className="input pl-10 py-2.5"
                placeholder="Conversar com esta nota"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              />
            </div>
            <button
              onClick={sendChat}
              disabled={chatBusy || !chatInput.trim()}
              className="btn-primary h-11 w-11 rounded-full p-0"
              aria-label="Enviar"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {shareOpen && (
        <ShareSheet note={note} open={shareOpen} onClose={() => setShareOpen(false)} onUpdated={setNote} />
      )}
    </div>
  )
}

function ActionButton({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card flex items-center gap-3 px-4 py-3 text-left hover:border-brand-500/40 transition-colors disabled:opacity-50"
    >
      <span className="text-brand-500 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium text-sm truncate">{label}</span>
        <span className="block text-xs text-content-muted truncate">{hint}</span>
      </span>
    </button>
  )
}

function GenerateCta({
  title,
  subtitle,
  loading,
  onClick,
}: {
  title: string
  subtitle: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <div className="card p-6 text-center">
      <h3 className="font-display font-semibold text-lg">{title}</h3>
      <p className="text-content-secondary mt-1 mb-5">{subtitle}</p>
      <button className="btn-primary mx-auto" onClick={onClick} disabled={loading}>
        {loading ? <Spinner /> : <Sparkles size={18} />}
        {loading ? 'Gerando...' : 'Gerar agora'}
      </button>
    </div>
  )
}

/** Renders simple markdown-ish content (headings, bullets). */
function ProseBlock({ text, empty, mono }: { text: string; empty?: string; mono?: boolean }) {
  if (!text?.trim()) return <p className="text-content-muted">{empty ?? 'Sem conteudo.'}</p>
  const lines = text.split('\n')
  return (
    <div className={`space-y-2 leading-relaxed ${mono ? 'text-content-secondary' : ''}`}>
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="h-2" />
        if (t.startsWith('## '))
          return <h3 key={i} className="font-display font-semibold text-lg text-brand-500 mt-4">{t.slice(3)}</h3>
        if (t.startsWith('# '))
          return <h2 key={i} className="font-display font-bold text-xl mt-4">{t.slice(2)}</h2>
        if (t.startsWith('- '))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-brand-500 mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
              <span>{t.slice(2)}</span>
            </div>
          )
        return <p key={i}>{t}</p>
      })}
    </div>
  )
}

function AnalysisView({ analysis }: { analysis: NonNullable<Note['analysis']> }) {
  return (
    <div className="space-y-5">
      {typeof analysis.overallScore === 'number' && (
        <div className="card p-5 flex items-center gap-4">
          <div className="grid place-items-center h-16 w-16 rounded-full bg-brand-500/10 text-brand-500 font-display font-bold text-xl">
            {analysis.overallScore}
          </div>
          <div>
            <p className="font-semibold">Qualidade da reuniao</p>
            <p className="text-sm text-content-muted">{analysis.pacing}</p>
          </div>
        </div>
      )}
      <AnalysisSection title="Tom" items={[analysis.tone]} />
      <AnalysisSection title="Pontos fortes" items={analysis.strengths} accent />
      <AnalysisSection title="Melhorias sugeridas" items={analysis.improvements} />
      <AnalysisSection title="Perguntas feitas" items={analysis.questionsAsked} />
      <AnalysisSection title="Perguntas sugeridas" items={analysis.suggestedQuestions} accent />
      <AnalysisSection title="Pontos-chave" items={analysis.keyPoints} />
      <AnalysisSection title="Riscos" items={analysis.risks} />
    </div>
  )
}

function AnalysisSection({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  if (!items?.length) return null
  return (
    <div>
      <h3 className="font-display font-semibold mb-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className={`card px-4 py-3 ${accent ? 'border-brand-500/30' : ''}`}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
