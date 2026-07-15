import { logClientError } from './auditLog'
import { describeUnknownError } from './errorMessage'

export interface NotifPrefs {
  shared: boolean // nova transcricao compartilhada comigo
  announcements: boolean // novidades e avisos
  calendar: boolean // evento proximo (depende do calendario)
}

const KEY = 'tailor.notif'
const DEFAULTS: NotifPrefs = { shared: true, announcements: true, calendar: false }

export function getNotifPrefs(): NotifPrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

export function setNotifPrefs(p: NotifPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function notifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function ensureNotifPermission(): Promise<boolean> {
  if (!notifSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const r = await Notification.requestPermission()
  return r === 'granted'
}

export function notify(title: string, body: string): void {
  if (notifSupported() && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/pwa-192.png' })
    } catch (err) {
      // O usuario nunca ve o popup nem sabe por que -- so aparece "sem lembrete".
      logClientError({
        severity: 'warning',
        category: 'silent',
        source: 'client:notifications',
        message: describeUnknownError(err),
      })
    }
  }
}
