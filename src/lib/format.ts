import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Datas 'YYYY-MM-DD' sem hora (como as de `<input type="date">`, usadas no prazo das
 * tarefas) sao interpretadas pelo motor JS como meia-noite UTC. Em fuso negativo (Brasil,
 * UTC-3), isso exibe o dia ANTERIOR ao que o usuario escolheu. Aqui elas viram meia-noite
 * LOCAL; timestamps completos (com hora) passam direto, sem mudanca de comportamento.
 */
function toLocalDate(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso)
}

export function fmtDate(iso: string): string {
  return format(toLocalDate(iso), "d 'de' MMM. 'de' yyyy", { locale: ptBR })
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
