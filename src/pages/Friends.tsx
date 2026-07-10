import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Hand, Info, Plus, Search, Send, Trash2, UserPlus, Users } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import {
  acceptInvite,
  invite,
  listFriends,
  listMessages,
  markRead,
  poke,
  removeFriendship,
  searchPeople,
  sendMessage,
} from '../lib/friends'
import { FRIEND_MSG_MAX, type FriendEdge, type FriendMessage, type PersonRef } from '../lib/types'
import { Avatar, EmptyState, Sheet, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { useT } from '../lib/i18n'

const fullName = (p: PersonRef) => `${p.first_name} ${p.last_name}`.trim()

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/* ---------------- Chat individual (efemero) ---------------- */
function ChatSheet({
  me,
  friend,
  open,
  onClose,
  onRead,
}: {
  me: string
  friend: PersonRef
  open: boolean
  onClose: () => void
  onRead: () => void
}) {
  const t = useT()
  const toast = useToast()
  const [msgs, setMsgs] = useState<FriendMessage[] | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    listMessages(me, friend.id)
      .then((m) => alive && setMsgs(m))
      .catch(() => alive && setMsgs([]))

    markRead(me, friend.id).then(onRead).catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, friend.id, me])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [msgs])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const m = await sendMessage(me, friend.id, body)
      setMsgs((prev) => [...(prev ?? []), m])
      setText('')
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setSending(false)
    }
  }

  const left = FRIEND_MSG_MAX - text.length

  return (
    <Sheet open={open} onClose={onClose} title={fullName(friend)}>
      <p className="flex items-start gap-1.5 text-xs text-content-muted mb-3">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>{t('friends.ephemeral')}</span>
      </p>

      <div className="h-64 overflow-y-auto overscroll-contain rounded-xl bg-surface-elevated border border-surface-border p-3 mb-3">
        {msgs === null ? (
          <div className="h-full grid place-items-center">
            <Spinner className="text-accent" />
          </div>
        ) : msgs.length === 0 ? (
          <p className="h-full grid place-items-center text-sm text-content-muted">{t('friends.chatEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {msgs.map((m) => {
              const mine = m.sender_id === me
              if (m.kind === 'poke') {
                return (
                  <li key={m.id} className="flex justify-center">
                    <span className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 rounded-full px-3 py-1">
                      <Hand size={12} />
                      {mine
                        ? `${t('friends.youPoked')} ${friend.first_name}`
                        : `${friend.first_name} ${t('friends.pokeLine')}`}
                    </span>
                  </li>
                )
              }
              return (
                <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      mine ? 'bg-brand-solid text-white' : 'bg-surface-card border border-surface-border'
                    }`}
                  >
                    <p className="text-sm break-words">{m.body}</p>
                    <p className={`text-[10px] mt-0.5 ${mine ? 'text-white/70' : 'text-content-muted'}`}>
                      {timeLabel(m.created_at)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <input
            className="input"
            maxLength={FRIEND_MSG_MAX}
            placeholder={t('friends.messagePlaceholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <p className="text-[11px] text-content-muted mt-1">
            {t('tasks.charsLeft').replace('{n}', String(left))}
          </p>
        </div>
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="btn-primary h-11 w-11 rounded-xl p-0 shrink-0 disabled:opacity-50"
          aria-label={t('friends.send')}
        >
          {sending ? <Spinner size={16} /> : <Send size={18} />}
        </button>
      </div>
    </Sheet>
  )
}

/* ---------------- Adicionar amigo ---------------- */
function AddFriendSheet({
  me,
  open,
  onClose,
  known,
  onInvited,
}: {
  me: string
  open: boolean
  onClose: () => void
  known: string[]
  onInvited: () => void
}) {
  const t = useT()
  const toast = useToast()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PersonRef[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const q = term.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    // Debounce: a busca bate no banco a cada tecla sem isso.
    const id = setTimeout(() => {
      searchPeople(me, q, known)
        .then(setResults)
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(id)
  }, [term, open, me, known])

  async function add(p: PersonRef) {
    setBusy(p.id)
    try {
      await invite(me, p.id)
      toast(t('friends.invited'))
      setTerm('')
      setResults(null)
      onInvited()
      onClose()
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('friends.add')}>
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
        <input
          className="input pl-10"
          placeholder={t('friends.searchPlaceholder')}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
        />
      </div>

      {results === null ? (
        <p className="text-sm text-content-muted py-6 text-center">{t('friends.searchHint')}</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-content-muted py-6 text-center">{t('friends.noResults')}</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-elevated">
              <Avatar first={p.first_name} last={p.last_name} size={36} url={p.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{fullName(p)}</p>
                <p className="text-xs text-content-muted truncate">{p.email}</p>
              </div>
              <button
                onClick={() => add(p)}
                disabled={busy === p.id}
                className="btn-outline h-9 px-3 text-sm shrink-0"
              >
                {busy === p.id ? <Spinner size={14} /> : <UserPlus size={15} />}
                {t('friends.invite')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

/* ---------------- Pagina ---------------- */
export function FriendsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const toast = useToast()
  const me = profile?.id ?? ''

  const [edges, setEdges] = useState<FriendEdge[] | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [chatWith, setChatWith] = useState<PersonRef | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!me) return
    listFriends(me)
      .then(setEdges)
      .catch(() => {
        setEdges([])
        toast(t('common.error'), 'error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  useEffect(refresh, [refresh])

  const incoming = useMemo(() => (edges ?? []).filter((e) => e.incoming), [edges])
  const accepted = useMemo(() => (edges ?? []).filter((e) => e.friendship.status === 'accepted'), [edges])
  const outgoing = useMemo(
    () => (edges ?? []).filter((e) => e.friendship.status === 'pending' && !e.incoming),
    [edges],
  )
  const knownIds = useMemo(() => (edges ?? []).map((e) => e.person.id), [edges])

  async function run(key: string, fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(key)
    try {
      await fn()
      if (okMsg) toast(okMsg)
      refresh()
    } catch {
      toast(t('common.error'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="px-5 safe-top">
      <header className="flex items-center gap-3 mb-2">
        <button
          onClick={() => navigate('/config')}
          className="grid place-items-center h-10 w-10 rounded-full bg-surface-elevated border border-surface-border"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl font-bold flex-1">{t('friends.title')}</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="btn-primary h-10 w-10 rounded-full p-0"
          aria-label={t('friends.add')}
        >
          <Plus size={20} />
        </button>
      </header>

      <p className="flex items-start gap-1.5 text-xs text-content-muted mb-6">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>{t('friends.ephemeral')}</span>
      </p>

      {incoming.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">{t('friends.requests')}</p>
          <ul className="space-y-2 mb-6">
            {incoming.map((e) => (
              <li key={e.friendship.id} className="card p-3 flex items-center gap-3">
                <Avatar first={e.person.first_name} last={e.person.last_name} size={40} url={e.person.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{fullName(e.person)}</p>
                  <p className="text-xs text-content-muted truncate">{e.person.email}</p>
                </div>
                <button
                  onClick={() => run(e.friendship.id, () => acceptInvite(e.friendship.id), t('friends.accepted'))}
                  disabled={busy === e.friendship.id}
                  className="btn-primary h-9 px-3 text-sm shrink-0"
                >
                  {t('friends.accept')}
                </button>
                <button
                  onClick={() => run(e.friendship.id, () => removeFriendship(e.friendship.id, me, e.person.id))}
                  disabled={busy === e.friendship.id}
                  className="btn-ghost h-9 px-3 text-sm shrink-0"
                >
                  {t('friends.decline')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {edges === null ? (
        <div className="grid place-items-center py-16">
          <Spinner className="text-accent" />
        </div>
      ) : accepted.length === 0 && outgoing.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title={t('friends.emptyTitle')} subtitle={t('friends.emptySub')} />
      ) : (
        <ul className="space-y-2 pb-28 md:pb-10">
          {accepted.map((e) => (
            <li key={e.friendship.id} className="card p-3 flex items-center gap-3">
              <button
                onClick={() => setChatWith(e.person)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                <div className="relative shrink-0">
                  <Avatar first={e.person.first_name} last={e.person.last_name} size={40} url={e.person.avatar_url} />
                  {e.unread > 0 && (
                    <span className="absolute -top-1 -right-1 grid place-items-center min-w-4 h-4 px-1 rounded-full bg-brand-solid text-white text-[10px] font-semibold">
                      {e.unread}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{fullName(e.person)}</p>
                  <p className="text-xs text-content-muted truncate">{e.person.email}</p>
                </div>
              </button>

              <button
                onClick={() => run(`poke-${e.person.id}`, () => poke(me, e.person.id), t('friends.pokeSent'))}
                disabled={busy === `poke-${e.person.id}`}
                title={t('friends.poke')}
                aria-label={t('friends.poke')}
                className="grid place-items-center h-9 w-9 rounded-xl bg-surface-elevated border border-surface-border text-accent shrink-0"
              >
                {busy === `poke-${e.person.id}` ? <Spinner size={15} /> : <Hand size={17} />}
              </button>

              <button
                onClick={() => {
                  if (!confirm(t('friends.removeConfirm'))) return
                  run(e.friendship.id, () => removeFriendship(e.friendship.id, me, e.person.id), t('friends.removed'))
                }}
                disabled={busy === e.friendship.id}
                title={t('friends.remove')}
                aria-label={t('friends.remove')}
                className="grid place-items-center h-9 w-9 rounded-xl text-content-muted hover:text-accent shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}

          {outgoing.map((e) => (
            <li key={e.friendship.id} className="card p-3 flex items-center gap-3 opacity-70">
              <Avatar first={e.person.first_name} last={e.person.last_name} size={40} url={e.person.avatar_url} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{fullName(e.person)}</p>
                <p className="text-xs text-content-muted">{t('friends.pending')}</p>
              </div>
              <button
                onClick={() => run(e.friendship.id, () => removeFriendship(e.friendship.id, me, e.person.id))}
                disabled={busy === e.friendship.id}
                className="grid place-items-center h-9 w-9 rounded-xl text-content-muted hover:text-accent shrink-0"
                aria-label={t('friends.decline')}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {me && (
        <AddFriendSheet
          me={me}
          open={addOpen}
          onClose={() => setAddOpen(false)}
          known={knownIds}
          onInvited={refresh}
        />
      )}

      {me && chatWith && (
        <ChatSheet
          me={me}
          friend={chatWith}
          open={!!chatWith}
          onClose={() => setChatWith(null)}
          onRead={refresh}
        />
      )}
    </div>
  )
}
