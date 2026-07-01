// Supabase-backed implementation of Db (production path).
// Requires the schema in supabase/migrations and the edge functions.

import { supabase } from './supabase'
import { config, isAdminEmail, isAllowedDomain } from './config'
import type { Db, SignUpInput } from './db'
import type { AdminUserRow, Note, Profile, UsageEvent, UsageEventType } from './types'

function client() {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}

/** Remove sessao persistida (auto-recuperacao de estado corrompido no navegador). */
function purgeAuthStorage() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

function isFetchHeaderError(e: unknown): boolean {
  return e instanceof TypeError || /ISO-8859-1|headers|fetch/i.test((e as Error)?.message ?? '')
}

function rowToProfile(r: Record<string, unknown>): Profile {
  return {
    id: r.id as string,
    first_name: (r.first_name as string) ?? '',
    last_name: (r.last_name as string) ?? '',
    email: (r.email as string) ?? '',
    phone: (r.phone as string) ?? '',
    role: (r.role as Profile['role']) ?? 'member',
    created_at: (r.created_at as string) ?? new Date().toISOString(),
  }
}

export const supabaseDb: Db = {
  async getCurrentProfile() {
    const sb = client()
    try {
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) return null
      const { data, error } = await sb.from('profiles').select('*').eq('id', auth.user.id).single()
      if (error || !data) return null
      return rowToProfile(data)
    } catch (e) {
      // Sessao corrompida no navegador -> limpa e recomeca sem sessao.
      if (isFetchHeaderError(e)) purgeAuthStorage()
      return null
    }
  },

  async signIn(email, password) {
    const sb = client()
    const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw new Error('E-mail ou senha invalidos.')
    const profile = await this.getCurrentProfile()
    if (!profile) throw new Error('Perfil nao encontrado.')
    return profile
  },

  async signUp(input: SignUpInput) {
    const sb = client()
    const email = input.email.trim().toLowerCase()
    if (!isAllowedDomain(email)) {
      throw new Error(`Apenas e-mails @${config.allowedDomain} podem se cadastrar.`)
    }

    let data
    try {
      const res = await sb.auth.signUp({
        email,
        password: input.password,
        options: {
          data: {
            first_name: input.first_name.trim(),
            last_name: input.last_name.trim(),
            phone: input.phone.trim(),
            role: isAdminEmail(email) ? 'admin' : 'member',
          },
        },
      })
      if (res.error) throw new Error(res.error.message)
      data = res.data
    } catch (e) {
      if (e instanceof TypeError) {
        throw new Error('Nao foi possivel conectar ao servidor. Verifique sua conexao e as chaves do Supabase.')
      }
      throw e
    }

    // Sem sessao imediata: como os usuarios sao auto-confirmados no banco,
    // fazemos login em seguida para uma experiencia continua.
    if (!data.session) {
      const signInRes = await sb.auth.signInWithPassword({ email, password: input.password })
      if (signInRes.error) {
        throw new Error(
          'Conta criada, mas nao foi possivel entrar automaticamente. Tente fazer login.',
        )
      }
    }

    // A trigger handle_new_user cria o profile; garantimos com um fallback tolerante a RLS.
    const userId = data.user?.id
    if (userId) {
      await sb
        .from('profiles')
        .upsert({
          id: userId,
          first_name: input.first_name.trim(),
          last_name: input.last_name.trim(),
          email,
          phone: input.phone.trim(),
          role: isAdminEmail(email) ? 'admin' : 'member',
        })
        .then(undefined, () => {}) // ignora erro (o trigger ja cuidou)
    }

    // Pequena espera para a trigger materializar o profile, com retry.
    for (let i = 0; i < 3; i++) {
      const profile = await this.getCurrentProfile()
      if (profile) return profile
      await new Promise((r) => setTimeout(r, 400))
    }
    throw new Error('Conta criada, mas o perfil ainda nao ficou disponivel. Recarregue e tente entrar.')
  },

  async signOut() {
    await client().auth.signOut()
  },

  async listProfiles() {
    const { data, error } = await client().from('profiles').select('*').order('created_at')
    if (error) throw error
    return (data ?? []).map(rowToProfile)
  },

  async listNotes(userId) {
    const { data, error } = await client()
      .from('notes')
      .select('*')
      .is('deleted_at', null)
      .or(`user_id.eq.${userId},shared_with.cs.{${userId}}`)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as Note[]
  },

  async listTrash(userId) {
    const { data, error } = await client()
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as Note[]
  },

  async restoreNote(id) {
    const { error } = await client().from('notes').update({ deleted_at: null }).eq('id', id)
    if (error) throw error
  },

  async deleteNotePermanent(id) {
    const { error } = await client().from('notes').delete().eq('id', id)
    if (error) throw error
  },

  async getNote(id) {
    const { data, error } = await client().from('notes').select('*').eq('id', id).single()
    if (error) return null
    return data as unknown as Note
  },

  async createNote(input) {
    const { data, error } = await client().from('notes').insert(input).select().single()
    if (error) throw error
    return data as unknown as Note
  },

  async updateNote(id, patch) {
    const { data, error } = await client()
      .from('notes')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as unknown as Note
  },

  async deleteNote(id) {
    // Soft-delete: vai para a lixeira.
    const { error } = await client()
      .from('notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async logUsage(userId, type, noteId = null) {
    await client().from('usage_events').insert({ user_id: userId, type, note_id: noteId })
  },

  async listUsage() {
    const { data, error } = await client().from('usage_events').select('*')
    if (error) throw error
    return (data ?? []) as unknown as UsageEvent[]
  },

  async adminRows(): Promise<AdminUserRow[]> {
    const [profiles, notes, usage] = await Promise.all([
      this.listProfiles(),
      client().from('notes').select('id,user_id,created_at'),
      this.listUsage(),
    ])
    const noteRows = (notes.data ?? []) as { id: string; user_id: string; created_at: string }[]
    const aiTypes: UsageEventType[] = ['ai_summary', 'ai_detailed', 'ai_analysis', 'ai_chat']

    return profiles.map((profile) => {
      const uEvents = usage.filter((e) => e.user_id === profile.id)
      const userNotes = noteRows.filter((n) => n.user_id === profile.id)
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
