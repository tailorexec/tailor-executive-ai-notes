import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  SearchX,
  Link2,
  Mic,
  NotebookPen,
  MessageSquare,
  ChevronRight,
  ArrowDownUp,
  Smartphone,
  Monitor,
  Video,
  StickyNote,
  ListChecks,
  Folder as FolderIcon,
} from 'lucide-react'
import { AnaIcon } from '../components/AnaIcon'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import type { Note, Folder } from '../lib/types'
import { fmtDate, fmtDuration, fmtTime } from '../lib/format'
import { Avatar, EmptyState, Chip, NoteCardSkeleton, PriorityBadge } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { Logo } from '../components/Logo'
import { NewNoteSheet } from '../components/NewNoteSheet'
import { AskNotesSheet } from './AskNotesSheet'
import { FolderSheet } from './FolderSheet'
import { getNotifPrefs, notify } from '../lib/notifications'
import { UpcomingEvents } from './UpcomingEvents'
import { HelpAssistant } from './HelpAssistant'
import { useT } from '../lib/i18n'
import { useToast } from '../components/Toast'

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
  const t = useT()
  const toast = useToast()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'longest'>('recent')
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
    }).catch(() => {
      setNotes([])
      toast(t('common.error'), 'error')
    })
    db.listFolders(profile.id).then(setFolderList).catch(() => {})
  }, [profile])

  const folderName = (id: string | null) => folderList.find((f) => f.id === id)?.name
  const folderColor = (id: string | null) => folderList.find((f) => f.id === id)?.color ?? null

  const filtered = useMemo(() => {
    if (!notes) return []
    const q = query.trim().toLowerCase()
    const arr = notes.filter((n) => {
      if (folderFilter !== 'all' && n.folder_id !== folderFilter) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.transcript.toLowerCase().includes(q) ||
        (n.summary ?? '').toLowerCase().includes(q)
      )
    })
    arr.sort((a, b) => {
      if (sort === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at)
      if (sort === 'longest') return (b.duration_seconds ?? 0) - (a.duration_seconds ?? 0)
      return Date.parse(b.created_at) - Date.parse(a.created_at)
    })
    return arr
  }, [notes, query, folderFilter, sort])

  const hasFilters = query.trim() !== '' || folderFilter !== 'all'


  return (
    <div className="px-5 safe-top md:h-[calc(100dvh-4rem)] md:flex md:flex-col md:overflow-hidden">
      <header className="mb-4 md:shrink-0">
        {/* Mobile: logo ANA + "AI NOTES ADVISOR" embaixo (a esquerda); "by [Tailor]" no canto superior direito */}
        <div className="md:hidden flex items-start justify-between gap-3 mb-3">
          <div>
            <Logo part="anaonly" heightClass="h-[19px]" />
            <span className="block text-accent text-[9px] font-semibold uppercase tracking-[0.22em] leading-none mt-1">
              AI NOTES ADVISOR
            </span>
          </div>
          <Logo part="tailor" heightClass="h-[31px]" className="pt-0.5" />
        </div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl sm:text-3xl font-bold whitespace-nowrap">{t('home.title')}</h1>
          {/* No desktop, os controles vao para o canto superior direito da tela */}
          <div className="flex items-center gap-2 md:fixed md:top-5 md:right-8 md:z-40">
            <button
              onClick={() => navigate('/tarefas')}
              aria-label={t('nav.tasks')}
              className="md:hidden grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border text-content-secondary hover:text-content-primary"
            >
              <ListChecks size={18} />
            </button>
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

      <button
        onClick={() => setAskOpen(true)}
        className="md:shrink-0 w-full flex items-center gap-3 bg-surface-elevated border border-surface-border rounded-2xl px-4 py-2.5 mb-3 text-left hover:border-accent/40 transition-colors"
      >
        <span className="grid place-items-center h-9 w-9 rounded-xl bg-brand-500 text-white shrink-0">
          <MessageSquare size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-sm">{t('home.chatAll')}</span>
          <span className="block text-xs text-content-muted">{t('home.chatAllSub')}</span>
        </span>
        <ChevronRight size={18} className="text-content-muted shrink-0" />
      </button>

      <div className="md:shrink-0">
        <UpcomingEvents />
      </div>

      <div className="relative mb-3 md:shrink-0">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-content-muted" />
        <input
          className="input pl-11"
          placeholder={t('home.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {folderList.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 -mx-1 px-1 md:shrink-0">
          <Chip active={folderFilter === 'all'} onClick={() => setFolderFilter('all')}>
            {t('home.all')}
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

      {notes && filtered.length > 0 && (
        <div className="flex items-center justify-between mb-2 px-1 md:shrink-0">
          <span className="text-xs text-content-muted">
            {filtered.length} {filtered.length === 1 ? t('home.noteOne') : t('home.noteMany')}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-content-secondary">
            <ArrowDownUp size={14} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'recent' | 'oldest' | 'longest')}
              className="bg-transparent focus:outline-none cursor-pointer"
              aria-label="Ordenar notas"
            >
              <option value="recent">{t('home.sortRecent')}</option>
              <option value="oldest">{t('home.sortOldest')}</option>
              <option value="longest">{t('home.sortLongest')}</option>
            </select>
          </div>
        </div>
      )}

      <div className="md:flex-1 md:min-h-0 md:overflow-y-auto md:-mx-1 md:px-1 pb-2">
      {notes === null ? (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <NoteCardSkeleton />
            </li>
          ))}
        </ul>
      ) : filtered.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<SearchX size={40} />}
            title={t('home.noResultTitle')}
            subtitle={t('home.noResultSub')}
            action={
              <button
                className="btn-outline"
                onClick={() => {
                  setQuery('')
                  setFolderFilter('all')
                }}
              >
                {t('home.clearFilters')}
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<NotebookPen size={40} />}
            title={t('home.emptyTitle')}
            subtitle={t('home.emptySub')}
            action={
              <button className="btn-primary" onClick={() => setNewOpen(true)}>
                {t('home.newNote')}
              </button>
            }
          />
        )
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
          {filtered.map((n) => {
            const fc = folderColor(n.folder_id)
            return (
            <li key={n.id}>
              <button
                onClick={() => navigate(`/nota/${n.id}`)}
                style={fc ? { borderColor: fc } : undefined}
                className={`card w-full h-full text-left px-4 py-3.5 hover:shadow-hover transition-all ${
                  fc ? '' : 'border-content-secondary/55 hover:border-accent/60'
                }`}
              >
                {/* Topo: data + prioridade + icone de origem (na cor da pasta, se houver) */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-content-muted shrink-0">{fmtDate(n.created_at)}</span>
                    {n.priority && <PriorityBadge level={n.priority} />}
                  </div>
                  <span
                    className={`grid place-items-center h-7 w-7 rounded-full shrink-0 ${
                      fc ? '' : 'bg-accent/10 text-accent'
                    }`}
                    style={fc ? { color: fc, background: `${fc}1a` } : undefined}
                  >
                    {sourceIcon(n)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{n.title}</h3>
                  {n.status === 'processing' && (
                    <span className="text-[10px] uppercase tracking-wide text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                      {t('home.processing')}
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
            )
          })}
        </ul>
      )}
      </div>

      {/* FAB da ANA (so ela): abre o assistente. Reflexo estatico de vidro para destaque. */}
      <button
        onClick={() => setHelpOpen(true)}
        aria-label={t('sidebar.talkAna')}
        className="fixed right-5 fab-above-nav z-50 overflow-hidden grid place-items-center h-16 w-16 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-float ring-1 ring-white/25 transition-colors"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'linear-gradient(140deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 20%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0) 56%)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-3 -right-3 h-12 w-12 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.20), transparent 70%)' }}
        />
        <AnaIcon size={30} className="relative" />
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

      {newOpen && <NewNoteSheet open={newOpen} onClose={() => setNewOpen(false)} />}
    </div>
  )
}
