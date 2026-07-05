import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  FileLock2,
  LogOut,
  Moon,
  ScrollText,
  ShieldCheck,
  Sun,
  Bell,
  HelpCircle,
  Trash2,
  LifeBuoy,
  Camera,
  Pencil,
  Download,
  Languages,
  Check,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import { Avatar, Sheet, Spinner } from '../components/ui'
import { useToast } from '../components/Toast'
import { Logo } from '../components/Logo'
import { uploadAvatar } from '../lib/avatar'
import { db } from '../lib/api'
import { exportNotesMarkdown } from '../lib/share'
import { langLabel, LANGS } from '../lib/lang'
import { useI18n } from '../lib/i18n'

function Row({
  icon,
  label,
  onClick,
  danger,
  right,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  danger?: boolean
  right?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left ${
        danger ? 'text-accent' : 'text-content-primary'
      }`}
    >
      <span className={danger ? 'text-accent' : 'text-content-secondary'}>{icon}</span>
      <span className="flex-1 font-medium">{label}</span>
      {right ?? <ChevronRight size={18} className="text-content-muted" />}
    </button>
  )
}

export function Settings() {
  const { profile, isAdmin, signOut, updateProfile } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const { lang, setLang, t } = useI18n()
  const fileRef = useRef<HTMLInputElement | null>(null)

  if (!profile) return null

  async function exportData() {
    if (!profile) return
    setExporting(true)
    try {
      const notes = await db.listNotes(profile.id)
      exportNotesMarkdown(notes, `${profile.first_name} ${profile.last_name}`)
      toast(t('settings.exported'))
    } catch {
      toast('Não foi possível exportar os dados', 'error')
    } finally {
      setExporting(false)
    }
  }

  function openEdit() {
    setFirst(profile!.first_name)
    setLast(profile!.last_name)
    setEditOpen(true)
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    try {
      const url = await uploadAvatar(profile.id, file)
      if (url) await updateProfile({ avatar_url: url })
    } finally {
      setUploading(false)
    }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      await updateProfile({ first_name: first.trim(), last_name: last.trim() })
      setEditOpen(false)
      toast(t('settings.profileUpdated'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 pt-6 safe-top">
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold">{t('settings.title')}</h1>
      </header>

      <div className="card p-5 flex items-center gap-4 mb-6">
        <button onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label="Trocar foto">
          <Avatar first={profile.first_name} last={profile.last_name} size={56} url={profile.avatar_url} />
          <span className="absolute -bottom-1 -right-1 grid place-items-center h-6 w-6 rounded-full bg-brand-500 text-white border-2 border-surface-card">
            {uploading ? <Spinner size={12} /> : <Camera size={12} />}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold text-lg truncate">
            {profile.first_name} {profile.last_name}
          </p>
          <p className="text-content-muted text-sm truncate">{profile.email}</p>
          <p className="text-content-muted text-sm">{profile.phone}</p>
        </div>
        <button onClick={openEdit} className="grid place-items-center h-9 w-9 rounded-full bg-surface-elevated border border-surface-border text-content-secondary" aria-label={t('settings.editProfile')}>
          <Pencil size={16} />
        </button>
      </div>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title={t('settings.editProfile')}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">{t('settings.firstName')}</label>
            <input className="input" value={first} onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div>
            <label className="label">{t('settings.lastName')}</label>
            <input className="input" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        </div>
        <button className="btn-outline w-full mb-3" onClick={() => fileRef.current?.click()}>
          <Camera size={18} /> {t('settings.changePhoto')}
        </button>
        <button className="btn-primary w-full" onClick={saveProfile} disabled={saving}>
          {saving ? <Spinner /> : t('common.save')}
        </button>
      </Sheet>

      {isAdmin && (
        <div className="card divide-y divide-surface-border mb-6">
          <Row
            icon={<ShieldCheck size={20} className="text-accent" />}
            label={t('settings.adminPanel')}
            onClick={() => navigate('/admin')}
          />
        </div>
      )}

      <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">{t('settings.prefs')}</p>
      <div className="card divide-y divide-surface-border mb-6">
        <Row
          icon={theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
          label={t('settings.darkTheme')}
          onClick={toggle}
          right={
            <span
              className={`h-6 w-11 rounded-full transition-colors relative ${
                theme === 'dark' ? 'bg-brand-500' : 'bg-surface-border'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </span>
          }
        />
        <Row
          icon={<Bell size={20} />}
          label={t('settings.notifications')}
          onClick={() => navigate('/notificacoes')}
        />
        <Row
          icon={<Languages size={20} />}
          label={t('settings.appLang')}
          onClick={() => setLangOpen(true)}
          right={
            <span className="flex items-center gap-1 text-sm text-content-muted">
              {langLabel(lang)}
              <ChevronRight size={18} />
            </span>
          }
        />
      </div>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('settings.appLang')}>
        <div className="space-y-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code)
                setLangOpen(false)
                toast(t('settings.langChanged'))
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                lang === l.code
                  ? 'border-brand-500 bg-accent/10'
                  : 'border-surface-border bg-surface-elevated hover:border-accent/40'
              }`}
            >
              <span className="font-medium">{l.label}</span>
              {lang === l.code && <Check size={18} className="text-accent" />}
            </button>
          ))}
        </div>
        <p className="text-xs text-content-muted mt-4">{t('settings.langNote')}</p>
      </Sheet>

      <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">{t('settings.myData')}</p>
      <div className="card divide-y divide-surface-border mb-6">
        <Row
          icon={<Download size={20} />}
          label={t('settings.exportData')}
          onClick={exportData}
          right={exporting ? <Spinner size={16} /> : undefined}
        />
        <Row icon={<Trash2 size={20} />} label={t('settings.trash')} onClick={() => navigate('/lixeira')} />
      </div>

      <p className="text-xs uppercase tracking-wide text-content-muted mb-2 px-1">{t('settings.support')}</p>
      <div className="card divide-y divide-surface-border mb-6">
        <Row icon={<LifeBuoy size={20} />} label={t('settings.contactSupport')} onClick={() => navigate('/suporte')} />
        <Row icon={<HelpCircle size={20} />} label={t('settings.helpCenter')} onClick={() => navigate('/ajuda')} />
        <Row icon={<ScrollText size={20} />} label={t('settings.terms')} onClick={() => navigate('/termos')} />
        <Row icon={<FileLock2 size={20} />} label={t('settings.privacy')} onClick={() => navigate('/privacidade')} />
      </div>

      <div className="card mb-8">
        <Row icon={<LogOut size={20} />} label={t('settings.logout')} danger onClick={signOut} right={<span />} />
      </div>

      <div className="flex flex-col items-center gap-2 pb-4 text-content-muted">
        <Logo size="lg" />
        <p className="text-xs">ANA by Tailor • v0.2.3</p>
      </div>
    </div>
  )
}
