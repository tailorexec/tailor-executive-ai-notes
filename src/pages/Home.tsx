import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Upload,
  FileText,
  Link2,
  Mic,
  Headphones,
  NotebookPen,
  MessageSquare,
  ChevronRight,
  Smartphone,
  Monitor,
  Video,
  StickyNote,
  Bot,
  Folder as FolderIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import type { Note, Folder } from '../lib/types'
import { fmtDate, fmtDuration, fmtTime } from '../lib/format'
import { Avatar, EmptyState, Sheet, Spinner, Chip } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { Logo } from '../components/Logo'
import { AskNotesSheet } from './AskNotesSheet'
import { FolderSheet } from './FolderSheet'
import { getNotifPrefs, notify } from '../lib/notifications'
import { UpcomingEvents } from './UpcomingEvents'
import { HelpAssistant } from './HelpAssistant'

/** Icone de origem: diferencia como a nota foi criada. */
function sourceIcon(n: Note): React.ReactNode {
  if (n.type === 'video') return <Video size={18} />
  if (n.type === 'file') return <StickyNote size={18} />
  if (n.type === 'link') return <Link2 size={18} />
  // audio (recording/upload/call): mostra o dispositivo de origem quando conhecido
  if (n.device === 'mobile') return <Smartphone size={18} />
  if (n.device === 'desktop') return <Monitor size={18} />
  return <Mic size={18} /> // origem desconhecida (notas antigas)
}

