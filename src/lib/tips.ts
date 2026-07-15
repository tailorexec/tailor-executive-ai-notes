// Dicas exibidas na Home. Fala direto com o Supabase, fora da interface `Db` (mesmo padrao de
// friends.ts) -- sem Supabase configurado (modo mock), tudo vira no-op.

import { supabase } from './supabase'
import type { Tip } from './types'

function client() {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}

export const tipsEnabled = () => !!supabase

/** So as ativas, mais antiga primeiro (fila) -- usado pela Home. */
export async function listActiveTips(): Promise<Tip[]> {
  if (!supabase) return []
  const { data, error } = await client()
    .from('tips')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Tip[]
}

/** Todas (inclusive inativas) -- admin only, RLS garante isso do lado do banco. */
export async function adminListTips(): Promise<Tip[]> {
  if (!supabase) return []
  const { data, error } = await client()
    .from('tips')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tip[]
}

export async function createTip(input: {
  body: string
  title?: string | null
  electron_only?: boolean
  created_by: string
}): Promise<Tip> {
  const { data, error } = await client()
    .from('tips')
    .insert({
      body: input.body.trim(),
      title: input.title?.trim() || null,
      electron_only: input.electron_only ?? false,
      created_by: input.created_by,
    })
    .select()
    .single()
  if (error) throw error
  return data as Tip
}

export async function setTipActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().from('tips').update({ active }).eq('id', id)
  if (error) throw error
}

export async function deleteTip(id: string): Promise<void> {
  const { error } = await client().from('tips').delete().eq('id', id)
  if (error) throw error
}
