// Supabase-backed implementation of Db (production path).
// Requires the schema in supabase/migrations and the edge functions.

import { supabase } from './supabase'
import { config, isAdminEmail, isAllowedDomain } from './config'
import type { Db, SignUpInput } from './db'
import type {
  AdminUserRow,
  Folder,
  Note,
  Profile,
  SupportTicket,
  UsageEvent,
  UsageEventType,
} from './types'
import { RETENTION_DEFAULT } from './types'

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
    avatar_url: (r.avatar_url as string | null) ?? null,
    audio_retention_days:
      (r.audio_retention_days as Profile['audio_retention_days']) ?? RETENTION_DEFAULT,
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
    try {
      const { error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        const message = (error.message ?? '').toLowerCase()
        if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
          throw new Error(
            'Nao foi possivel conectar ao Supabase. Verifique as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente (Vercel/Netlify) e se o projeto esta ativo.',
          )
        }
        throw new Error('E-mail ou senha invalidos.')
      }

      const profile = await this.getCurrentProfile()
      if (!profile) throw new Error('Perfil nao encontrado.')
      return profile
    } catch (e) {
      if (isFetchHeaderError(e)) {
        purgeAuthStorage()
        throw new Error(
          'Nao foi possivel conectar ao servidor. Verifique sua conexao e as chaves do Supabase no ambiente de deploy.',
        )
      }
      throw e
    }
  },

  async signUp(input: SignUpInput) {
    const sb = client()
    const email = input.email.trim().toLowerCase()
    const firstName = input.first_name.trim()
    const lastName = input.last_name.trim()
    const phone = input.phone.trim()
    const role = isAdminEmail(email) ? 'admin' : 'member'

    if (!isAllowedDomain(email)) {
      throw new Error(`Apenas e-mails @${config.allowedDomain} podem se cadastrar.`)
    }

    let data
    try {
      // Keep auth metadata ASCII-only. Some browser/Supabase paths can surface
      // user metadata through RequestInit headers before a request is sent.
      const res = await sb.auth.signUp({
        email,
        password: input.password,
        options: {
          data: {
            role,
          },
        },
      })
      if (res.error) throw new Error(res.error.message)
      data = res.data
    } catch (e) {
      if (isFetchHeaderError(e)) {
        purgeAuthStorage()
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
      const { error: profileError } = await sb
        .from('profiles')
        .upsert({
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          role,
        })
      if (profileError) throw profileError
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

  async updateMyProfile(id, patch) {
    const { data, error } = await client().from('profiles').update(patch).eq('id', id).select().single()
    if (error) throw error
    return rowToProfile(data)
  },

  async adminUpdateUser(id, patch) {
    const { data, error } = await client().functions.invoke('admin-users', {
      body: { action: 'update', id, ...patch },
    })
    if (error) throw error
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  },

  async adminDeleteUser(id) {
    const { data, error } = await client().functions.invoke('admin-users', {
      body: { action: 'delete', id },
    })
    if (error) throw error
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error)
  },

  async listFolders(userId) {
    const { data, error } = await client().from('folders').select('*').eq('user_id', userId).order('name')
    if (error) throw error
    return (data ?? []) as Folder[]
  },

  async createFolder(userId, name, color) {
    const { data, error } = await client()
      .from('folders')
      .insert({ user_id: userId, name, color })
      .select()
      .single()
    if (error) throw error
    return data as Folder
  },

  async updateFolder(id, patch) {
    const { error } = await client().from('folders').update(patch).eq('id', id)
    if (error) throw error
  },

  async deleteFolder(id) {
    const { error } = await client().from('folders').delete().eq('id', id)
    if (error) throw error
  },

  async createTicket(input) {
    const { error } = await client().from('support_tickets').insert(input)
    if (error) throw error
  },

  async listTickets() {
    const { data, error } = await client()
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    const tickets = (data ?? []) as SupportTicket[]
    const profiles = await this.listProfiles()
    return tickets.map((t) => ({ ...t, profile: profiles.find((p) => p.id === t.user_id) }))
  },

  async listMyTickets(userId) {
    const { data, error } = await client()
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as SupportTicket[]
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
    // `select()` para saber se a RLS deixou passar: sem ele, tentar excluir uma nota de
    // outra pessoa afeta 0 linhas e retorna sucesso, e a UI mentiria para o usuario.
    const { data, error } = await client()
      .from('notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new Error('Voce nao tem permissao para excluir esta nota.')
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
