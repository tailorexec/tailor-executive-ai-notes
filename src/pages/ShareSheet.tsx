import { useEffect, useMemo, useState } from 'react'
import { FileText, FileType, Mail, Copy, Check, Users, Share as ShareIcon, AudioLines, ScrollText, Search } from 'lucide-react'
import { db } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import type { Note, PersonRef } from '../lib/types'
import { Avatar, Sheet } from '../components/ui'
import { listAcceptedFriends } from '../lib/friends'
import { listDirectory } from '../lib/directory'
import { useT } from '../lib/i18n'
import {
  copyToClipboard,
  exportPdf,
  exportWord,
  exportTranscript,
  nativeShare,
  shareEmail,
  shareWhatsApp,
  slugify,
} from '../lib/share'
import { downloadAudio } from '../lib/audioStore'

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.15-1.7-.84-2-.94-.26-.1-.46-.15-.65.15-.2.3-.75.94-.92 1.13-.17.2-.34.22-.63.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.34.44-.5.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.65-1.57-.9-2.15-.24-.56-.48-.48-.65-.5h-.56c-.2 0-.5.07-.77.37-.26.3-1 1-1 2.42s1.03 2.8 1.17 3c.15.2 2.03 3.1 4.92 4.35.69.3 1.22.47 1.64.6.69.22 1.31.2 1.8.12.55-.08 1.7-.7 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.2-.56-.34z M12 2a10 10 0 0 0-8.6 15.06L2 22l5.06-1.33A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3 .79.8-2.92-.2-.31A8.2 8.2 0 1 1 12 20.2z" />
    </svg>
  )
}

export function ShareSheet({
  note,
  open,
  onClose,
  onUpdated,
}: {
  note: Note
  open: boolean
  onClose: () => void
  onUpdated: (n: Note) => void
}) {
  const { profile } = useAuth()
  const t = useT()
  const [partners, setPartners] = useState<PersonRef[]>([])
  const [term, setTerm] = useState('')
  const [copied, setCopied] = useState(false)
  const [savingShare, setSavingShare] = useState(false)

  // So amigos aceitos podem receber a nota. Quem ja recebeu antes continua na lista
  // (ainda que nao seja amigo) para que dê para revogar o compartilhamento.
  useEffect(() => {
    if (!profile) return
    const me = profile.id
    Promise.all([listAcceptedFriends(me), listDirectory()])
      .then(([friends, all]) => {
        const known = new Set(friends.map((f) => f.id))
        const legacy = all.filter((p) => note.shared_with.includes(p.id) && !known.has(p.id) && p.id !== me)
        setPartners([...friends, ...legacy])
      })
      .catch(() => setPartners([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const visible = useMemo(() => {
    const q = term.trim().toLowerCase()
    if (!q) return partners
    return partners.filter((p) =>
      `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(q),
    )
  }, [partners, term])

  async function togglePartner(id: string) {
    setSavingShare(true)
    const shared = note.shared_with.includes(id)
      ? note.shared_with.filter((x) => x !== id)
      : [...note.shared_with, id]
    const updated = await db.updateNote(note.id, { shared_with: shared })
    onUpdated(updated)
    setSavingShare(false)
  }

  async function onCopy() {
    await copyToClipboard(note)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const channels = [
    { label: 'WhatsApp', icon: <WhatsAppIcon />, onClick: () => shareWhatsApp(note) },
    { label: 'E-mail', icon: <Mail size={20} />, onClick: () => shareEmail(note) },
    { label: 'PDF', icon: <FileText size={20} />, onClick: () => exportPdf(note) },
    { label: 'Word', icon: <FileType size={20} />, onClick: () => exportWord(note) },
    { label: t('sh.transcript'), icon: <ScrollText size={20} />, onClick: () => exportTranscript(note) },
    ...(note.audio_url
      ? [{ label: t('sh.audio'), icon: <AudioLines size={20} />, onClick: () => downloadAudio(note.audio_url, `${slugify(note.title)}.webm`) }]
      : []),
    { label: copied ? t('sh.copied') : t('sh.copy'), icon: copied ? <Check size={20} /> : <Copy size={20} />, onClick: onCopy },
  ]

  return (
    <Sheet open={open} onClose={onClose} title={t('sh.title')}>
      <div className="grid grid-cols-5 gap-2 mb-6">
        {channels.map((c) => (
          <button
            key={c.label}
            onClick={c.onClick}
            className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-surface-elevated border border-surface-border hover:border-accent/40 transition-colors"
          >
            <span className="text-accent">{c.icon}</span>
            <span className="text-[11px] text-content-secondary">{c.label}</span>
          </button>
        ))}
      </div>

      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button className="btn-outline w-full mb-6" onClick={() => nativeShare(note)}>
          <ShareIcon size={18} />
          {t('sh.moreDevice')}
        </button>
      )}

      <div>
        <h3 className="flex items-center gap-2 font-display font-semibold mb-1">
          <Users size={18} className="text-accent" /> {t('sh.withPartners')}
        </h3>
        <p className="text-sm text-content-muted mb-3">{t('sh.partnersDesc')}</p>

        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
          <input
            className="input pl-9"
            placeholder={t('sh.searchPartners')}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
          {partners.length === 0 ? (
            <p className="text-sm text-content-muted py-4 text-center">{t('sh.noFriends')}</p>
          ) : (
            visible.length === 0 && (
              <p className="text-sm text-content-muted py-4 text-center">{t('friends.noResults')}</p>
            )
          )}
          {visible.map((p) => {
            const active = note.shared_with.includes(p.id)
            return (
              <button
                key={p.id}
                onClick={() => togglePartner(p.id)}
                disabled={savingShare}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 border text-left transition-colors ${
                  active ? 'border-brand-solid bg-accent/5' : 'border-surface-border bg-surface-elevated'
                }`}
              >
                <Avatar first={p.first_name} last={p.last_name} size={36} url={p.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-xs text-content-muted truncate">{p.email}</p>
                </div>
                <span
                  className={`h-6 w-6 rounded-full grid place-items-center border shrink-0 ${
                    active ? 'bg-brand-solid border-brand-solid text-white' : 'border-surface-border'
                  }`}
                >
                  {active && <Check size={14} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}
