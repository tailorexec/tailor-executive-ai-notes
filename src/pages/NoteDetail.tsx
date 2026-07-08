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
  MessageSquareQuote,
  Network,
  MoreVertical,
  Languages,
  Pencil,
  Copy,
  FolderPlus,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db, config } from '../lib/api'
import { chatWithNote, generateAnalysis, generateDetailed } from '../lib/ai'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts'
import { fmtDateTime, fmtDuration } from '../lib/format'
import { Spinner, ConfirmDialog, PriorityBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import { useT } from '../lib/i18n'
import { AudioPlayer } from '../components/AudioPlayer'
import { deleteAudio } from '../lib/audioStore'
import type { ChatMessage, Note } from '../lib/types'
import { uid } from '../lib/db'
import { templateLabel } from '../lib/templates'
import { ShareSheet } from './ShareSheet'
import { FeedbackSheet } from './FeedbackSheet'
import { TranslateSheet } from './TranslateSheet'
import { FolderSheet } from './FolderSheet'
import { Sheet } from '../components/ui'
import type { Folder } from '../lib/types'

type Tab = 'summary' | 'detailed' | 'analysis' | 'transcript'

export function NoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()
  const t = useT()
  const [note, setNote] = useState<Note | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('summary')
  const [busy, setBusy] = useState<null | 'detailed' | 'analysis' | 'mindmap'>(null)
  const [narrating, setNarrating] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [translateOpen, setTranslateOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editField, setEditField] = useState<null | 'title' | 'summary'>(null)
  const [editValue, setEditValue] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!id) return
    db.getNote(id).then((n) => setNote(n)).catch(() => setNote(null))
    return () => stopSpeaking()
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [note?.chat.length])

  useEffect(() => {
    if (profile) db.listFolders(profile.id).then(setFolders)
  }, [profile])

  async function assignFolder(folderId: string | null) {
    if (!note) return
    const updated = await db.updateNote(note.id, { folder_id: folderId })
    setNote(updated)
  }

  const narratableText = useMemo(() => {
    if (!note) return ''
    if (tab === 'transcript') return note.transcript
    return note.summary
  }, [note, tab])

  if (note === undefined)
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner size={26} className="text-accent" />
      </div>
    )
  if (note === null)
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <p className="text-content-secondary mb-4">{t('note.notFound')}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>{t('note.back')}</button>
        </div>
      </div>
    )

  const canEdit = note.user_id === profile?.id

  function openEdit(field: 'title' | 'summary') {
    if (!note) return
    setMenuOpen(false)
    setEditField(field)
    setEditValue(field === 'title' ? note.title : note.summary)
  }

  async function saveEdit() {
    if (!note || !editField) return
    const patch = editField === 'title' ? { title: editValue.trim() } : { summary: editValue }
    const updated = await db.updateNote(note.id, patch)
    setNote(updated)
    setEditField(null)
    toast(t('note.saved'))
  }

  async function copyNote() {
    if (!note) return
    setMenuOpen(false)
    const lines = [note.title, '', note.summary]
    if (note.action_items.length) {
      lines.push('', 'Action Items:')
      note.action_items.forEach((a) => lines.push(`- ${a.text}${a.owner ? ` (${a.owner})` : ''}`))
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    toast(t('note.copied'))
  }

  async function runDetailed() {
    if (!note) return
    setBusy('detailed')
    try {
      const detailed = await generateDetailed(note.transcript, { template: note.template, context: note.context })
      const updated = await db.updateNote(note.id, { detailed_summary: detailed })
      if (profile) await db.logUsage(profile.id, 'ai_detailed', note.id)
      setNote(updated)
      setTab('detailed')
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function runAnalysis() {
    if (!note) return
    setBusy('analysis')
    try {
      const analysis = await generateAnalysis(note.transcript, { template: note.template, context: note.context })
      const updated = await db.updateNote(note.id, { analysis })
      if (profile) await db.logUsage(profile.id, 'ai_analysis', note.id)
      setNote(updated)
      setTab('analysis')
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
    }
  }

  /** Abre o mapa mental em pagina propria (que gera na primeira vez e salva). */
  function openMindMap() {
    if (!note) return
    navigate(`/nota/${note.id}/mapa-mental`)
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

  async function toggleKeepAudio() {
    if (!note) return
    const updated = await db.updateNote(note.id, { keep_audio: !note.keep_audio })
    setNote(updated)
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
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setChatBusy(false)
    }
  }

  /** Define/limpa a prioridade da nota. */
  async function setPriority(priority: Note['priority']) {
    if (!note) return
    try {
      const updated = await db.updateNote(note.id, { priority })
      setNote(updated)
      setMenuOpen(false)
      toast(t('note.saved'))
    } catch {
      toast(t('common.error'), 'error')
    }
  }

  async function doDelete() {
    if (!note) return
    await deleteAudio(note.audio_url)
    await db.deleteNote(note.id)
    navigate('/', { replace: true })
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'summary', label: t('note.tabSummary'), icon: <FileText size={16} /> },
    { key: 'detailed', label: t('note.tabDetailed'), icon: <Sparkles size={16} /> },
    { key: 'analysis', label: t('note.tabAnalysis'), icon: <BarChart3 size={16} /> },
    { key: 'transcript', label: t('note.tabTranscript'), icon: <ScrollText size={16} /> },
  ]

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-20 bg-surface-bg/90 backdrop-blur px-5 pb-3 safe-top">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/')}
            className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShareOpen(true)} className="btn-primary rounded-full px-4 py-2">
              <Share2 size={16} />
              {t('note.share')}
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
                aria-label={t('note.more')}
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 z-20 bg-surface-card border border-surface-border rounded-2xl shadow-float overflow-hidden py-1">
                    {canEdit && (
                      <button onClick={() => openEdit('title')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-surface-elevated">
                        <Pencil size={16} className="text-content-secondary" /> {t('note.editTitle')}
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => openEdit('summary')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-surface-elevated">
                        <FileText size={16} className="text-content-secondary" /> {t('note.editSummary')}
                      </button>
                    )}
                    <button onClick={copyNote} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-surface-elevated">
                      <Copy size={16} className="text-content-secondary" /> {t('note.copyNote')}
                    </button>
                    {canEdit && (
                      <div className="px-4 py-2 border-t border-surface-border">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-content-muted mb-1.5">
                          {t('prio.label')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(['alta', 'media', 'baixa'] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => setPriority(note.priority === p ? null : p)}
                              className={`text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
                                note.priority === p
                                  ? 'bg-accent/10 text-accent border-accent/30'
                                  : 'bg-surface-elevated text-content-secondary border-surface-border hover:border-accent/40'
                              }`}
                            >
                              {t(`prio.${p}`)}
                            </button>
                          ))}
                          <button
                            onClick={() => setPriority(null)}
                            className={`text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
                              !note.priority
                                ? 'bg-accent/10 text-accent border-accent/30'
                                : 'bg-surface-elevated text-content-secondary border-surface-border hover:border-accent/40'
                            }`}
                          >
                            {t('prio.none')}
                          </button>
                        </div>
                      </div>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          setConfirmDelete(true)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left text-accent hover:bg-surface-elevated border-t border-surface-border"
                      >
                        <Trash2 size={16} /> {t('note.deleteNote')}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold leading-tight">{note.title}</h1>
        <p className="text-sm text-content-muted mt-1">
          {fmtDateTime(note.created_at)}
          {note.duration_seconds ? ` • ${fmtDuration(note.duration_seconds)}` : ''}
          {note.folder ? ` • ${note.folder}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {note.priority && <PriorityBadge level={note.priority} className="px-2.5 py-1 text-[11px]" />}
          {note.template && note.template !== 'geral' && (
            <span className="text-[11px] font-medium uppercase tracking-wide text-accent bg-accent/10 border border-accent/20 rounded-full px-2.5 py-1">
              {templateLabel(note.template)}
            </span>
          )}
          <button
            onClick={() => setFolderOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium bg-surface-elevated border border-surface-border rounded-full px-2.5 py-1 hover:border-accent/40"
          >
            {(() => {
              const cf = folders.find((f) => f.id === note.folder_id)
              return cf ? (
                <>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: cf.color }} />
                  {cf.name}
                </>
              ) : (
                <>
                  <FolderPlus size={14} /> {t('note.addFolder')}
                </>
              )
            })()}
          </button>
        </div>
      </header>

      <div className="px-5 flex-1">
        {note.audio_url && (
          <div className="mb-5 space-y-2">
            <AudioPlayer audioRef={note.audio_url} />
            <button
              onClick={toggleKeepAudio}
              className="w-full flex items-center gap-3 card px-4 py-2.5 text-left"
            >
              <span
                className={`h-6 w-11 rounded-full relative shrink-0 transition-colors ${note.keep_audio ? 'bg-brand-500' : 'bg-surface-border'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${note.keep_audio ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t('note.keepAudio')}</span>
                <span className="block text-xs text-content-muted leading-snug">
                  {note.keep_audio
                    ? t('note.keepAudioOn')
                    : t('note.keepAudioOff').replace(
                        '{n}',
                        String(
                          Math.max(
                            0,
                            config.audioRetentionDays -
                              Math.floor((Date.now() - Date.parse(note.created_at)) / 86400000),
                          ),
                        ),
                      )}
                </span>
              </span>
            </button>
          </div>
        )}
        {!note.audio_url && note.audio_deleted_at && (
          <div className="mb-5 card px-4 py-3 text-sm text-content-muted">
            {t('note.audioRemoved').replace('{n}', String(config.audioRetentionDays))}
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <ActionButton
            icon={<MessageSquareQuote size={18} />}
            label={t('note.genFeedback')}
            hint={t('note.genFeedbackHint')}
            onClick={() => setFeedbackOpen(true)}
          />
          <ActionButton
            icon={<Languages size={18} />}
            label={t('note.translate')}
            hint={t('note.translateHint')}
            onClick={() => setTranslateOpen(true)}
          />
          <ActionButton
            icon={<Network size={18} />}
            label={t('note.mindmap')}
            hint={t('note.mindmapHint')}
            onClick={openMindMap}
          />
          {ttsSupported() && (
            <ActionButton
              icon={narrating ? <Square size={18} /> : <Volume2 size={18} />}
              label={narrating ? t('note.stopNarr') : t('note.narrate')}
              hint={t('note.narrateHint')}
              onClick={toggleNarration}
            />
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
              <ProseBlock text={note.summary} empty={t('note.summaryNA')} />
              {note.action_items.length > 0 && (
                <div className="mt-6">
                  <h3 className="flex items-center gap-2 font-display font-semibold mb-3">
                    <ListChecks size={18} className="text-accent" /> {t('note.actionItems')}
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
                title={t('note.detailedTitle')}
                subtitle={t('note.detailedSub')}
                loading={busy === 'detailed'}
                onClick={runDetailed}
                t={t}
              />
            ))}

          {tab === 'analysis' &&
            (note.analysis ? (
              <AnalysisView analysis={note.analysis} t={t} />
            ) : (
              <GenerateCta
                title={t('note.analysisTitle')}
                subtitle={t('note.analysisSub')}
                loading={busy === 'analysis'}
                onClick={runAnalysis}
                t={t}
              />
            ))}

          {tab === 'transcript' && <ProseBlock text={note.transcript} empty={t('note.transcriptNA')} mono />}
        </div>
      </div>

      {/* Chat da nota: fechado = barra inferior com botao; aberto = barra com botao de fechar */}
      {!chatOpen ? (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-30 bg-surface-bg/95 backdrop-blur border-t border-surface-border safe-bottom">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <button onClick={() => setChatOpen(true)} className="btn-primary w-full">
              <MessageSquare size={18} />
              {t('note.chatOpen')}
              {note.chat.length > 0 && (
                <span className="grid place-items-center min-w-5 h-5 px-1 rounded-full bg-white/20 text-[11px]">
                  {note.chat.length}
                </span>
              )}
            </button>
          </div>
        </div>
      ) : (
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-30 bg-surface-bg/95 backdrop-blur border-t border-surface-border safe-bottom">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-content-secondary flex items-center gap-2">
              <MessageSquare size={15} className="text-accent" /> {t('note.chatPlaceholder')}
            </span>
            <button
              onClick={() => setChatOpen(false)}
              aria-label={t('note.chatClose')}
              className="grid place-items-center h-8 w-8 rounded-full text-content-muted hover:bg-surface-elevated hover:text-content-primary"
            >
              <X size={18} />
            </button>
          </div>
          {note.chat.length > 0 && (
            <div className="max-h-52 overflow-y-auto space-y-2 mb-3 pr-1">
              {note.chat.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] px-3.5 py-2 rounded-2xl text-sm break-words whitespace-pre-line ${
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
                placeholder={t('note.chatPlaceholder')}
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
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t('note.delTitle')}
        message={t('note.delMsg')}
        confirmLabel={t('note.delConfirm')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />

      {shareOpen && (
        <ShareSheet note={note} open={shareOpen} onClose={() => setShareOpen(false)} onUpdated={setNote} />
      )}
      {feedbackOpen && <FeedbackSheet note={note} open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />}
      {translateOpen && <TranslateSheet note={note} open={translateOpen} onClose={() => setTranslateOpen(false)} />}
      {folderOpen && profile && (
        <FolderSheet
          open={folderOpen}
          onClose={() => setFolderOpen(false)}
          userId={profile.id}
          mode="assign"
          selectedId={note.folder_id}
          onSelect={assignFolder}
          onChanged={() => db.listFolders(profile.id).then(setFolders)}
        />
      )}

      <Sheet open={editField !== null} onClose={() => setEditField(null)} title={editField === 'title' ? 'Editar titulo' : 'Editar resumo'}>
        {editField === 'title' ? (
          <input className="input mb-4" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
        ) : (
          <textarea className="input min-h-[220px] resize-y mb-4 leading-relaxed" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
        )}
        <div className="flex gap-3">
          <button className="btn-outline flex-1" onClick={() => setEditField(null)}>Cancelar</button>
          <button className="btn-primary flex-1" onClick={saveEdit}>Salvar</button>
        </div>
      </Sheet>
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
      className="card flex items-center gap-3 px-4 py-3 text-left hover:border-accent/40 transition-colors disabled:opacity-50"
    >
      <span className="text-accent shrink-0">{icon}</span>
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
  t,
}: {
  title: string
  subtitle: string
  loading: boolean
  onClick: () => void
  t: (k: string) => string
}) {
  return (
    <div className="card p-6 text-center">
      <h3 className="font-display font-semibold text-lg">{title}</h3>
      <p className="text-content-secondary mt-1 mb-5">{subtitle}</p>
      <button className="btn-primary mx-auto" onClick={onClick} disabled={loading}>
        {loading ? <Spinner /> : <Sparkles size={18} />}
        {loading ? t('note.generating') : t('note.genNow')}
      </button>
    </div>
  )
}

/** Renders simple markdown-ish content (headings, bullets). */
function ProseBlock({ text, empty, mono }: { text: string; empty?: string; mono?: boolean }) {
  if (!text?.trim()) return <p className="text-content-muted">{empty ?? 'Sem conteudo.'}</p>
  const lines = text.split('\n')
  return (
    <div className={`space-y-2 leading-relaxed break-words ${mono ? 'text-content-secondary' : ''}`}>
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="h-2" />
        if (t.startsWith('## '))
          return <h3 key={i} className="font-display font-semibold text-lg text-accent mt-4">{t.slice(3)}</h3>
        if (t.startsWith('# '))
          return <h2 key={i} className="font-display font-bold text-xl mt-4">{t.slice(2)}</h2>
        if (t.startsWith('- '))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-accent mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
              <span>{t.slice(2)}</span>
            </div>
          )
        return <p key={i}>{t}</p>
      })}
    </div>
  )
}

function AnalysisView({ analysis, t }: { analysis: NonNullable<Note['analysis']>; t: (k: string) => string }) {
  return (
    <div className="space-y-5">
      {typeof analysis.overallScore === 'number' && (
        <div className="card p-5 flex items-center gap-4">
          <div className="grid place-items-center h-16 w-16 rounded-full bg-accent/10 text-accent font-display font-bold text-xl">
            {analysis.overallScore}
          </div>
          <div>
            <p className="font-semibold">{t('note.quality')}</p>
            <p className="text-sm text-content-muted">{analysis.pacing}</p>
          </div>
        </div>
      )}
      <AnalysisSection title={t('note.tone')} items={[analysis.tone]} />
      <AnalysisSection title={t('note.strengths')} items={analysis.strengths} accent />
      <AnalysisSection title={t('note.improvements')} items={analysis.improvements} />
      <AnalysisSection title={t('note.questionsAsked')} items={analysis.questionsAsked} />
      <AnalysisSection title={t('note.suggestedQuestions')} items={analysis.suggestedQuestions} accent />
      <AnalysisSection title={t('note.keyPoints')} items={analysis.keyPoints} />
      <AnalysisSection title={t('note.risks')} items={analysis.risks} />
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
          <li key={i} className={`card px-4 py-3 ${accent ? 'border-accent/30' : ''}`}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}

