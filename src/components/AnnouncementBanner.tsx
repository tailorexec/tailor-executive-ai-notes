import { useState } from 'react'
import { Info, AlertTriangle, Wrench, Megaphone, X } from 'lucide-react'
import { useAppSettings } from '../app/SettingsProvider'
import { announcementActive } from '../lib/appSettings'
import type { AnnouncementType } from '../lib/types'

const DISMISS_KEY = 'tailor.ann.dismissed'

const STYLES: Record<AnnouncementType, { cls: string; icon: React.ReactNode }> = {
  info: { cls: 'bg-surface-elevated border-surface-border text-content-primary', icon: <Info size={18} /> },
  warning: { cls: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400', icon: <AlertTriangle size={18} /> },
  maintenance: { cls: 'bg-accent/15 border-accent/40 text-content-primary', icon: <Wrench size={18} /> },
  promo: { cls: 'bg-brand-500 border-brand-600 text-white', icon: <Megaphone size={18} /> },
}

export function AnnouncementBanner() {
  const { settings } = useAppSettings()
  const [dismissedVersion, setDismissedVersion] = useState<number>(() => {
    const v = Number(localStorage.getItem(DISMISS_KEY))
    return Number.isFinite(v) ? v : -1
  })

  if (!announcementActive(settings) || !settings) return null
  if (dismissedVersion === settings.announcement_version) return null

  const style = STYLES[settings.announcement_type]

  function dismiss() {
    if (!settings) return
    localStorage.setItem(DISMISS_KEY, String(settings.announcement_version))
    setDismissedVersion(settings.announcement_version)
  }

  return (
    <div className={`flex items-start gap-3 border rounded-2xl px-4 py-3 mb-4 ${style.cls}`}>
      <span className="shrink-0 mt-0.5">{style.icon}</span>
      <p className="flex-1 text-sm leading-relaxed whitespace-pre-line">{settings.announcement_message}</p>
      <button onClick={dismiss} aria-label="Fechar aviso" className="shrink-0 opacity-70 hover:opacity-100">
        <X size={18} />
      </button>
    </div>
  )
}
