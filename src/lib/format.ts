import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function fmtDate(iso: string): string {
  return format(new Date(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR })
}

export function fmtDateTime(iso: string): string {
  return format(new Date(iso), "d 'de' MMM. yyyy, HH:mm", { locale: ptBR })
}

export function fmtTime(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: ptBR })
}

export function fmtRelative(iso: string | null): string {
  if (!iso) return '-'
  return formatDistanceToNow(new Date(iso), { locale: ptBR, addSuffix: true })
}

export function fmtDuration(seconds: number): string {
  if (!seconds) return '0 min'
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `${h}h ${rem}min` : `${h}h`
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase()
}
