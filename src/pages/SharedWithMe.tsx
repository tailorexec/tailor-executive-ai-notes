import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Share2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { db } from '../lib/api'
import { directoryByIds } from '../lib/directory'
import type { Note, PersonRef } from '../lib/types'
import { fmtDate } from '../lib/format'
import { Avatar, EmptyState, NoteCardSkeleton, PriorityBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import { useT } from '../lib/i18n'
import { logSilentError } from '../lib/auditLog'
import { toPreviewText } from '../lib/textPreview'

export function SharedWithMePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const toast = useToast()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [authors, setAuthors] = useState<Map<string, PersonRef>>(new Map())

  useEffect(() => {
    if (!profile) return
    let alive = true

    // listNotes ja devolve minhas + as compartilhadas comigo (RLS). Aqui fico so com as dos outros.
    db.listNotes(profile.id)
      .then(async (all) => {
        const shared = all.filter((n) => n.user_id !== profile.id)
        // Nome de quem compartilhou vem do diretorio (profiles nao expoe perfil alheio).
        const people = await directoryByIds([...new Set(shared.map((n) => n.user_id))])
        if (!alive) return
        setNotes(shared)
        setAuthors(people)
      })
      .catch((err) => {
        if (!alive) return
        setNotes([])
        logSilentError('client:SharedWithMe', err)
        toast(t('common.error'), 'error')
      })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  return (
    <div className="px-5 safe-top">
      <header className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/config')}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl font-bold">{t('shared.title')}</h1>
      </header>

      {notes === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState icon={<Share2 size={40} />} title={t('shared.emptyTitle')} subtitle={t('shared.emptySub')} />
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-28 md:pb-10">
          {notes.map((n) => {
            const a = authors.get(n.user_id)
            const name = a ? `${a.first_name} ${a.last_name}`.trim() : '—'
            return (
              <li key={n.id}>
                <button
                  onClick={() => navigate(`/nota/${n.id}`)}
                  className="note-card card w-full text-left p-4 flex flex-col gap-3 hover:shadow-hover transition-all"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <p className="font-display font-semibold flex-1 min-w-0 truncate">{n.title}</p>
                    {n.priority && <PriorityBadge level={n.priority} />}
                    <ChevronRight size={16} className="text-content-muted shrink-0 mt-0.5" />
                  </div>

                  {n.summary && (
                    <p className="text-sm text-content-secondary line-clamp-2 leading-snug">
                      {toPreviewText(n.summary)}
                    </p>
                  )}

                  <div className="flex items-center gap-2 min-w-0 border-t border-surface-border pt-2.5">
                    {a && <Avatar first={a.first_name} last={a.last_name} size={24} url={a.avatar_url} />}
                    <span className="text-xs text-content-muted truncate flex-1">
                      {t('shared.by').replace('{name}', name)}
                    </span>
                    <span className="text-xs text-content-muted shrink-0">{fmtDate(n.created_at)}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
