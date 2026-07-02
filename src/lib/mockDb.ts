// localStorage-backed implementation of Db. Lets the whole app run without
// any backend or API keys. NOT for production auth (passwords are local only).

import { config, isAdminEmail, isAllowedDomain } from './config'
import { deleteAudio } from './audioStore'
import type { Db, SignUpInput } from './db'
import { uid } from './db'
import type {
  AdminUserRow,
  Note,
  Profile,
  UsageEvent,
  UsageEventType,
} from './types'

const K = {
  session: 'tailor.session',
  profiles: 'tailor.profiles',
  passwords: 'tailor.passwords',
  notes: 'tailor.notes',
  usage: 'tailor.usage',
  seeded: 'tailor.seeded.v2',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function seed(): void {
  if (localStorage.getItem(K.seeded)) return

  // Cria SOMENTE a conta de administrador para permitir o primeiro acesso.
  // Nenhuma nota, metrica ou usuario de exemplo: o painel Admin passa a refletir
  // exclusivamente o uso real feito dentro do app.
  const admin: Profile = {
    id: uid('u_'),
    first_name: 'Flavio',
    last_name: 'Junior',
    email: config.adminEmail,
    phone: '+55 11 90000-0000',
    role: 'admin',
    created_at: new Date().toISOString(),
  }

  // Migracao: limpa qualquer dado de seed antigo (usuarios/notas/eventos de exemplo).
  write(K.profiles, [admin])
  write(K.passwords, { [admin.email]: 'Tailor@007' })
  write(K.notes, [])
  write(K.usage, [])

  localStorage.setItem(K.seeded, '1')
}

function getProfiles(): Profile[] {
  return read<Profile[]>(K.profiles, [])
}

/** Limpeza preguicosa (modo demo): remove o audio de notas expiradas (>N dias, sem keep_audio). */
function cleanupExpiredAudio(): void {
  const notes = read<Note[]>(K.notes, [])
  const cutoff = Date.now() - config.audioRetentionDays * 86400000
  let changed = false
  for (const n of notes) {
    if (
      !n.keep_audio &&
      !n.audio_deleted_at &&
      n.audio_url &&
      Date.parse(n.created_at) < cutoff
    ) {
      deleteAudio(n.audio_url) // apaga o blob no IndexedDB (fire-and-forget)
      n.audio_url = null
      n.audio_deleted_at = new Date().toISOString()
      changed = true
    }
  }
  if (changed) write(K.notes, notes)
}

export const mockDb: Db = {
  async getCurrentProfile() {
    seed()
    const id = localStorage.getItem(K.session)
    if (!id) return null
    return getProfiles().find((p) => p.id === id) ?? null
  },

  async signIn(email, password) {
    seed()
    const normalized = email.trim().toLowerCase()
    const passwords = read<Record<string, string>>(K.passwords, {})
    const profile = getProfiles().find((p) => p.email.toLowerCase() === normalized)
    if (!profile || passwords[profile.email] !== password) {
      throw new Error('E-mail ou senha invalidos.')
    }
    localStorage.setItem(K.session, profile.id)
    return profile
  },

  async signUp(input: SignUpInput) {
    seed()
    const email = input.email.trim().toLowerCase()
    if (!isAllowedDomain(email)) {
      throw new Error(`Apenas e-mails @${config.allowedDomain} podem se cadastrar.`)
    }
    const profiles = getProfiles()
    if (profiles.some((p) => p.email.toLowerCase() === email)) {
      throw new Error('Ja existe uma conta com este e-mail.')
    }
    const profile: Profile = {
      id: uid('u_'),
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      email,
      phone: input.phone.trim(),
      role: isAdminEmail(email) ? 'admin' : 'member',
      created_at: new Date().toISOString(),
    }
    profiles.push(profile)
    write(K.profiles, profiles)
    const passwords = read<Record<string, string>>(K.passwords, {})
    passwords[email] = input.password
    write(K.passwords, passwords)
    localStorage.setItem(K.session, profile.id)
    return profile
  },

  async signOut() {
    localStorage.removeItem(K.session)
  },

  async listProfiles() {
    seed()
    return getProfiles()
  },

  async adminUpdateUser(id, patch) {
    const profiles = getProfiles()
    const idx = profiles.findIndex((p) => p.id === id)
    if (idx === -1) return
    profiles[idx] = {
      ...profiles[idx],
      first_name: patch.first_name,
      last_name: patch.last_name,
      email: patch.email.trim().toLowerCase(),
    }
    write(K.profiles, profiles)
  },

  async adminDeleteUser(id) {
    write(K.profiles, getProfiles().filter((p) => p.id !== id))
    const notes = read<Note[]>(K.notes, [])
    write(K.notes, notes.filter((n) => n.user_id !== id))
    const usage = read<UsageEvent[]>(K.usage, [])
    write(K.usage, usage.filter((e) => e.user_id !== id))
  },

  async listNotes(userId) {
    seed()
    cleanupExpiredAudio()
    const notes = read<Note[]>(K.notes, [])
    return notes
      .filter((n) => !n.deleted_at && (n.user_id === userId || n.shared_with.includes(userId)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async listTrash(userId) {
    const notes = read<Note[]>(K.notes, [])
    return notes
      .filter((n) => n.deleted_at && n.user_id === userId)
      .sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))
  },

  async restoreNote(id) {
    const notes = read<Note[]>(K.notes, [])
    const idx = notes.findIndex((n) => n.id === id)
    if (idx !== -1) {
      notes[idx].deleted_at = null
      write(K.notes, notes)
    }
  },

  async deleteNotePermanent(id) {
    const notes = read<Note[]>(K.notes, [])
    write(K.notes, notes.filter((n) => n.id !== id))
  },

  async getNote(id) {
    cleanupExpiredAudio()
    const notes = read<Note[]>(K.notes, [])
    return notes.find((n) => n.id === id) ?? null
  },

  async createNote(input) {
    const notes = read<Note[]>(K.notes, [])
    const now = new Date().toISOString()
    const note: Note = {
      id: uid('n_'),
      user_id: input.user_id,
      title: input.title,
      emoji: input.emoji ?? null,
      type: input.type ?? 'recording',
      template: input.template ?? 'geral',
      context: input.context ?? '',
      folder: input.folder ?? null,
      duration_seconds: input.duration_seconds ?? 0,
      audio_url: input.audio_url ?? null,
      language: input.language ?? 'pt-BR',
      transcript: input.transcript ?? '',
      summary: input.summary ?? '',
      detailed_summary: input.detailed_summary ?? null,
      analysis: input.analysis ?? null,
      mindmap: input.mindmap ?? null,
      action_items: input.action_items ?? [],
      chat: input.chat ?? [],
      shared_with: input.shared_with ?? [],
      status: input.status ?? 'processing',
      keep_audio: input.keep_audio ?? false,
      audio_deleted_at: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    }
    notes.push(note)
    write(K.notes, notes)
    return note
  },

  async updateNote(id, patch) {
    const notes = read<Note[]>(K.notes, [])
    const idx = notes.findIndex((n) => n.id === id)
    if (idx === -1) throw new Error('Nota nao encontrada.')
    notes[idx] = { ...notes[idx], ...patch, updated_at: new Date().toISOString() }
    write(K.notes, notes)
    return notes[idx]
  },

  async deleteNote(id) {
    const notes = read<Note[]>(K.notes, [])
    const idx = notes.findIndex((n) => n.id === id)
    if (idx !== -1) {
      notes[idx].deleted_at = new Date().toISOString()
      write(K.notes, notes)
    }
  },

  async logUsage(userId, type, noteId = null) {
    const usage = read<UsageEvent[]>(K.usage, [])
    usage.push({ id: uid('e_'), user_id: userId, note_id: noteId, type, created_at: new Date().toISOString() })
    write(K.usage, usage)
  },

  async listUsage() {
    return read<UsageEvent[]>(K.usage, [])
  },

  async adminRows(): Promise<AdminUserRow[]> {
    seed()
    const profiles = getProfiles()
    const notes = read<Note[]>(K.notes, [])
    const usage = read<UsageEvent[]>(K.usage, [])
    const aiTypes: UsageEventType[] = ['ai_summary', 'ai_detailed', 'ai_analysis', 'ai_chat']

    return profiles.map((profile) => {
      const uEvents = usage.filter((e) => e.user_id === profile.id)
      const userNotes = notes.filter((n) => n.user_id === profile.id)
      const last = uEvents
        .map((e) => e.created_at)
        .concat(userNotes.map((n) => n.created_at))
        .sort()
        .pop()
      return {
        profile,
        notesCount: userNotes.length,
        recordings: uEvents.filter((e) => e.type === 'recording').length,
        transcriptions: uEvents.filter((e) => e.type === 'transcription').length,
        aiSuggestions: uEvents.filter((e) => aiTypes.includes(e.type)).length,
        ttsCount: uEvents.filter((e) => e.type === 'tts').length,
        lastActivity: last ?? null,
      }
    })
  },
}
