import type { Note, Profile, RetentionDays } from './types'
import { RETENTION_DEFAULT } from './types'

/** O periodo escolhido pelo usuario em Config > Preferencias. */
export function retentionOf(profile: Profile | null | undefined): RetentionDays {
  return profile?.audio_retention_days ?? RETENTION_DEFAULT
}

/**
 * Dias que faltam para o cron apagar o AUDIO desta nota.
 * Retorna null quando nao ha nada a apagar (sem audio, ja apagado, ou marcado para manter).
 */
export function audioDaysLeft(note: Note, days: RetentionDays): number | null {
  if (!note.audio_url || note.keep_audio || note.audio_deleted_at) return null
  const created = Date.parse(note.created_at)
  if (Number.isNaN(created)) return null
  const elapsed = (Date.now() - created) / 86400000
  return Math.max(0, Math.ceil(days - elapsed))
}

/** Faixa em que vale a pena avisar o usuario no card da Home. */
export const EXPIRY_WARN_DAYS = 3
