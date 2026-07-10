// Diretorio interno: as colunas PUBLICAS de profiles (nome, e-mail, avatar).
//
// A tabela `profiles` so devolve a propria linha (ou tudo, para o admin). Telefone, redes
// sociais e role nao saem daqui. Quem precisa listar/buscar outras pessoas -- compartilhar
// uma nota, adicionar um amigo -- usa a view `directory`.

import { config } from './config'
import { db } from './api'
import { supabase } from './supabase'
import type { PersonRef } from './types'

export const DIRECTORY_COLS = 'id, first_name, last_name, email, avatar_url'

/** No modo demo (sem Supabase) o mockDb ja guarda tudo em localStorage. */
async function mockPeople(): Promise<PersonRef[]> {
  const all = await db.listProfiles()
  return all.map(({ id, first_name, last_name, email, avatar_url }) => ({
    id,
    first_name,
    last_name,
    email,
    avatar_url,
  }))
}

export async function listDirectory(): Promise<PersonRef[]> {
  if (config.mockMode || !supabase) return mockPeople()
  const { data, error } = await supabase.from('directory').select(DIRECTORY_COLS).order('first_name')
  if (error) throw error
  return (data ?? []) as PersonRef[]
}

/** Busca por nome ou e-mail, excluindo eu mesmo e quem ja tem vinculo comigo. */
export async function searchDirectory(me: string, term: string, exclude: string[]): Promise<PersonRef[]> {
  const q = term.trim()
  if (q.length < 2) return []

  const skip = new Set([me, ...exclude])
  if (config.mockMode || !supabase) {
    const lower = q.toLowerCase()
    return (await mockPeople()).filter(
      (p) =>
        !skip.has(p.id) && `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(lower),
    )
  }

  // `,` e `%` e `(` quebram a sintaxe do filtro `or` do PostgREST.
  const safe = q.replace(/[%,()]/g, ' ')
  const { data, error } = await supabase
    .from('directory')
    .select(DIRECTORY_COLS)
    .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`)
    .limit(20)
  if (error) throw error
  return (data ?? []).filter((p) => !skip.has(p.id)) as PersonRef[]
}

export async function directoryByIds(ids: string[]): Promise<Map<string, PersonRef>> {
  if (!ids.length) return new Map()
  if (config.mockMode || !supabase) {
    const all = await mockPeople()
    return new Map(all.filter((p) => ids.includes(p.id)).map((p) => [p.id, p]))
  }
  const { data, error } = await supabase.from('directory').select(DIRECTORY_COLS).in('id', ids)
  if (error) throw error
  return new Map((data ?? []).map((p) => [p.id, p as PersonRef]))
}
