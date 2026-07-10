import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListChecks, Check, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import { createTask, deleteTask, listTasks, setTaskDone, tasksEnabled } from '../lib/tasks'
import type { ActionItem, Note, Task } from '../lib/types'
import { TASK_TEXT_MAX } from '../lib/types'
import { fmtDate } from '../lib/format'
import { ConfirmDialog, EmptyState, NoteCardSkeleton, Chip, Sheet, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { useT } from '../lib/i18n'

/** Uma linha da lista: item de acao de uma nota, ou tarefa avulsa (note = null). */
type Row = { key: string; item: ActionItem; note: Note | null; task: Task | null }

function dueTime(due?: string | null): number {
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<'open' | 'all' | 'done'>('open')
  const [busy, setBusy] = useState<string | null>(null)

  const [newOpen, setNewOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    db.listNotes(profile.id)
      .then(setNotes)
      .catch(() => {
        setNotes([])
        toast(t('common.error'), 'error')
      })

    if (tasksEnabled()) listTasks(profile.id).then(setTasks).catch(() => setTasks([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const rows = useMemo<Row[]>(() => {
    if (!notes) return []
    const all: Row[] = []
    for (const n of notes) {
      for (const item of n.action_items) all.push({ key: item.id, item, note: n, task: null })
    }
    for (const tk of tasks) {
      all.push({
        key: tk.id,
        item: { id: tk.id, text: tk.text, owner: tk.owner ?? undefined, due: tk.due ?? undefined, done: tk.done },
        note: null,
        task: tk,
      })
    }

    const f = all.filter(({ item }) =>
      filter === 'all' ? true : filter === 'open' ? !item.done : item.done,
    )
    f.sort((a, b) => {
      const da = dueTime(a.item.due)
      const dbb = dueTime(b.item.due)
      if (da !== dbb) return da - dbb
      const ca = a.note?.created_at ?? a.task!.created_at
      const cb = b.note?.created_at ?? b.task!.created_at
      return Date.parse(cb) - Date.parse(ca)
    })
    return f
  }, [notes, tasks, filter])

  const totalOpen = useMemo(() => {
    const fromNotes = notes ? notes.reduce((s, n) => s + n.action_items.filter((a) => !a.done).length, 0) : 0
    return fromNotes + tasks.filter((tk) => !tk.done).length
  }, [notes, tasks])

  async function toggleNoteItem(noteId: string, itemId: string) {
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

  async function toggleTask(tk: Task) {
    setBusy(tk.id)
    try {
      const updated = await setTaskDone(tk.id, !tk.done)
      setTasks((prev) => prev.map((x) => (x.id === tk.id ? updated : x)))
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function removeTask(id: string) {
    setBusy(id)
    try {
      await deleteTask(id)
      setTasks((prev) => prev.filter((x) => x.id !== id))
      toast(t('tasks.deleted'))
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function submitTask() {
    if (!profile || !text.trim() || saving) return
    setSaving(true)
    try {
      const created = await createTask(profile.id, { text, owner, due })
      setTasks((prev) => [created, ...prev])
      setText('')
      setOwner('')
      setDue('')
      setNewOpen(false)
      toast(t('tasks.created'))
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const charsLeft = TASK_TEXT_MAX - text.length

  return (
    <div className="px-5 safe-top">
      <header className="flex items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl font-bold flex items-center gap-2.5">
            <ListChecks size={26} className="text-accent" /> {t('tasks.title')}
          </h1>
          <p className="text-sm text-content-muted mt-1">
            {totalOpen} {totalOpen === 1 ? t('tasks.openOne') : t('tasks.openMany')}
          </p>
        </div>
        {tasksEnabled() && (
          <button
            onClick={() => setNewOpen(true)}
            className="btn-primary h-10 w-10 rounded-full p-0 shrink-0 mt-1"
            aria-label={t('tasks.new')}
          >
            <Plus size={20} />
          </button>
        )}
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
        <EmptyState icon={<ListChecks size={40} />} title={t('tasks.emptyTitle')} subtitle={t('tasks.emptySub')} />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-28 md:pb-10">
          {rows.map(({ key, item, note, task }) => (
            <li key={key} className="card p-4 flex flex-col">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => (note ? toggleNoteItem(note.id, item.id) : toggleTask(task!))}
                  disabled={busy === item.id}
                  aria-label="ok"
                  className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center shrink-0 transition-colors ${
                    item.done ? 'bg-brand-solid border-brand-solid text-white' : 'border-surface-border hover:border-accent'
                  }`}
                >
                  {item.done && <Check size={13} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug break-words ${item.done ? 'line-through text-content-muted' : ''}`}>
                    {item.text}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-content-muted">
                    {item.owner && <span className="font-medium text-content-secondary">{item.owner}</span>}
                    {item.due && dueTime(item.due) !== Infinity && <span>· {fmtDate(item.due)}</span>}
                  </div>
                </div>
              </div>

              {note ? (
                <button
                  onClick={() => navigate(`/nota/${note.id}`)}
                  className="mt-3 w-full flex items-center gap-2 text-xs text-content-muted hover:text-accent border-t border-surface-border pt-2"
                >
                  <span className="truncate flex-1 text-left">{note.title}</span>
                  <ChevronRight size={14} className="shrink-0" />
                </button>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-xs text-content-muted border-t border-surface-border pt-2">
                  <span className="flex-1 text-left">{t('tasks.manual')}</span>
                  <button
                    onClick={() => setPendingDelete(task!)}
                    disabled={busy === task!.id}
                    aria-label={t('tasks.delete')}
                    title={t('tasks.delete')}
                    className="shrink-0 hover:text-accent"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title={t('tasks.new')}>
        <div className="mb-3">
          <label className="label">{t('tasks.text')}</label>
          <textarea
            className="input min-h-20 resize-none"
            maxLength={TASK_TEXT_MAX}
            placeholder={t('tasks.textPlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <p className={`text-xs mt-1 ${charsLeft <= 15 ? 'text-accent' : 'text-content-muted'}`}>
            {t('tasks.charsLeft').replace('{n}', String(charsLeft))}
          </p>
        </div>

        {/* O `input type=date` tem largura MINIMA intrinseca (calendario + texto) que o grid nao
            encolhe: em duas colunas ele escapa do card. Empilhados, cada campo ocupa a largura
            do card e nada transborda. */}
        <div className="space-y-3 mb-4">
          <div className="min-w-0">
            <label className="label">{t('tasks.owner')}</label>
            <input
              className="input w-full min-w-0"
              maxLength={60}
              placeholder={t('tasks.ownerPlaceholder')}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="label">{t('tasks.due')}</label>
            <input
              type="date"
              className="input w-full min-w-0 px-2"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
        </div>

        <button className="btn-primary w-full" onClick={submitTask} disabled={!text.trim() || saving}>
          {saving ? <Spinner /> : <Plus size={18} />} {t('tasks.create')}
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!pendingDelete}
        title={t('tasks.delete')}
        message={pendingDelete?.text}
        confirmLabel={t('home.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={() => pendingDelete && removeTask(pendingDelete.id)}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  )
}
