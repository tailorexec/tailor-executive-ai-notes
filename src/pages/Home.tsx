import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  FileAudio,
  Upload,
  FileText,
  Link2,
  Mic,
  ChevronRight,
  NotebookPen,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import type { Note } from '../lib/types'
import { fmtDate, fmtDuration } from '../lib/format'
import { Avatar, EmptyState, Sheet, Spinner, Chip } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'

const TYPE_ICON: Record<Note['type'], React.ReactNode> = {
  recording: <Mic size={18} />,
  call: <FileAudio size={18} />,
  upload: <FileAudio size={18} />,
  file: <FileText size={18} />,
  link: <Link2 size={18} />,
}

export function Home() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string>('all')
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    if (!profile) return
    db.listNotes(profile.id).then(setNotes)
  }, [profile])

  const folders = useMemo(() => {
    const set = new Set<string>()
    notes?.forEach((n) => n.folder && set.add(n.folder))
    return Array.from(set)
  }, [notes])

  const filtered = useMemo(() => {
    if (!notes) return []
    const q = query.trim().toLowerCase()
    return notes.filter((n) => {
      if (folder !== 'all' && n.folder !== folder) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.transcript.toLowerCase().includes(q) ||
        (n.summary ?? '').toLowerCase().includes(q)
      )
    })
  }, [notes, query, folder])

  function startCapture(mode: string) {
    setNewOpen(false)
    navigate(`/capturar?mode=${mode}`)
  }

  return (
    <div className="px-5 pt-6 safe-top">
      <header className="flex items-center justify-between mb-5">
        <h1 className="font-display text-3xl font-bold">Minhas notas</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button onClick={() => navigate('/config')} aria-label="Perfil">
            {profile && <Avatar first={profile.first_name} last={profile.last_name} />}
          </button>
        </div>
      </header>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-content-muted" />
        <input
          className="input pl-11"
          placeholder="Pesquisar anotacoes e transcricoes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {folders.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
          <Chip active={folder === 'all'} onClick={() => setFolder('all')}>
            Todas as notas
          </Chip>
          {folders.map((f) => (
            <Chip key={f} active={folder === f} onClick={() => setFolder(f)}>
              {f}
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
        <ul className="space-y-3 mt-2">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => navigate(`/nota/${n.id}`)}
                className="card w-full text-left px-4 py-4 flex items-center gap-4 hover:border-brand-500/40 transition-colors"
              >
                <div className="grid place-items-center h-11 w-11 rounded-full bg-brand-500/10 text-brand-500 shrink-0">
                  {TYPE_ICON[n.type]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{n.title}</h3>
                    {n.status === 'processing' && (
                      <span className="text-[10px] uppercase tracking-wide text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded">
                        processando
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-content-muted mt-0.5">
                    {fmtDate(n.created_at)}
                    {n.duration_seconds ? ` • ${fmtDuration(n.duration_seconds)}` : ''}
                    {n.folder ? ` • ${n.folder}` : ''}
                  </p>
                </div>
                <ChevronRight size={18} className="text-content-muted shrink-0" />
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

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Nova nota">
        <div className="space-y-3">
          <NewOption icon={<Mic size={20} />} label="Gravar audio" hint="Grave uma reuniao ao vivo" onClick={() => startCapture('record')} />
          <NewOption icon={<Upload size={20} />} label="Enviar audio" hint="Importe um arquivo de audio" onClick={() => startCapture('upload')} />
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
