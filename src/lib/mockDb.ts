// localStorage-backed implementation of Db. Lets the whole app run without
// any backend or API keys. NOT for production auth (passwords are local only).

import { config, isAdminEmail, isAllowedDomain } from './config'
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

  async listNotes(userId) {
    seed()
    const notes = read<Note[]>(K.notes, [])
    return notes
      .filter((n) => n.user_id === userId || n.shared_with.includes(userId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async getNote(id) {
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
      folder: input.folder ?? null,
      duration_seconds: input.duration_seconds ?? 0,
      audio_url: input.audio_url ?? null,
      language: input.language ?? 'pt-BR',
      transcript: input.transcript ?? '',
      summary: input.summary ?? '',
      detailed_summary: input.detailed_summary ?? null,
      analysis: input.analysis ?? null,
      action_items: input.action_items ?? [],
      chat: input.chat ?? [],
      shared_with: input.shared_with ?? [],
      status: input.status ?? 'processing',
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
    write(
      K.notes,
      notes.filter((n) => n.id !== id),
    )
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
