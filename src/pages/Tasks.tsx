import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Check, ChevronRight } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import type { Note } from '../lib/types'
import { fmtDate } from '../lib/format'
import { EmptyState, NoteCardSkeleton, Chip } from '../components/ui'
import { useToast } from '../components/Toast'
import { useT } from '../lib/i18n'

type Row = { note: Note; item: Note['action_items'][number] }

function dueTime(due?: string): number {
  if (!due) return Infinity
  const t = Date.parse(due)
  return Number.isNaN(t) ? Infinity : t
}

export function TasksPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const toast = useToast()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [filter, setFilter] = useState<'open' | 'all' | 'done'>('open')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    db.listNotes(profile.id)
      .then(setNotes)
      .catch(() => {
        setNotes([])
        toast(t('common.error'), 'error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const rows = useMemo<Row[]>(() => {
    if (!notes) return []
    const all: Row[] = []
    for (const n of notes) for (const item of n.action_items) all.push({ note: n, item })
    const f = all.filter(({ item }) =>
      filter === 'all' ? true : filter === 'open' ? !item.done : item.done,
    )
    f.sort((a, b) => {
      const da = dueTime(a.item.due)
      const dbb = dueTime(b.item.due)
      if (da !== dbb) return da - dbb
      return Date.parse(b.note.created_at) - Date.parse(a.note.created_at)
    })
    return f
  }, [notes, filter])

  const openCount = useMemo(
    () => (notes ? notes.reduce((s, n) => s + n.action_items.filter((a) => !a.done).length, 0) : 0),
    [notes],
  )

  async function toggle(noteId: string, itemId: string) {
    if (!notes) return
    setBusy(itemId)
    try {
      const note = notes.find((n) => n.id === noteId)
      if (!note) return
      const items = note.action_items.map((a) => (a.id === itemId ? { ...a, done: !a.done } : a))
      const updated = await db.updateNote(noteId, { action_items: items })
      setNotes(notes.map((n) => (n.id === noteId ? updated : n)))
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="px-5 safe-top">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-bold flex items-center gap-2.5">
          <ListChecks size={26} className="text-accent" /> {t('tasks.title')}
        </h1>
        <p className="text-sm text-content-muted mt-1">
          {openCount} {openCount === 1 ? t('tasks.openOne') : t('tasks.openMany')}
        </p>
      </header>

      <div className="flex gap-2 mb-4">
        <Chip active={filter === 'open'} onClick={() => setFilter('open')}>
          {t('tasks.open')}
        </Chip>
        <Chip active={filter === 'done'} onClick={() => setFilter('done')}>
          {t('tasks.done')}
        </Chip>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          {t('tasks.all')}
        </Chip>
      </div>

      {notes === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={40} />}
          title={t('tasks.emptyTitle')}
          subtitle={t('tasks.emptySub')}
        />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-28 md:pb-10">
          {rows.map(({ note, item }) => (
            <li key={item.id} className="card p-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggle(note.id, item.id)}
                  disabled={busy === item.id}
                  aria-label="ok"
                  className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center shrink-0 transition-colors ${
                    item.done ? 'bg-brand-500 border-brand-500 text-white' : 'border-surface-border hover:border-accent'
                  }`}
                >
                  {item.done && <Check size={13} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${item.done ? 'line-through text-content-muted' : ''}`}>
                    {item.text}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-content-muted">
                    {item.owner && <span className="font-medium text-content-secondary">{item.owner}</span>}
                    {item.due && dueTime(item.due) !== Infinity && <span>· {fmtDate(item.due)}</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate(`/nota/${note.id}`)}
                className="mt-3 w-full flex items-center gap-2 text-xs text-content-muted hover:text-accent border-t border-surface-border pt-2"
              >
                <span className="truncate flex-1 text-left">{note.title}</span>
                <ChevronRight size={14} className="shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