export function Home() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [query, setQuery] = useState('')
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [folderList, setFolderList] = useState<Folder[]>([])
  const [folderOpen, setFolderOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    db.listNotes(profile.id).then((ns) => {
      setNotes(ns)
      // Notifica novas notas compartilhadas comigo (se habilitado).
      try {
        if (getNotifPrefs().shared) {
          const sharedIds = ns.filter((n) => n.user_id !== profile.id).map((n) => n.id)
          const raw = localStorage.getItem('tailor.seenShared')
          const seen = new Set<string>(raw ? JSON.parse(raw) : [])
          const fresh = sharedIds.filter((id) => !seen.has(id))
          if (raw !== null && fresh.length) {
            notify('Nova transcricao compartilhada', `Voce recebeu ${fresh.length} nota(s).`)
          }
          localStorage.setItem('tailor.seenShared', JSON.stringify(sharedIds))
        }
      } catch {
        /* ignore */
      }
    })
    db.listFolders(profile.id).then(setFolderList)
  }, [profile])

  const folderName = (id: string | null) => folderList.find((f) => f.id === id)?.name

  const filtered = useMemo(() => {
    if (!notes) return []
    const q = query.trim().toLowerCase()
    return notes.filter((n) => {
      if (folderFilter !== 'all' && n.folder_id !== folderFilter) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.transcript.toLowerCase().includes(q) ||
        (n.summary ?? '').toLowerCase().includes(q)
      )
    })
  }, [notes, query, folderFilter])

  function startCapture(mode: string) {
    setNewOpen(false)
    navigate(`/capturar?mode=${mode}`)
  }

  return (
    <div className="px-5 pt-6 safe-top">
      <header className="mb-5">
        {/* Logo ANA no topo, alinhada a esquerda (apenas mobile; no desktop fica na sidebar) */}
        <Logo part="ana" heightClass="h-6" className="md:hidden mb-3" />
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">Minhas notas</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFolderOpen(true)}
              aria-label="Pastas"
              className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border text-content-secondary hover:text-content-primary"
            >
              <FolderIcon size={18} />
            </button>
            <ThemeToggle />
            <button onClick={() => navigate('/config')} aria-label="Perfil">
              {profile && <Avatar first={profile.first_name} last={profile.last_name} url={profile.avatar_url} />}
            </button>
          </div>
        </div>
      </header>

      <UpcomingEvents />

      <button
        onClick={() => setHelpOpen(true)}
        className="md:hidden relative w-full overflow-hidden rounded-2xl mb-4 p-[1.5px] group text-left"
      >
        <span className="absolute inset-0 bg-[linear-gradient(110deg,#941010,#F10C27,#640816,#F10C27,#941010)] bg-[length:200%_100%] animate-shine opacity-80 group-hover:opacity-100" />
        <span className="relative flex items-center gap-3 rounded-2xl bg-surface-card px-4 py-3">
          <span className="relative grid place-items-center h-9 w-9 rounded-xl bg-brand-500 text-white shrink-0">
            <span className="absolute inset-0 rounded-xl bg-brand-500 animate-ping opacity-30" />
            <Bot size={18} className="relative" />
          </span>
          <span className="text-sm leading-tight">
            <span className="font-semibold">ANA:</span>
            <span className="text-content-secondary"> Me deixe ser sua assistente, tenho PhD</span>
            <span className="text-content-muted"> - ou me pergunte algo.</span>
          </span>
        </span>
      </button>

      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-content-muted" />
        <input
          className="input pl-11"
          placeholder="Pesquisar anotacoes e transcricoes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <button
        onClick={() => setAskOpen(true)}
        className="w-full flex items-center gap-3 bg-surface-elevated border border-surface-border rounded-2xl px-4 py-3 mb-4 text-left hover:border-brand-500/40 transition-colors"
      >
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-brand-500 text-white shrink-0">
          <MessageSquare size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-sm">Conversar com todas as reunioes</span>
          <span className="block text-xs text-content-muted">Pergunte a IA sobre qualquer nota</span>
        </span>
        <ChevronRight size={18} className="text-content-muted shrink-0" />
      </button>

      {folderList.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
          <Chip active={folderFilter === 'all'} onClick={() => setFolderFilter('all')}>
            Todas
          </Chip>
          {folderList.map((f) => (
            <Chip key={f.id} active={folderFilter === f.id} onClick={() => setFolderFilter(f.id)}>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} />
                {f.name}
              </span>
            </Chip>
          ))}
        </div>
      )}

      {notes === null ? (
        <div className="grid place-items-center py-20">
          <Spinner size={24} className="text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={40} />}
          title="Nenhuma nota ainda"
          subtitle="Grave uma reuniao, envie um audio ou um arquivo para comecar."
          action={
            <button className="btn-primary" onClick={() => setNewOpen(true)}>
              Nova nota
            </button>
          }
        />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3 mt-2">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => navigate(`/nota/${n.id}`)}
                className="card w-full h-full text-left px-4 py-3.5 hover:border-brand-500/40 transition-colors"
              >
                {/* Topo: data + icone de origem */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-content-muted">{fmtDate(n.created_at)}</span>
                  <span className="grid place-items-center h-7 w-7 rounded-full bg-brand-500/10 text-brand-500">
                    {sourceIcon(n)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{n.title}</h3>
                  {n.status === 'processing' && (
                    <span className="text-[10px] uppercase tracking-wide text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded shrink-0">
                      processando
                    </span>
                  )}
                </div>
                {/* Abaixo do titulo: horario (+ duracao/pasta) */}
                <p className="text-sm text-content-muted mt-1">
                  {fmtTime(n.created_at)}
                  {n.duration_seconds ? ` • ${fmtDuration(n.duration_seconds)}` : ''}
                  {folderName(n.folder_id) ? ` • ${folderName(n.folder_id)}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Floating "Nova nota" for discoverability (center star also opens capture) */}
      <button
        onClick={() => setNewOpen(true)}
        className="fixed right-5 bottom-24 md:bottom-8 z-30 btn-primary shadow-float rounded-full pl-4 pr-5 py-3"
      >
        <NotebookPen size={18} />
        Nova nota
      </button>

      {askOpen && <AskNotesSheet open={askOpen} onClose={() => setAskOpen(false)} notes={notes ?? []} />}
      {helpOpen && <HelpAssistant open={helpOpen} onClose={() => setHelpOpen(false)} />}

      {folderOpen && profile && (
        <FolderSheet
          open={folderOpen}
          onClose={() => setFolderOpen(false)}
          userId={profile.id}
          mode="manage"
          onChanged={() => db.listFolders(profile.id).then(setFolderList)}
        />
      )}

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Nova nota">
        <div className="space-y-3">
          <NewOption icon={<Headphones size={20} />} label="Gravar reuniao" hint="Audio da reuniao + seu microfone" onClick={() => startCapture('meeting')} />
          <NewOption icon={<Upload size={20} />} label="Enviar audio" hint="Importe um arquivo de audio" onClick={() => startCapture('upload')} />
          <NewOption icon={<Video size={20} />} label="Enviar video" hint="A IA extrai o audio e transcreve" onClick={() => startCapture('video')} />
          <NewOption icon={<FileText size={20} />} label="PDF, arquivo ou texto" hint="Resuma um documento" onClick={() => startCapture('file')} />
          <NewOption icon={<Link2 size={20} />} label="Link da web" hint="Resuma o conteudo de um link" onClick={() => startCapture('link')} />
        </div>
      </Sheet>
    </div>
  )
}

function NewOption({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-surface-elevated border border-surface-border rounded-2xl px-4 py-3.5 text-left hover:border-brand-500/40 transition-colors"
    >
      <div className="grid place-items-center h-10 w-10 rounded-full bg-brand-500/10 text-brand-500 shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-content-muted">{hint}</p>
      </div>
    </button>
  )
}
