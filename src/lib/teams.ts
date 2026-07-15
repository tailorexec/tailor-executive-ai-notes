// Gerente/Senior (equipe). Fala direto com o Supabase, fora da interface `Db` (mesmo padrao de
// friends.ts) -- sem Supabase configurado (modo mock), tudo vira no-op.

import { supabase } from './supabase'
import { directoryByIds, searchDirectory } from './directory'
import type { PersonRef, TeamEdge, TeamGroup, TeamLink } from './types'

function client() {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}

export const teamsEnabled = () => !!supabase

/** Toda a equipe de um manager (aceitos + convites pendentes que ELE enviou). */
export async function listMyTeam(managerId: string): Promise<TeamEdge[]> {
  if (!supabase) return []
  const c = client()

  const { data: links, error } = await c
    .from('team_links')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (links ?? []) as TeamLink[]
  if (!rows.length) return []

  const byId = await directoryByIds(rows.map((l) => l.member_id))

  return rows.flatMap((link) => {
    const person = byId.get(link.member_id)
    if (!person) return [] // perfil sumiu (conta excluida)
    return [{ link, person, incoming: false }]
  })
}

/** Convites recebidos por mim (sou o member) -- usado no Config, visivel pra qualquer usuario. */
export async function listPendingForMe(me: string): Promise<TeamEdge[]> {
  if (!supabase) return []
  const c = client()

  const { data: links, error } = await c
    .from('team_links')
    .select('*')
    .eq('member_id', me)
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (links ?? []) as TeamLink[]
  if (!rows.length) return []

  const byId = await directoryByIds(rows.map((l) => l.manager_id))

  return rows.flatMap((link) => {
    const person = byId.get(link.manager_id)
    if (!person) return []
    return [{ link, person, incoming: link.status === 'pending' }]
  })
}

/** Busca por nome ou e-mail, excluindo eu mesmo e quem ja tem vinculo comigo. */
export async function searchPeopleForTeam(me: string, term: string, exclude: string[]): Promise<PersonRef[]> {
  if (!supabase) return []
  return searchDirectory(me, term, exclude)
}

export async function inviteToTeam(managerId: string, memberId: string): Promise<TeamLink> {
  const { data, error } = await client()
    .from('team_links')
    .insert({ manager_id: managerId, member_id: memberId })
    .select()
    .single()
  if (error) throw error
  return data as TeamLink
}

export async function acceptTeamInvite(linkId: string): Promise<void> {
  const { error } = await client().from('team_links').update({ status: 'accepted' }).eq('id', linkId)
  if (error) throw error
}

/** Serve pra recusar convite, cancelar convite enviado, ou sair de uma equipe ja aceita. */
export async function declineOrLeaveTeam(linkId: string): Promise<void> {
  const { error } = await client().from('team_links').delete().eq('id', linkId)
  if (error) throw error
}

export async function assignMemberToGroup(linkId: string, groupId: string | null): Promise<void> {
  const { error } = await client().from('team_links').update({ group_id: groupId }).eq('id', linkId)
  if (error) throw error
}

export async function listMyGroups(managerId: string): Promise<TeamGroup[]> {
  if (!supabase) return []
  const { data, error } = await client()
    .from('team_groups')
    .select('*')
    .eq('owner_id', managerId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as TeamGroup[]
}

export async function createGroup(managerId: string, name: string, color: string): Promise<TeamGroup> {
  const { data, error } = await client()
    .from('team_groups')
    .insert({ owner_id: managerId, name: name.trim(), color })
    .select()
    .single()
  if (error) throw error
  return data as TeamGroup
}

export async function renameGroup(groupId: string, name: string, color: string): Promise<void> {
  const { error } = await client().from('team_groups').update({ name: name.trim(), color }).eq('id', groupId)
  if (error) throw error
}

export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await client().from('team_groups').delete().eq('id', groupId)
  if (error) throw error
}
